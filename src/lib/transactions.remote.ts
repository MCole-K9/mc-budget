import { z } from 'zod';
import { query, command } from '$app/server';
import { getPb } from '$lib/server/db';
import { CreateTransactionInputSchema, TransactionSchema, WalletSchema } from '$lib/schemas/budget';
import { getWallet } from '$lib/wallets.remote';

export const getTransactions = query(z.string(), async (walletId) => {
	const records = await getPb().collection('transactions').getFullList({
		filter: `wallet = "${walletId}"`,
		sort: '-date,-created'
	});
	return records.map((r) => TransactionSchema.parse(r));
});

const CreateTransactionWithWalletSchema = z.object({
	input: CreateTransactionInputSchema,
	wallet: WalletSchema
});

export const createTransaction = command(
	CreateTransactionWithWalletSchema,
	async ({ input, wallet }) => {
		const isExpense = input.amount < 0;
		if (isExpense) {
			const categoryExists = wallet.categories.some(
				(c) => c.name.toLowerCase() === input.category.toLowerCase()
			);
			if (!categoryExists) {
				throw new Error(`Category "${input.category}" does not exist in this wallet`);
			}
		}

		const record = await getPb().collection('transactions').create({
			wallet: input.wallet,
			category: input.category,
			amount: input.amount,
			description: input.description?.trim() || '',
			date: input.date
		});

		await getPb()
			.collection('wallets')
			.update(input.wallet, { balance: wallet.balance + input.amount });

		getTransactions(input.wallet).refresh();
		getWallet(input.wallet).refresh();
		return TransactionSchema.parse(record);
	}
);

export const deleteTransaction = command(
	z.object({ id: z.string(), walletId: z.string() }),
	async ({ id, walletId }) => {
		const pb = getPb();
		const transaction = TransactionSchema.parse(await pb.collection('transactions').getOne(id));
		const wallet = WalletSchema.parse(await pb.collection('wallets').getOne(walletId));

		await pb.collection('transactions').delete(id);
		await pb.collection('wallets').update(walletId, { balance: wallet.balance - transaction.amount });

		getTransactions(walletId).refresh();
		getWallet(walletId).refresh();
		return { success: true };
	}
);
