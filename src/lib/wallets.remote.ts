import { z } from 'zod';
import { query, command } from '$app/server';
import { pb } from '$lib/server/db';
import {
	CreateWalletInputSchema,
	WalletSchema,
	type Wallet
} from '$lib/schemas/budget';

/**
 * Get all wallets for the current user
 */
export const getWallets = query(async () => {
	const records = await pb.collection('wallets').getFullList({
		sort: '-created'
	});
	return records.map((r) => WalletSchema.parse(r));
});

/**
 * Get a single wallet by ID
 */
export const getWallet = query(z.string(), async (id) => {
	const record = await pb.collection('wallets').getOne(id);
	return WalletSchema.parse(record);
});

/**
 * Create a new wallet with budget categories
 * Uses CreateWalletInputSchema for validation
 */
export const createWallet = command(CreateWalletInputSchema, async (input) => {
	const user = pb.authStore.record;
	if (!user) {
		throw new Error('User must be authenticated to create a wallet');
	}

	const record = await pb.collection('wallets').create({
		user: user.id,
		name: input.name.trim(),
		balance: input.balance,
		currency: input.currency,
		categories: input.categories
	});

	return WalletSchema.parse(record);
});

/**
 * Delete a wallet
 */
export const deleteWallet = command(z.string(), async (id) => {
	await pb.collection('wallets').delete(id);
	return { success: true };
});

/**
 * Update wallet balance
 */
export const updateWalletBalance = command(
	z.object({
		id: z.string(),
		balance: z.number().min(0, 'Balance cannot be negative')
	}),
	async ({ id, balance }) => {
		const record = await pb.collection('wallets').update(id, {
			balance
		});
		return WalletSchema.parse(record);
	}
);
