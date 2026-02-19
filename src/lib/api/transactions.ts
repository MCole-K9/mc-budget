import pb from './pocketbase';
import type { Transaction, CreateTransactionInput, Wallet } from '$lib/types/budget';
import { validateTransactionInput } from '$lib/validation/budget';

export async function getTransactions(walletId: string): Promise<Transaction[]> {
	const records = await pb.collection('transactions').getFullList({
		filter: `wallet = "${walletId}"`,
		sort: '-date,-created'
	});
	return records as unknown as Transaction[];
}

export async function getTransaction(id: string): Promise<Transaction> {
	const record = await pb.collection('transactions').getOne(id);
	return record as unknown as Transaction;
}

export async function createTransaction(
	input: CreateTransactionInput,
	wallet: Wallet
): Promise<Transaction> {
	const validation = validateTransactionInput(input, wallet);
	if (!validation.valid) {
		throw new Error(validation.errors.join(', '));
	}

	const record = await pb.collection('transactions').create({
		wallet: input.wallet,
		category: input.category,
		amount: input.amount,
		description: input.description?.trim() || '',
		date: input.date
	});

	return record as unknown as Transaction;
}

export async function deleteTransaction(id: string): Promise<void> {
	await pb.collection('transactions').delete(id);
}

export async function getTransactionsByCategory(
	walletId: string,
	category: string
): Promise<Transaction[]> {
	const records = await pb.collection('transactions').getFullList({
		filter: `wallet = "${walletId}" && category = "${category}"`,
		sort: '-date,-created'
	});
	return records as unknown as Transaction[];
}

export async function getTransactionsByDateRange(
	walletId: string,
	startDate: string,
	endDate: string
): Promise<Transaction[]> {
	const records = await pb.collection('transactions').getFullList({
		filter: `wallet = "${walletId}" && date >= "${startDate}" && date <= "${endDate}"`,
		sort: '-date,-created'
	});
	return records as unknown as Transaction[];
}

export interface CategorySummary {
	category: string;
	total: number;
	count: number;
}

export async function getCategorySummary(walletId: string): Promise<CategorySummary[]> {
	const transactions = await getTransactions(walletId);

	const summaryMap = new Map<string, CategorySummary>();

	for (const tx of transactions) {
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
}
