import { getPb } from './db';
import { encryptSecret, readStoredSecret } from './secrets';
import { aiKeySetting, type AiProvider } from '$lib/settings';

// Allowlist: only lowercase letters, digits, and underscores.
function assertSafeKey(key: string): void {
	if (!/^[a-z0-9_]+$/.test(key)) throw new Error(`Invalid settings key: "${key}"`);
}

export async function getUserSetting(key: string): Promise<string> {
	assertSafeKey(key);
	const pb = getPb();
	try {
		const record = await pb
			.collection('user_settings')
			.getFirstListItem(`skey="${key}"`, { requestKey: null });
		return String(record['value'] || '');
	} catch {
		return '';
	}
}

export async function deleteUserSetting(key: string): Promise<void> {
	assertSafeKey(key);
	const pb = getPb();
	try {
		const record = await pb
			.collection('user_settings')
			.getFirstListItem(`skey="${key}"`, { requestKey: null });
		await pb.collection('user_settings').delete(record.id);
	} catch {
		// Already doesn't exist — nothing to do
	}
}

export async function setUserSetting(key: string, value: string): Promise<void> {
	assertSafeKey(key);
	const pb = getPb();
	const userId = pb.authStore.record?.id;
	if (!userId) throw new Error('Not authenticated');

	let existing: { id: string } | null = null;
	try {
		existing = await pb
			.collection('user_settings')
			.getFirstListItem(`skey="${key}"`, { requestKey: null });
	} catch {
		// Record does not exist yet — will create below
	}

	if (existing) {
		await pb.collection('user_settings').update(existing.id, { value });
	} else {
		await pb.collection('user_settings').create({ user: userId, skey: key, value });
	}
}

/**
 * Replaces a setting only while it still holds `expected`. Never creates a row, so a lazy
 * upgrade cannot overwrite a key saved, or bring back a key cleared, after it was read.
 */
export async function replaceUserSettingIfUnchanged(
	key: string,
	expected: string,
	value: string
): Promise<void> {
	assertSafeKey(key);
	const pb = getPb();
	let record: { id: string; value?: unknown };
	try {
		record = await pb
			.collection('user_settings')
			.getFirstListItem(`skey="${key}"`, { requestKey: null });
	} catch {
		return; // Cleared since it was read
	}
	if (record.value !== expected) return; // Replaced since it was read
	await pb.collection('user_settings').update(record.id, { value });
}

export async function getUserAiKey(provider: AiProvider): Promise<string> {
	const key = aiKeySetting(provider);
	const stored = await getUserSetting(key);
	return readStoredSecret(stored, (encrypted) =>
		replaceUserSettingIfUnchanged(key, stored, encrypted)
	);
}

export async function setUserAiKey(provider: AiProvider, value: string): Promise<void> {
	await setUserSetting(aiKeySetting(provider), encryptSecret(value));
}

export async function deleteUserAiKey(provider: AiProvider): Promise<void> {
	await deleteUserSetting(aiKeySetting(provider));
}
