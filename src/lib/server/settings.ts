import { withAdminPb } from './db';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { AI_PROVIDERS, type AiProvider } from '$lib/settings';

// Allowlist: only lowercase letters, digits, and underscores.
// Prevents filter injection if this module is ever called with dynamic input.
function assertSafeKey(key: string): void {
	if (!/^[a-z0-9_]+$/.test(key)) throw new Error(`Invalid settings key: "${key}"`);
}

async function upsertSetting(key: string, value: string): Promise<void> {
	assertSafeKey(key);
	await withAdminPb(async (pb) => {
		// Separate try/catch so an update failure is not silently converted into a
		// duplicate-create (the previous single try/catch conflated the two).
		let existing: { id: string } | null = null;
		try {
			existing = await pb.collection('app_settings').getFirstListItem(`skey="${key}"`);
		} catch {
			// Record does not exist yet — will create below
		}

		if (existing) {
			await pb.collection('app_settings').update(existing.id, { value });
		} else {
			await pb.collection('app_settings').create({ skey: key, value });
		}
	});
}

async function getSetting(key: string): Promise<string> {
	assertSafeKey(key);
	try {
		return await withAdminPb(async (pb) => {
			const record = await pb.collection('app_settings').getFirstListItem(`skey="${key}"`);
			return String(record['value'] || '');
		});
	} catch {
		return '';
	}
}

export async function getAiProvider(): Promise<AiProvider> {
	const val = await getSetting('ai_provider');
	return (AI_PROVIDERS as readonly string[]).includes(val) ? (val as AiProvider) : 'anthropic';
}

export async function setAiProvider(provider: AiProvider): Promise<void> {
	await upsertSetting('ai_provider', provider);
}

export async function getAiKey(provider: AiProvider): Promise<string> {
	const key = await getSetting(`${provider}_api_key`);
	if (key) return key;
	// Fallback: env var for anthropic (backwards compat)
	if (provider === 'anthropic') return ANTHROPIC_API_KEY;
	return '';
}

export async function setAiKey(provider: AiProvider, value: string): Promise<void> {
	await upsertSetting(`${provider}_api_key`, value);
}

export async function getBaseCurrency(): Promise<string> {
	return (await getSetting('base_currency')) || 'USD';
}

export async function setBaseCurrency(currency: string): Promise<void> {
	await upsertSetting('base_currency', currency.toUpperCase());
}
