import { getPb } from './db';

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
