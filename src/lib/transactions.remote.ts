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

const GetTransactionSummarySchema = z.object({
	walletId: z.string(),
	startDate: z.string().optional(),
	endDate: z.string().optional()
});

export const getTransactionSummary = query(GetTransactionSummarySchema, async (input) => {
	let filter = `wallet = "${input.walletId}"`;
	if (input.startDate) filter += ` && date >= "${input.startDate}"`;
	if (input.endDate) filter += ` && date <= "${input.endDate} 23:59:59.999Z"`;

	const records = await getPb().collection('transactions').getFullList({
		filter,
		fields: 'amount,category',
		requestKey: null
	});

	let income = 0;
	const spendingByCategory: Record<string, number> = {};

	for (const r of records) {
		const amount = Number(r.amount) || 0;
		if (amount > 0) {
			income += amount;
		} else {
			const cat = String(r.category).toLowerCase();
			spendingByCategory[cat] = (spendingByCategory[cat] ?? 0) + Math.abs(amount);
		}
	}

	return { income, spendingByCategory };
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
	if (input.endDate) filter += ` && date <= "${input.endDate} 23:59:59.999Z"`;

	const result = await getPb().collection('transactions').getList(input.page, input.perPage, {
		filter,
		sort: '-date,-created',
		requestKey: null
	});

	return {
		items: result.items.map((r) => TransactionSchema.parse(r)),
		totalItems: result.totalItems,
		totalPages: result.totalPages,
		page: result.page
	};
});

const GetAllTransactionsPagedSchema = z.object({
	page: z.number().default(1),
	perPage: z.number().default(25),
	startDate: z.string().optional(),
	endDate: z.string().optional()
});

export const getAllTransactionsPaged = query(GetAllTransactionsPagedSchema, async (input) => {
	let filter = '';
	if (input.startDate) filter += `date >= "${input.startDate}"`;
	if (input.endDate) filter += (filter ? ' && ' : '') + `date <= "${input.endDate} 23:59:59.999Z"`;

	const result = await getPb().collection('transactions').getList(input.page, input.perPage, {
		filter: filter || undefined,
		sort: '-date,-created',
		expand: 'wallet',
		requestKey: null
	});

	return {
		items: result.items.map((r) => {
			const tx = TransactionSchema.parse(r);
			const w = r.expand?.['wallet'] as Record<string, unknown> | undefined;
			const cats = Array.isArray(w?.categories)
				? (w.categories as { name: string; color: string }[])
				: [];
			const catColor = cats.find((c) => c.name.toLowerCase() === tx.category.toLowerCase())?.color ?? null;
			return {
				...tx,
				date: tx.date.split('T')[0].split(' ')[0],
				walletName: String(w?.name ?? ''),
				currency: String(w?.currency ?? ''),
				categoryColor: catColor
			};
		}),
		totalItems: result.totalItems,
		totalPages: result.totalPages,
		page: result.page
	};
});

const GetAllTransactionsSummarySchema = z.object({
	startDate: z.string().optional(),
	endDate: z.string().optional()
});

export const getAllTransactionsSummary = query(GetAllTransactionsSummarySchema, async (input) => {
	let filter = '';
	if (input.startDate) filter += `date >= "${input.startDate}"`;
	if (input.endDate) filter += (filter ? ' && ' : '') + `date <= "${input.endDate} 23:59:59.999Z"`;

	const records = await getPb().collection('transactions').getFullList({
		filter: filter || undefined,
		fields: 'amount,wallet',
		expand: 'wallet',
		requestKey: null
	});

	const byCurrency: Record<string, { income: number; expense: number }> = {};
	for (const r of records) {
		const amount = Number(r.amount) || 0;
		const w = r.expand?.['wallet'] as Record<string, unknown> | undefined;
		const currency = String(w?.currency ?? 'USD');
		if (!byCurrency[currency]) byCurrency[currency] = { income: 0, expense: 0 };
		if (amount > 0) byCurrency[currency].income += amount;
		else byCurrency[currency].expense += Math.abs(amount);
	}

	return { byCurrency };
});

