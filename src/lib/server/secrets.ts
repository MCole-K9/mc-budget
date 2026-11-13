import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';

// Stored format: enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64> (AES-256-GCM).
const PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

function getKey(): Buffer {
	const raw = env.SECRETS_KEY;
	if (!raw) {
		throw new Error(
			'SECRETS_KEY is not set. Generate one with `openssl rand -base64 32` and add it to the server environment.'
		);
	}
	const key = Buffer.from(raw, 'base64');
	if (key.length !== 32) throw new Error('SECRETS_KEY must be 32 bytes, base64-encoded.');
	return key;
}

/** True when SECRETS_KEY is set and valid, so encryptSecret will not throw. */
export function hasSecretsKey(): boolean {
	try {
		getKey();
		return true;
	} catch {
		return false;
	}
}

export function isEncryptedSecret(stored: string): boolean {
	return stored.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string {
	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv(ALGORITHM, getKey(), iv);
	const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/** Decrypts a stored value. A value without the `enc:v1:` prefix is legacy plaintext and is returned as-is. */
export function decryptSecret(stored: string): string {
	if (!isEncryptedSecret(stored)) return stored;
	const [iv, tag, ciphertext] = stored.slice(PREFIX.length).split(':');
	if (!iv || !tag || ciphertext === undefined) throw new Error('Malformed encrypted secret');
	const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, 'base64'));
	decipher.setAuthTag(Buffer.from(tag, 'base64'));
	return Buffer.concat([
		decipher.update(Buffer.from(ciphertext, 'base64')),
		decipher.final()
	]).toString('utf8');
}

/**
 * Reads a stored API key. Legacy plaintext is re-saved encrypted through `resave` when
 * SECRETS_KEY is set. A value that cannot be decrypted reads as "no key", so the admin
 * can save it again; the value itself is never logged.
 */
export async function readStoredSecret(
	stored: string,
	resave: (encrypted: string) => Promise<void>
): Promise<string> {
	if (!stored) return '';
	if (!isEncryptedSecret(stored)) {
		if (hasSecretsKey()) {
			try {
				await resave(encryptSecret(stored));
			} catch {
				console.error('Could not upgrade a plaintext API key to encrypted storage.');
			}
		}
		return stored;
	}
	try {
		return decryptSecret(stored);
	} catch {
		console.error(
			'A stored API key cannot be decrypted. Check SECRETS_KEY, or save the key again.'
		);
		return '';
	}
}
