import PocketBase from 'pocketbase';
import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/public';
import { PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD } from '$env/static/private';

const PB_URL = env.PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';

// Used in prerender (build-time, no request context)
export const pb = new PocketBase(PB_URL);

// Used inside query/command/form handlers — returns the per-request instance
export function getPb() {
	return getRequestEvent().locals.pb;
}

// Admin-authenticated instance for server-only operations (e.g. app_settings)
let _adminPb: PocketBase | null = null;
let _adminAuthExpiry = 0;
let _adminAuthPromise: Promise<void> | null = null;

export async function getAdminPb(): Promise<PocketBase> {
	if (!_adminPb) {
		_adminPb = new PocketBase(PB_URL);
		_adminPb.autoCancellation(false);
	}

	if (Date.now() > _adminAuthExpiry) {
		if (!_adminAuthPromise) {
			_adminAuthPromise = (async () => {
				_adminPb!.authStore.clear();
				await _adminPb!.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
				_adminAuthExpiry = Date.now() + 11 * 60 * 60 * 1000; // re-auth after 11h (tokens last 12h)
			})().finally(() => {
				_adminAuthPromise = null;
			});
		}
		await _adminAuthPromise;
	}
	return _adminPb;
}

/**
 * Runs `fn` with an admin-authenticated PocketBase instance.
 * If the server rejects the token (e.g., DB was wiped without restarting the server),
 * the stale token is cleared and the call is retried once after re-authenticating.
 */
export async function withAdminPb<T>(fn: (pb: PocketBase) => Promise<T>): Promise<T> {
	try {
		return await fn(await getAdminPb());
	} catch (e: unknown) {
		const status = (e as { status?: number })?.status;
		if (status === 401 || status === 403) {
			_adminAuthExpiry = 0;
			_adminPb?.authStore.clear();
			return fn(await getAdminPb());
		}
		throw e;
	}
}
