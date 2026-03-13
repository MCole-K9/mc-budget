import { z } from 'zod';
import { query, command } from '$app/server';
import { getPb } from '$lib/server/db';
import { CreateWalletInputSchema, WalletSchema, TransactionSchema } from '$lib/schemas/budget';

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

	const record = await pb.collection('wallets').create({
		user: user.id,
		name: input.name.trim(),
		balance: input.balance,
		initial_balance: input.balance,
		currency: input.currency,
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

export const recalculateBalance = command(z.string(), async (walletId) => {
	const pb = getPb();
	const wallet = WalletSchema.parse(await pb.collection('wallets').getOne(walletId));
	const records = await pb.collection('transactions').getFullList({
		filter: `wallet = "${walletId}"`
	});
	const transactionSum = records
		.map((r) => TransactionSchema.parse(r))
		.reduce((sum, t) => sum + t.amount, 0);
	const newBalance = wallet.initial_balance + transactionSum;
	const updated = await pb.collection('wallets').update(walletId, { balance: newBalance });
	getWallet(walletId).refresh();
	getWallets().refresh();
	return WalletSchema.parse(updated);
});
