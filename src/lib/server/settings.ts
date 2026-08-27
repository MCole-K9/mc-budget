import { withAdminPb } from './db';
import { setTenantCollectionRules } from './tenantAccess';
import { env as privateEnv } from '$env/dynamic/private';
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

/**
 * Private instances require administrator approval before an account can use tenant data.
 * The default is private to preserve the existing access policy until an admin opts out.
 */
export async function getPrivateInstance(): Promise<boolean> {
	return (await getSetting('private_instance')) !== 'false';
}

export async function setPrivateInstance(isPrivateInstance: boolean): Promise<void> {
	if (isPrivateInstance) {
		// Restrict data access before enabling the application-level gate.
		await setTenantCollectionRules(true);
		await upsertSetting('private_instance', 'true');
		return;
	}

	const wasPrivate = await getPrivateInstance();
	// Allow the application-level gate to open before relaxing data rules. If the atomic import
	// fails or its outcome is indeterminate, recovery reasserts restrictive rules before restoring
	// the prior private setting.
	await upsertSetting('private_instance', 'false');
	try {
		await setTenantCollectionRules(false);
	} catch (error) {
		if (wasPrivate) {
			// An HTTP error can arrive after PocketBase commits the public import. Reassert the
			// restrictive data boundary before reporting this instance as private again.
			await setTenantCollectionRules(true);
			await upsertSetting('private_instance', 'true');
		}
		throw error;
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
	if (provider === 'anthropic') return privateEnv.ANTHROPIC_API_KEY ?? '';
	return '';
}

export async function setAiKey(provider: AiProvider, value: string): Promise<void> {
	await upsertSetting(`${provider}_api_key`, value);
}