const GetReportInputSchema = z.object({
	walletId: z.string().optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional()
});

type TopExpense = {
	id: string;
	description: string;
	category: string;
	amount: number;
	currency: string;
	walletName: string;
	date: string;
	color: string;
};

export const getReport = query(GetReportInputSchema, async (input) => {
	let filter = '';
	if (input.walletId) filter += `wallet = "${input.walletId}"`;
	if (input.startDate) filter += (filter ? ' && ' : '') + `date >= "${input.startDate}"`;
	if (input.endDate) filter += (filter ? ' && ' : '') + `date <= "${input.endDate} 23:59:59.999Z"`;

	const records = await getPb().collection('transactions').getFullList({
		filter: filter || undefined,
		expand: 'wallet',
		sort: 'date',
		requestKey: null
	});

	const byCurrency: Record<string, { income: number; expense: number }> = {};
	const byCategory: Record<string, Record<string, { spent: number; color: string }>> = {};
	const byMonth: Record<string, Record<string, { income: number; expense: number }>> = {};
	const topExpenses: TopExpense[] = [];

	for (const r of records) {
		const amount = Number(r.amount) || 0;
		const date = String(r.date).split('T')[0].split(' ')[0];
		const month = date.slice(0, 7);
		const w = r.expand?.['wallet'] as Record<string, unknown> | undefined;
		const currency = String(w?.currency ?? 'USD');
		const cats = Array.isArray(w?.categories) ? (w.categories as { name: string; color: string }[]) : [];
		const category = String(r.category);
		const color = cats.find((c) => c.name.toLowerCase() === category.toLowerCase())?.color ?? '#9ca3af';

		if (!byCurrency[currency]) byCurrency[currency] = { income: 0, expense: 0 };
		if (amount > 0) byCurrency[currency].income += amount;
		else byCurrency[currency].expense += Math.abs(amount);

		if (amount < 0) {
			if (!byCategory[currency]) byCategory[currency] = {};
			if (!byCategory[currency][category]) byCategory[currency][category] = { spent: 0, color };
			byCategory[currency][category].spent += Math.abs(amount);
		}

		if (!byMonth[month]) byMonth[month] = {};
		if (!byMonth[month][currency]) byMonth[month][currency] = { income: 0, expense: 0 };
		if (amount > 0) byMonth[month][currency].income += amount;
		else byMonth[month][currency].expense += Math.abs(amount);

		if (amount < 0) {
			topExpenses.push({
				id: String(r.id),
				description: String(r.description || ''),
				category,
				amount: Math.abs(amount),
				currency,
				walletName: String(w?.name ?? ''),
				date,
				color
			});
		}
	}

	topExpenses.sort((a, b) => b.amount - a.amount);
	topExpenses.splice(10);

	return { byCurrency, byCategory, byMonth, topExpenses };
});

const CreateTransactionFormSchema = z.object({
	walletId: z.string().min(1, 'Wallet ID required'),
	isExpense: z.string(),
	category: z.string().optional().default(''),
	incomeSource: z.string().optional(),
	amount: z.number().gt(0, 'Amount must be greater than 0'),
	description: z.string().optional(),
	date: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid date format'),
	receipt: z.instanceof(File).optional(),
	recurring: z.string().optional(),
	recur_day: z.number().optional()
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

	const isRecurring = input.recurring === 'true';
	const recurDay = isRecurring ? Math.min(28, Math.max(1, input.recur_day ?? 1)) : 0;

	const formData = new FormData();
	formData.append('wallet', input.walletId);
	formData.append('category', finalCategory);
	formData.append('amount', String(finalAmount));
	formData.append('description', input.description?.trim() || '');
	formData.append('date', input.date);
	formData.append('recurring', String(isRecurring));
	formData.append('recur_day', String(recurDay));

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
