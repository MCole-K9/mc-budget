import { z } from 'zod';
import { query, command, form } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { getPb } from '$lib/server/db';
import { TransactionSchema, WalletSchema, UpdateTransactionInputSchema } from '$lib/schemas/budget';
import { computeWalletPatch } from '$lib/utils/balance';
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
		fields: 'amount,category,transfer_id',
		requestKey: null
	});

	let income = 0;
	const spendingByCategory: Record<string, number> = {};

	for (const r of records) {
		if (r.transfer_id) continue;
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
		fields: 'amount,wallet,transfer_id',
		expand: 'wallet',
		requestKey: null
	});

	const byCurrency: Record<string, { income: number; expense: number }> = {};
	for (const r of records) {
		if (r.transfer_id) continue;
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
		const isTransfer = !!r.transfer_id;
		const amount = Number(r.amount) || 0;
		const date = String(r.date).split('T')[0].split(' ')[0];
		const month = date.slice(0, 7);
		const w = r.expand?.['wallet'] as Record<string, unknown> | undefined;
		const currency = String(w?.currency ?? 'USD');
		const cats = Array.isArray(w?.categories) ? (w.categories as { name: string; color: string }[]) : [];
		const category = String(r.category);
		const color = cats.find((c) => c.name.toLowerCase() === category.toLowerCase())?.color ?? '#9ca3af';

		if (!isTransfer) {
			if (!byCurrency[currency]) byCurrency[currency] = { income: 0, expense: 0 };
			if (amount > 0) byCurrency[currency].income += amount;
			else byCurrency[currency].expense += Math.abs(amount);
		}

		if (!isTransfer && amount < 0) {
			if (!byCategory[currency]) byCategory[currency] = {};
			if (!byCategory[currency][category]) byCategory[currency][category] = { spent: 0, color };
			byCategory[currency][category].spent += Math.abs(amount);
		}

		if (!isTransfer) {
			if (!byMonth[month]) byMonth[month] = {};
			if (!byMonth[month][currency]) byMonth[month][currency] = { income: 0, expense: 0 };
			if (amount > 0) byMonth[month][currency].income += amount;
			else byMonth[month][currency].expense += Math.abs(amount);
		}

		if (!isTransfer && amount < 0) {
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

	// Add initial_balance to income for wallets that fall within the query period
	const seenWallets = new Map<string, { currency: string; initial_balance: number; created: string }>();
	for (const r of records) {
		const wid = String(r.wallet);
		if (!seenWallets.has(wid)) {
			const w = r.expand?.['wallet'] as Record<string, unknown> | undefined;
			if (w) seenWallets.set(wid, {
				currency: String(w.currency ?? 'USD'),
				initial_balance: Number(w.initial_balance) || 0,
				created: String(w.created ?? '').split('T')[0].split(' ')[0]
			});
		}
	}
	for (const [, w] of seenWallets) {
		if (!w.initial_balance) continue;
		const inRange = !input.startDate ||
			(w.created >= input.startDate && w.created <= (input.endDate ?? '9999-12-31'));
		if (inRange) {
			if (!byCurrency[w.currency]) byCurrency[w.currency] = { income: 0, expense: 0 };
			byCurrency[w.currency].income += w.initial_balance;
		}
	}

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

export const updateTransaction = command(UpdateTransactionInputSchema, async (input) => {
	const pb = getPb();
	const existing = TransactionSchema.parse(
		await pb.collection('transactions').getOne(input.id, { requestKey: null })
	);
	if (existing.wallet !== input.walletId) {
		throw new Error('Transaction does not belong to the specified wallet');
	}

	const wallet = WalletSchema.parse(
		await pb.collection('wallets').getOne(input.walletId, { requestKey: null })
	);

	const finalAmount = input.isExpense ? -Math.abs(input.amount) : Math.abs(input.amount);
	const finalCategory = input.isExpense
		? input.category
		: input.incomeSource?.trim() || 'Income';

	if (input.isExpense) {
		const categoryExists = wallet.categories.some(
			(c) => c.name.toLowerCase() === input.category.toLowerCase()
		);
		if (!categoryExists) {
			throw new Error(`Category "${input.category}" does not exist in this wallet`);
		}
	}

	await pb.collection('transactions').update(input.id, {
		category: finalCategory,
		amount: finalAmount,
		description: input.description?.trim() || '',
		date: input.date
	});

	const walletPatch = computeWalletPatch(existing.amount, finalAmount, wallet.balance, wallet.total_funded);
	await pb.collection('wallets').update(input.walletId, walletPatch);

	getTransactions(input.walletId).refresh();
	getWallet(input.walletId).refresh();

	return TransactionSchema.parse(
		await pb.collection('transactions').getOne(input.id, { requestKey: null })
	);
});

export const deleteTransaction = command(
	z.object({ id: z.string(), walletId: z.string() }),
	async ({ id, walletId }) => {
		const pb = getPb();
		const transaction = TransactionSchema.parse(
			await pb.collection('transactions').getOne(id, { requestKey: null })
		);
		if (transaction.wallet !== walletId) {
			throw new Error('Transaction does not belong to the specified wallet');
		}

		const wallet = WalletSchema.parse(
			await pb.collection('wallets').getOne(transaction.wallet, { requestKey: null })
		);

		// If this is a transfer, also delete and reverse the linked counterpart
		if (transaction.transfer_id) {
			const linked = (await pb.collection('transactions').getFullList({
				filter: `transfer_id = "${transaction.transfer_id}" && id != "${id}"`,
				requestKey: null
			})).map((r) => TransactionSchema.parse(r));

			const transferTransactions = [transaction, ...linked];
			const walletSnapshots = new Map<string, { balance: number; total_funded: number }>();
			const touchedWallets = new Set<string>();
			const deletedTransactions: typeof transferTransactions = [];

			for (const tx of transferTransactions) {
				if (!walletSnapshots.has(tx.wallet)) {
					const w = WalletSchema.parse(
						await pb.collection('wallets').getOne(tx.wallet, { requestKey: null })
					);
					walletSnapshots.set(tx.wallet, {
						balance: w.balance,
						total_funded: w.total_funded
					});
				}
			}

			const walletDeltas = new Map<string, { balanceDelta: number; fundedDelta: number }>();
			for (const tx of transferTransactions) {
				const current = walletDeltas.get(tx.wallet) ?? { balanceDelta: 0, fundedDelta: 0 };
				current.balanceDelta += -tx.amount;
				if (tx.amount > 0) current.fundedDelta += -tx.amount;
				walletDeltas.set(tx.wallet, current);
			}

			try {
				for (const [walletToUpdate, delta] of walletDeltas) {
					const snapshot = walletSnapshots.get(walletToUpdate);
					if (!snapshot) throw new Error('Missing wallet snapshot during transfer delete');
					await pb.collection('wallets').update(walletToUpdate, {
						balance: snapshot.balance + delta.balanceDelta,
						total_funded: snapshot.total_funded + delta.fundedDelta
					}, { requestKey: null });
					touchedWallets.add(walletToUpdate);
				}

				for (const tx of transferTransactions) {
					await pb.collection('transactions').delete(tx.id, { requestKey: null });
					deletedTransactions.push(tx);
				}
			} catch (error) {
				const rollbackErrors: string[] = [];

				for (const walletToRestore of touchedWallets) {
					const snapshot = walletSnapshots.get(walletToRestore);
					if (!snapshot) continue;
					try {
						await pb.collection('wallets').update(walletToRestore, {
							balance: snapshot.balance,
							total_funded: snapshot.total_funded
						}, { requestKey: null });
					} catch {
						rollbackErrors.push(`wallet rollback failed: ${walletToRestore}`);
					}
				}

				for (const tx of deletedTransactions) {
					try {
						await pb.collection('transactions').create({
							wallet: tx.wallet,
							category: tx.category,
							amount: tx.amount,
							description: tx.description,
							date: tx.date,
							recurring: tx.recurring,
							recur_day: tx.recur_day,
							recurring_source_id: tx.recurring_source_id,
							transfer_id: tx.transfer_id
						}, { requestKey: null });
					} catch {
						rollbackErrors.push(`transaction rollback failed: ${tx.id}`);
					}
				}

				if (rollbackErrors.length > 0) {
					throw new Error(
						`Delete transfer failed and rollback was incomplete (${rollbackErrors.join(', ')}).`
					);
				}

				throw error;
			}

			for (const walletIdToRefresh of walletDeltas.keys()) {
				getTransactions(walletIdToRefresh).refresh();
				getWallet(walletIdToRefresh).refresh();
			}

			return { success: true };
		}

		await pb.collection('transactions').delete(id, { requestKey: null });
		await pb.collection('wallets').update(transaction.wallet, {
			balance: wallet.balance - transaction.amount,
			...(transaction.amount > 0 && { total_funded: wallet.total_funded - transaction.amount })
		});

		getTransactions(transaction.wallet).refresh();
		getWallet(transaction.wallet).refresh();
		return { success: true };
	}
);
