import { query, command } from '$app/server';
import { z } from 'zod';
import { AI_PROVIDERS } from '$lib/settings';
import { getPb, withAdminPb } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import {
	getAiKey,
	getAiProvider,
	getPrivateInstance,
	setAiKey,
	setAiProvider,
	setPrivateInstance
} from '$lib/server/settings';
import { getUserSetting, setUserSetting, deleteUserSetting } from '$lib/server/userSettings';
import { fetchRates } from '$lib/server/exchangeRates';

function requireAuth() {
	const user = getPb().authStore.record;
	if (!user) error(401, 'Not authenticated');
	return user;
}

function requireAdmin() {
	const user = requireAuth();
	if (!user['admin']) error(403, 'Admin access required');
	return user;
}

export type ManagedAccount = {
	id: string;
	name: string;
	email: string;
	created: string;
};

function getAccounts(filter: string): Promise<ManagedAccount[]> {
	return withAdminPb(async (pb) => {
		const records = await pb.collection('users').getFullList({
			filter,
			sort: '+created',
			fields: 'id,name,email,created'
		});

		return records.map((record) => ({
			id: record.id,
			name: String(record['name'] ?? ''),
			email: String(record['email']),
			created: String(record['created'])
		}));
	});
}

export const getPendingAccounts = query(async (): Promise<ManagedAccount[]> => {
	requireAdmin();
	if (!(await getPrivateInstance())) return [];
	return getAccounts('approved = false && admin = false');
});

export const getApprovedAccounts = query(async (): Promise<ManagedAccount[]> => {
	requireAdmin();
	if (!(await getPrivateInstance())) return [];
	return getAccounts('approved = true && admin = false');
});

export const approveAccount = command(z.string().min(1), async (accountId) => {
	const admin = requireAdmin();
	if (!(await getPrivateInstance()))
		error(400, 'Account approval is available only on private instances');
	if (admin.id === accountId) error(400, 'You cannot approve your own account');

	await withAdminPb(async (pb) => {
		const account = await pb.collection('users').getOne(accountId);
		if (account['admin'] === true) error(403, 'Administrator accounts cannot be changed here');
		await pb.collection('users').update(accountId, { approved: true });
	});

	return { success: true };
});

export const revokeAccount = command(z.string().min(1), async (accountId) => {
	const admin = requireAdmin();
	if (!(await getPrivateInstance()))
		error(400, 'Account approval is available only on private instances');
	if (admin.id === accountId) error(400, 'You cannot revoke your own account');

	await withAdminPb(async (pb) => {
		const account = await pb.collection('users').getOne(accountId);
		if (account['admin'] === true) error(403, 'Administrator accounts cannot be changed here');
		await pb.collection('users').update(accountId, { approved: false });
	});

	return { success: true };
});

export const getAiSettings = query(async () => {
	const user = requireAuth();
	const isAdmin = !!user['admin'];

	const [provider, anthropicKey, openaiKey, googleKey, isPrivateInstance] = await Promise.all([
		getAiProvider(),
		getAiKey('anthropic'),
		getAiKey('openai'),
		getAiKey('google'),
		getPrivateInstance()
	]);
	return {
		isAdmin,
		isPrivateInstance,
		activeProvider: provider,
		keys: {
			anthropic: !!anthropicKey,
			openai: !!openaiKey,
			google: !!googleKey
		}
	};
});

export const updatePrivateInstance = command(z.boolean(), async (isPrivateInstance) => {
	requireAdmin();
	await setPrivateInstance(isPrivateInstance);
	return { success: true, isPrivateInstance };
});

export const saveProviderKey = command(
	z.object({
		provider: z.enum(AI_PROVIDERS),
		apiKey: z.string().min(1, 'API key is required')
	}),
	async ({ provider, apiKey }) => {
		requireAdmin();
		await setAiKey(provider, apiKey);
		return { success: true };
	}
);

export const setActiveProvider = command(
	z.object({ provider: z.enum(AI_PROVIDERS) }),
	async ({ provider }) => {
		requireAdmin();
		await setAiProvider(provider);
		return { success: true };
	}
);

export const getFinancialSettings = query(async () => {
	requireAuth();
	return { baseCurrency: (await getUserSetting('base_currency')) || 'USD' };
});

export const setBaseCurrency = command(
	z.string().length(3, 'Must be a 3-letter currency code'),
	async (currency) => {
		requireAuth();
		await setUserSetting('base_currency', currency.toUpperCase());
		return { success: true };
	}
);

export const getExchangeRates = query(z.string(), async (baseCurrency) => {
	requireAuth();
	return { rates: await fetchRates(baseCurrency) };
});

export const getUserAiSettings = query(async () => {
	requireAuth();
	const [anthropic, openai, google] = await Promise.all([
		getUserSetting('anthropic_api_key'),
		getUserSetting('openai_api_key'),
		getUserSetting('google_api_key')
	]);
	return { keys: { anthropic: !!anthropic, openai: !!openai, google: !!google } };
});

export const saveUserProviderKey = command(
	z.object({
		provider: z.enum(AI_PROVIDERS),
		apiKey: z.string().min(1, 'API key is required')
	}),
	async ({ provider, apiKey }) => {
		requireAuth();
		await setUserSetting(`${provider}_api_key`, apiKey.trim());
		return { success: true };
	}
);

export const clearUserProviderKey = command(
	z.object({ provider: z.enum(AI_PROVIDERS) }),
	async ({ provider }) => {
		requireAuth();
		await deleteUserSetting(`${provider}_api_key`);
		return { success: true };
	}
);
