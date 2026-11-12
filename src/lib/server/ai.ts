import type { AnyTextAdapter } from '@tanstack/ai';
import { createAnthropicChat } from '@tanstack/ai-anthropic';
import { createOpenaiChat } from '@tanstack/ai-openai';
import { createGeminiChat } from '@tanstack/ai-gemini';
import { PROVIDER_MODELS, type AiProvider } from '$lib/settings';
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
