import { z } from 'zod';
import { query, command } from '$app/server';
import { pb } from '$lib/server/db';
import {
	CreateTransactionInputSchema,
	TransactionSchema,
	WalletSchema,
	type Transaction
} from '$lib/schemas/budget';

/**
 * Get all transactions for a wallet
 */
export const getTransactions = query(z.string(), async (walletId) => {
	const records = await pb.collection('transactions').getFullList({
		filter: `wallet = "${walletId}"`,
		sort: '-date,-created'
	});
	return records.map((r) => TransactionSchema.parse(r));
});

/**
 * Get a single transaction by ID
 */
export const getTransaction = query(z.string(), async (id) => {
	const record = await pb.collection('transactions').getOne(id);
	return TransactionSchema.parse(record);
});

// Schema for create transaction with wallet validation
const CreateTransactionWithWalletSchema = z.object({
	input: CreateTransactionInputSchema,
	wallet: WalletSchema
});

/**
 * Create a new transaction
 */
export const createTransaction = command(
	CreateTransactionWithWalletSchema,
	async ({ input, wallet }) => {
		// Validate category exists in wallet
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

/**
 * Delete a transaction
 */
export const deleteTransaction = command(z.string(), async (id) => {
	await pb.collection('transactions').delete(id);
	return { success: true };
});

/**
 * Get transactions filtered by category
 */
export const getTransactionsByCategory = query(
	z.object({
		walletId: z.string(),
		category: z.string()
	}),
	async ({ walletId, category }) => {
		const records = await pb.collection('transactions').getFullList({
			filter: `wallet = "${walletId}" && category = "${category}"`,
			sort: '-date,-created'
		});
		return records.map((r) => TransactionSchema.parse(r));
	}
);

/**
 * Get transactions within a date range
 */
export const getTransactionsByDateRange = query(
	z.object({
		walletId: z.string(),
		startDate: z.string(),
		endDate: z.string()
	}),
	async ({ walletId, startDate, endDate }) => {
		const records = await pb.collection('transactions').getFullList({
			filter: `wallet = "${walletId}" && date >= "${startDate}" && date <= "${endDate}"`,
			sort: '-date,-created'
		});
		return records.map((r) => TransactionSchema.parse(r));
	}
);

export interface CategorySummary {
	category: string;
	total: number;
	count: number;
}

/**
 * Get spending summary by category
 */
export const getCategorySummary = query(z.string(), async (walletId) => {
	const transactions = await pb.collection('transactions').getFullList({
		filter: `wallet = "${walletId}"`,
		sort: '-date,-created'
	});

	const parsed = transactions.map((r) => TransactionSchema.parse(r));
	const summaryMap = new Map<string, CategorySummary>();

	for (const tx of parsed) {
		const existing = summaryMap.get(tx.category);
		if (existing) {
			existing.total += tx.amount;
			existing.count += 1;
		} else {
			summaryMap.set(tx.category, {
				category: tx.category,
				total: tx.amount,
				count: 1
			});
		}
	}

	return Array.from(summaryMap.values());
});
