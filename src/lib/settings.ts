export const CURRENCIES = [
	{ value: 'USD', label: 'USD - US Dollar' },
	{ value: 'EUR', label: 'EUR - Euro' },
	{ value: 'GBP', label: 'GBP - British Pound' },
	{ value: 'JPY', label: 'JPY - Japanese Yen' },
	{ value: 'CAD', label: 'CAD - Canadian Dollar' },
	{ value: 'AUD', label: 'AUD - Australian Dollar' },
	{ value: 'CHF', label: 'CHF - Swiss Franc' },
	{ value: 'CNY', label: 'CNY - Chinese Yuan' },
	{ value: 'HKD', label: 'HKD - Hong Kong Dollar' },
	{ value: 'NZD', label: 'NZD - New Zealand Dollar' },
	{ value: 'SEK', label: 'SEK - Swedish Krona' },
	{ value: 'KRW', label: 'KRW - South Korean Won' },
	{ value: 'SGD', label: 'SGD - Singapore Dollar' },
	{ value: 'NOK', label: 'NOK - Norwegian Krone' },
	{ value: 'MXN', label: 'MXN - Mexican Peso' },
	{ value: 'INR', label: 'INR - Indian Rupee' },
	{ value: 'RUB', label: 'RUB - Russian Ruble' },
	{ value: 'ZAR', label: 'ZAR - South African Rand' },
	{ value: 'TRY', label: 'TRY - Turkish Lira' },
	{ value: 'BRL', label: 'BRL - Brazilian Real' },
	{ value: 'TWD', label: 'TWD - Taiwan Dollar' },
	{ value: 'DKK', label: 'DKK - Danish Krone' },
	{ value: 'PLN', label: 'PLN - Polish Złoty' },
	{ value: 'THB', label: 'THB - Thai Baht' },
	{ value: 'IDR', label: 'IDR - Indonesian Rupiah' },
	{ value: 'HUF', label: 'HUF - Hungarian Forint' },
	{ value: 'CZK', label: 'CZK - Czech Koruna' },
	{ value: 'ILS', label: 'ILS - Israeli Shekel' },
	{ value: 'CLP', label: 'CLP - Chilean Peso' },
	{ value: 'PHP', label: 'PHP - Philippine Peso' },
	{ value: 'AED', label: 'AED - UAE Dirham' },
	{ value: 'SAR', label: 'SAR - Saudi Riyal' },
	{ value: 'MYR', label: 'MYR - Malaysian Ringgit' },
	{ value: 'RON', label: 'RON - Romanian Leu' },
	{ value: 'PKR', label: 'PKR - Pakistani Rupee' },
	{ value: 'BDT', label: 'BDT - Bangladeshi Taka' },
	{ value: 'EGP', label: 'EGP - Egyptian Pound' },
	{ value: 'VND', label: 'VND - Vietnamese Dong' },
	{ value: 'NGN', label: 'NGN - Nigerian Naira' },
	{ value: 'UAH', label: 'UAH - Ukrainian Hryvnia' },
	{ value: 'KES', label: 'KES - Kenyan Shilling' },
	{ value: 'GHS', label: 'GHS - Ghanaian Cedi' },
	{ value: 'COP', label: 'COP - Colombian Peso' },
	{ value: 'ARS', label: 'ARS - Argentine Peso' },
	{ value: 'PEN', label: 'PEN - Peruvian Sol' },
	{ value: 'JMD', label: 'JMD - Jamaican Dollar' }
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]['value'];

export const AI_PROVIDERS = ['anthropic', 'openai', 'google'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const PROVIDER_LABELS: Record<AiProvider, string> = {
	anthropic: 'Anthropic',
	openai: 'OpenAI',
	google: 'Google Gemini'
};

// Cheap current models with image input + structured output (checked 2026-11-12 against
// the TanStack AI adapter model metadata and the provider docs):
// https://platform.claude.com/docs/en/models/overview
// https://developers.openai.com/api/docs/models/all
// https://ai.google.dev/gemini-api/docs/models
// `as const` keeps the literal ids: the TanStack AI adapters accept only known model ids.
export const PROVIDER_MODELS = {
	anthropic: 'claude-haiku-5-5',
	openai: 'gpt-6-luna',
	google: 'gemini-3.5-flash-lite'
} as const satisfies Record<AiProvider, string>;

/** Settings row name (instance `app_settings` and per-user `user_settings`) for a provider's API key. */
export function aiKeySetting(provider: AiProvider): string {
	return `${provider}_api_key`;
}
