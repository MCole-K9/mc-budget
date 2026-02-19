import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';

const pb = new PocketBase(PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090');

export default pb;

export function isAuthenticated(): boolean {
	return pb.authStore.isValid;
}

export function getCurrentUser() {
	return pb.authStore.record;
}

export function getAuthToken(): string | null {
	return pb.authStore.token;
}

export async function logout() {
	pb.authStore.clear();
}
