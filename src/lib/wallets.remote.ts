import { z } from 'zod';
import { query, command } from '$app/server';
import { getPb } from '$lib/server/db';
import { CreateWalletInputSchema, WalletSchema, TransactionSchema, UpdatePeriodPrefsInputSchema } from '$lib/schemas/budget';

export const getWallets = query(async () => {
	const records = await getPb().collection('wallets').getFullList({ sort: '-created' });
	return records.map((r) => WalletSchema.parse(r));
});

export const getWallet = query(z.string(), async (id) => {
	const record = await getPb().collection('wallets').getOne(id);
	return WalletSchema.parse(record);
});

export const createWallet = command(CreateWalletInputSchema, async (input) => {
	const pb = getPb();
	const user = pb.authStore.record;
	if (!user) throw new Error('User must be authenticated to create a wallet');

	// Server-side validation based on budget_type
	if (input.budget_type === 'percentage') {
		const total = input.categories.reduce((sum, c) => sum + c.percentage, 0);
		if (Math.abs(total - 100) >= 0.01) throw new Error('Categories must total exactly 100%');
	} else {
		if (input.categories.some((c) => !c.fixedAmount || c.fixedAmount <= 0)) {
			throw new Error('All fixed-amount categories must have an amount greater than 0');
		}
	}

	const record = await pb.collection('wallets').create({
		user: user.id,
		name: input.name.trim(),
		balance: input.balance,
		initial_balance: input.balance,
		total_funded: input.balance,
		currency: input.currency,
		budget_type: input.budget_type,
		categories: input.categories
	});

	getWallets().refresh();
	return WalletSchema.parse(record);
});

export const deleteWallet = command(z.string(), async (id) => {
	await getPb().collection('wallets').delete(id);
	getWallets().refresh();
	return { success: true };
});

export const updateWalletBalance = command(
	z.object({ id: z.string(), balance: z.number().min(0, 'Balance cannot be negative') }),
	async ({ id, balance }) => {
		const record = await getPb().collection('wallets').update(id, { balance });
		return WalletSchema.parse(record);
	}
);

export const updatePeriodPrefs = command(UpdatePeriodPrefsInputSchema, async ({ id, default_period, saved_periods, cycle_start_day }) => {
	const record = await getPb().collection('wallets').update(id, {
		...(default_period !== undefined && { default_period }),
		...(saved_periods !== undefined && { saved_periods }),
		...(cycle_start_day !== undefined && { cycle_start_day })
	});
	getWallet(id).refresh();
	return WalletSchema.parse(record);
});

export const updateCategoryColor = command(
	z.object({
		id: z.string(),
		categoryName: z.string(),
		color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color')
	}),
	async ({ id, categoryName, color }) => {
		const pb = getPb();
		const wallet = WalletSchema.parse(await pb.collection('wallets').getOne(id));
		const categories = wallet.categories.map((c) =>
			c.name === categoryName ? { ...c, color } : c
		);
		const record = await pb.collection('wallets').update(id, { categories });
		getWallet(id).refresh();
		getWallets().refresh();
		return WalletSchema.parse(record);
	}
);

export const recalculateBalance = command(z.string(), async (walletId) => {
	const pb = getPb();
	const wallet = WalletSchema.parse(await pb.collection('wallets').getOne(walletId));
	const records = await pb.collection('transactions').getFullList({
		filter: `wallet = "${walletId}"`
	});
	const transactions = records.map((r) => TransactionSchema.parse(r));
	const transactionSum = transactions.reduce((sum, t) => sum + t.amount, 0);
	const incomeSum = transactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
	const newBalance = wallet.initial_balance + transactionSum;
	const newTotalFunded = wallet.initial_balance + incomeSum;
	const updated = await pb.collection('wallets').update(walletId, {
		balance: newBalance,
		total_funded: newTotalFunded
	});
	getWallet(walletId).refresh();
	getWallets().refresh();
	return WalletSchema.parse(updated);
});
