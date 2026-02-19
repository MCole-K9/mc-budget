import pb from './pocketbase';
import type { Wallet, CreateWalletInput } from '$lib/types/budget';
import { validateWalletInput } from '$lib/validation/budget';

export async function getWallets(): Promise<Wallet[]> {
	const records = await pb.collection('wallets').getFullList({
		sort: '-created'
	});
	return records as unknown as Wallet[];
}

export async function getWallet(id: string): Promise<Wallet> {
	const record = await pb.collection('wallets').getOne(id);
	return record as unknown as Wallet;
}

export async function createWallet(input: CreateWalletInput): Promise<Wallet> {
	const validation = validateWalletInput(input);
	if (!validation.valid) {
		throw new Error(validation.errors.join(', '));
	}

	const user = pb.authStore.record;
	if (!user) {
		throw new Error('User must be authenticated to create a wallet');
	}

	const record = await pb.collection('wallets').create({
		user: user.id,
		name: input.name.trim(),
		balance: input.balance,
		currency: input.currency.toUpperCase(),
		categories: input.categories
	});

	return record as unknown as Wallet;
}

export async function deleteWallet(id: string): Promise<void> {
	await pb.collection('wallets').delete(id);
}

export async function updateWalletBalance(id: string, newBalance: number): Promise<Wallet> {
	if (newBalance < 0) {
		throw new Error('Balance cannot be negative');
	}

	const record = await pb.collection('wallets').update(id, {
		balance: newBalance
	});

	return record as unknown as Wallet;
}
