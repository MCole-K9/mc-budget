import { beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory stand-in for one PocketBase collection, keyed by `skey`.
const rows = new Map<string, { id: string; value: string }>();
const update = vi.fn(async (id: string, data: { value: string }) => {
	for (const row of rows.values()) if (row.id === id) row.value = data.value;
});
const create = vi.fn();
const fakePb = {
	authStore: { record: { id: 'user1' } },
	collection: () => ({
		getFirstListItem: async (filter: string) => {
			const row = rows.get(/skey="([^"]+)"/.exec(filter)![1]);
			if (!row) throw new Error('404');
			return row;
		},
		update,
		create
	})
};

vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('./tenantAccess', () => ({ setTenantCollectionRules: vi.fn() }));
vi.mock('./db', () => ({
	getPb: () => fakePb,
	withAdminPb: (fn: (pb: typeof fakePb) => unknown) => fn(fakePb)
}));

const { replaceUserSettingIfUnchanged } = await import('./userSettings');
const { replaceSettingIfUnchanged } = await import('./settings');

describe.each([
	['user setting', replaceUserSettingIfUnchanged],
	['instance setting', replaceSettingIfUnchanged]
])('lazy upgrade write for a %s', (_name, replace) => {
	beforeEach(() => {
		rows.clear();
		update.mockClear();
		create.mockClear();
	});

	it('replaces the value while it is unchanged', async () => {
		rows.set('openai_api_key', { id: 'r1', value: 'sk-legacy' });
		await replace('openai_api_key', 'sk-legacy', 'enc:v1:a:b:c');
		expect(rows.get('openai_api_key')!.value).toBe('enc:v1:a:b:c');
	});

	it('keeps a key that was saved after the legacy value was read', async () => {
		rows.set('openai_api_key', { id: 'r1', value: 'enc:v1:new' });
		await replace('openai_api_key', 'sk-legacy', 'enc:v1:old');
		expect(rows.get('openai_api_key')!.value).toBe('enc:v1:new');
		expect(update).not.toHaveBeenCalled();
	});

	it('does not bring back a key that was cleared after it was read', async () => {
		await replace('openai_api_key', 'sk-legacy', 'enc:v1:old');
		expect(rows.has('openai_api_key')).toBe(false);
		expect(create).not.toHaveBeenCalled();
	});
});
