import { z } from 'zod';
import { query, command } from '$app/server';
import { pb } from '$lib/server/db';
import {
	CreateTransactionInputSchema,
	TransactionSchema,
	WalletSchema
} from '$lib/schemas/budget';

export const getTransactions = query(z.string(), async (walletId) => {
	const records = await pb.collection('transactions').getFullList({
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
		const categoryExists = wallet.categories.some(
			(c) => c.name.toLowerCase() === input.category.toLowerCase()
		);

		if (!categoryExists) {
			throw new Error(`Category "${input.category}" does not exist in this wallet`);
		}

		const record = await pb.collection('transactions').create({
			wallet: input.wallet,
			category: input.category,
			amount: input.amount,
			description: input.description?.trim() || '',
			date: input.date
		});

		return TransactionSchema.parse(record);
	}
);

export const deleteTransaction = command(z.string(), async (id) => {
	await pb.collection('transactions').delete(id);
	return { success: true };
});
