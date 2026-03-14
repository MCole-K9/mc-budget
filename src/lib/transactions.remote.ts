import { z } from 'zod';
import { query, command, form } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { getPb } from '$lib/server/db';
import { TransactionSchema, WalletSchema } from '$lib/schemas/budget';
import { getWallet } from '$lib/wallets.remote';

export const getTransactions = query(z.string(), async (walletId) => {
	const records = await getPb().collection('transactions').getFullList({
		filter: `wallet = "${walletId}"`,
		sort: '-date,-created'
	});
	return records.map((r) => TransactionSchema.parse(r));
});

const GetTransactionsPagedSchema = z.object({
	walletId: z.string(),
	page: z.number().default(1),
	perPage: z.number().default(15),
	startDate: z.string().optional(),
	endDate: z.string().optional()
});

export const getTransactionsPaged = query(GetTransactionsPagedSchema, async (input) => {
	let filter = `wallet = "${input.walletId}"`;
	if (input.startDate) filter += ` && date >= "${input.startDate}"`;
	if (input.endDate) filter += ` && date <= "${input.endDate}"`;

	const result = await getPb().collection('transactions').getList(input.page, input.perPage, {
		filter,
		sort: '-date,-created'
	});

	return {
		items: result.items.map((r) => TransactionSchema.parse(r)),
		totalItems: result.totalItems,
		totalPages: result.totalPages,
		page: result.page
	};
});

const CreateTransactionFormSchema = z.object({
	walletId: z.string().min(1, 'Wallet ID required'),
	isExpense: z.string(),
	category: z.string().optional().default(''),
	incomeSource: z.string().optional(),
	amount: z.number().gt(0, 'Amount must be greater than 0'),
	description: z.string().optional(),
	date: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid date format'),
	receipt: z.instanceof(File).optional()
});

export const createTransaction = form(CreateTransactionFormSchema, async (input) => {
	const pb = getPb();
	const walletRecord = await pb.collection('wallets').getOne(input.walletId);
	const wallet = WalletSchema.parse(walletRecord);

	const isExpense = input.isExpense === 'true';
	const finalAmount = isExpense ? -Math.abs(input.amount) : Math.abs(input.amount);
	const finalCategory = isExpense
		? input.category || ''
		: input.incomeSource?.trim() || 'Income';

	if (isExpense) {
		const categoryExists = wallet.categories.some(
			(c) => c.name.toLowerCase() === (input.category || '').toLowerCase()
		);
		if (!categoryExists) {
			invalid(`Category "${input.category}" does not exist in this wallet`);
		}
	}

	const formData = new FormData();
	formData.append('wallet', input.walletId);
	formData.append('category', finalCategory);
	formData.append('amount', String(finalAmount));
	formData.append('description', input.description?.trim() || '');
	formData.append('date', input.date);

	if (input.receipt instanceof File && input.receipt.size > 0) {
		formData.append('receipt', input.receipt);
	}

	const record = await pb.collection('transactions').create(formData);

	await pb.collection('wallets').update(input.walletId, {
		balance: wallet.balance + finalAmount,
		...(finalAmount > 0 && { total_funded: wallet.total_funded + finalAmount })
	});

	getTransactions(input.walletId).refresh();
	getWallet(input.walletId).refresh();

	return TransactionSchema.parse(record);
});

export const deleteTransaction = command(
	z.object({ id: z.string(), walletId: z.string() }),
	async ({ id, walletId }) => {
		const pb = getPb();
		const transaction = TransactionSchema.parse(await pb.collection('transactions').getOne(id));
		const wallet = WalletSchema.parse(await pb.collection('wallets').getOne(walletId));

		await pb.collection('transactions').delete(id);
		await pb.collection('wallets').update(walletId, {
			balance: wallet.balance - transaction.amount,
			...(transaction.amount > 0 && { total_funded: wallet.total_funded - transaction.amount })
		});

		getTransactions(walletId).refresh();
		getWallet(walletId).refresh();
		return { success: true };
	}
);
