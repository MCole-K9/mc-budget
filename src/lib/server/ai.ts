import type { AnyTextAdapter } from '@tanstack/ai';
import { createAnthropicChat } from '@tanstack/ai-anthropic';
import { createOpenaiChat } from '@tanstack/ai-openai';
import { createGeminiChat } from '@tanstack/ai-gemini';
import { AI_PROVIDERS, PROVIDER_MODELS, type AiProvider } from '$lib/settings';
import { getAiKey, getAiProvider } from './settings';
import { getUserAiKey } from './userSettings';

function createAdapter(provider: AiProvider, apiKey: string): AnyTextAdapter {
	switch (provider) {
		case 'anthropic':
			return createAnthropicChat(PROVIDER_MODELS.anthropic, apiKey);
		case 'openai':
			return createOpenaiChat(PROVIDER_MODELS.openai, apiKey);
		case 'google':
			return createGeminiChat(PROVIDER_MODELS.google, apiKey);
		default: {
			// Compile-time exhaustiveness check: TypeScript errors here if a new
			// provider is added to AiProvider without a corresponding case above.
			const _exhaustive: never = provider;
			throw new Error(`Unsupported AI provider: ${_exhaustive}`);
		}
	}
}

/**
 * Adapter that uses ONLY the signed-in user's own key, never the instance key. For personal data
 * such as bank alert text (ADR 0001). Tries the instance's active provider first, then any other
 * provider the user has a key for. Returns null when the user has no key.
 */
export async function getUserOwnModel(): Promise<{
	adapter: AnyTextAdapter;
	provider: AiProvider;
} | null> {
	const active = await getAiProvider();
	for (const provider of [active, ...AI_PROVIDERS.filter((p) => p !== active)]) {
		const apiKey = await getUserAiKey(provider);
		if (apiKey) return { adapter: createAdapter(provider, apiKey), provider };
	}
	return null;
}

/**
 * TanStack AI text adapter for the signed-in user with the instance's active provider.
 * The user's own key takes priority over the instance key. Returns null when neither is set.
 */
export async function getModelForUser(): Promise<{
	adapter: AnyTextAdapter;
	source: 'user' | 'instance';
} | null> {
	const provider = await getAiProvider();
	const userKey = await getUserAiKey(provider);
	const apiKey = userKey || (await getAiKey(provider));
	if (!apiKey) return null;
	return { adapter: createAdapter(provider, apiKey), source: userKey ? 'user' : 'instance' };
}
