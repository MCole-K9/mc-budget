import { query, command } from '$app/server';
import { z } from 'zod';
import { AI_PROVIDERS } from '$lib/settings';
import { getPb } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import {
	getAiKey,
	getAiProvider,
	setAiKey,
	setAiProvider
} from '$lib/server/settings';

function requireAuth() {
	const user = getPb().authStore.record;
	if (!user) error(401, 'Not authenticated');
	return user;
}

export const getAiSettings = query(async () => {
	requireAuth();

	const [provider, anthropicKey, openaiKey, googleKey] = await Promise.all([
		getAiProvider(),
		getAiKey('anthropic'),
		getAiKey('openai'),
		getAiKey('google')
	]);
	return {
		activeProvider: provider,
		keys: {
			anthropic: !!anthropicKey,
			openai: !!openaiKey,
			google: !!googleKey
		}
	};
});

export const saveProviderKey = command(
	z.object({
		provider: z.enum(AI_PROVIDERS),
		apiKey: z.string().min(1, 'API key is required')
	}),
	async ({ provider, apiKey }) => {
		requireAuth();
		await setAiKey(provider, apiKey);
		return { success: true };
	}
);

export const setActiveProvider = command(
	z.object({ provider: z.enum(AI_PROVIDERS) }),
	async ({ provider }) => {
		requireAuth();
		await setAiProvider(provider);
		return { success: true };
	}
);
