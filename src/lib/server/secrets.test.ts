import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnv: Record<string, string | undefined> = {};
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

const { decryptSecret, encryptSecret, readStoredSecret } = await import('./secrets');

const newKey = () => randomBytes(32).toString('base64');

describe('secrets', () => {
	beforeEach(() => {
		mockEnv.SECRETS_KEY = newKey();
	});

	it('round-trips a value', () => {
		const stored = encryptSecret('sk-test-123');
		expect(stored).toMatch(/^enc:v1:[^:]+:[^:]+:[^:]+$/);
		expect(stored).not.toContain('sk-test-123');
		expect(decryptSecret(stored)).toBe('sk-test-123');
	});

	it('passes legacy plaintext through unchanged', () => {
		expect(decryptSecret('sk-legacy-plain')).toBe('sk-legacy-plain');
	});

	it('throws on tampered ciphertext', () => {
		const [prefix, version, iv, tag, ct] = encryptSecret('sk-test-123').split(':');
		const bytes = Buffer.from(ct, 'base64');
		bytes[0] ^= 0xff;
		const tampered = [prefix, version, iv, tag, bytes.toString('base64')].join(':');
		expect(() => decryptSecret(tampered)).toThrow();
	});

	it('throws with the wrong key', () => {
		const stored = encryptSecret('sk-test-123');
		mockEnv.SECRETS_KEY = newKey();
		expect(() => decryptSecret(stored)).toThrow();
	});
});

describe('readStoredSecret', () => {
	beforeEach(() => {
		mockEnv.SECRETS_KEY = newKey();
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	it('decrypts an encrypted value without re-saving', async () => {
		const resave = vi.fn(async () => {});
		expect(await readStoredSecret(encryptSecret('sk-1'), resave)).toBe('sk-1');
		expect(resave).not.toHaveBeenCalled();
	});

	it('re-saves legacy plaintext encrypted and returns it', async () => {
		let saved = '';
		const value = await readStoredSecret('sk-legacy', async (encrypted) => {
			saved = encrypted;
		});
		expect(value).toBe('sk-legacy');
		expect(saved.startsWith('enc:v1:')).toBe(true);
		expect(decryptSecret(saved)).toBe('sk-legacy');
	});

	it('returns legacy plaintext without re-saving when SECRETS_KEY is missing or invalid', async () => {
		const resave = vi.fn(async () => {});
		mockEnv.SECRETS_KEY = undefined;
		expect(await readStoredSecret('sk-legacy', resave)).toBe('sk-legacy');
		mockEnv.SECRETS_KEY = Buffer.from('too-short').toString('base64');
		expect(await readStoredSecret('sk-legacy', resave)).toBe('sk-legacy');
		expect(resave).not.toHaveBeenCalled();
	});

	it('still returns legacy plaintext when the re-save fails', async () => {
		const value = await readStoredSecret('sk-legacy', async () => {
			throw new Error('db down');
		});
		expect(value).toBe('sk-legacy');
	});

	it('reads an undecryptable value as no key and does not log the value', async () => {
		const stored = encryptSecret('sk-secret-value');
		mockEnv.SECRETS_KEY = newKey();
		expect(await readStoredSecret(stored, async () => {})).toBe('');
		const logged = vi.mocked(console.error).mock.calls.flat().join(' ');
		expect(logged).not.toContain('sk-secret-value');
		expect(logged).not.toContain(stored);
	});

	it('returns empty for an empty stored value', async () => {
		expect(await readStoredSecret('', async () => {})).toBe('');
	});
});
