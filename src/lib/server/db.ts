import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';

// Server-side PocketBase instance
export const pb = new PocketBase(PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090');

// Helper to set auth from cookie/token
export function setAuth(token: string | null) {
	if (token) {
		pb.authStore.save(token, null);
	} else {
		pb.authStore.clear();
	}
}
