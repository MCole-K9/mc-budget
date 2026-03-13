import PocketBase from 'pocketbase';
import { getRequestEvent } from '$app/server';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';

const PB_URL = PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';

// Used in prerender (build-time, no request context)
export const pb = new PocketBase(PB_URL);

// Used inside query/command/form handlers — returns the per-request instance
export function getPb() {
	return getRequestEvent().locals.pb;
}
