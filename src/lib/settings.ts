export const AI_PROVIDERS = ['anthropic', 'openai', 'google'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const PROVIDER_LABELS: Record<AiProvider, string> = {
	anthropic: 'Anthropic',
	openai: 'OpenAI',
	google: 'Google Gemini'
};

export const PROVIDER_MODELS: Record<AiProvider, string> = {
	anthropic: 'claude-haiku-4-5-20251001',
	openai: 'gpt-4o-mini',
	google: 'gemini-1.5-flash'
};
