import { browser } from '$app/environment';
import pb from '$lib/api/pocketbase';
import type { User } from '$lib/types/budget';

function createAuthStore() {
	let user = $state<User | null>(null);
	let isLoading = $state(true);

	if (browser) {
		// Initialize from PocketBase auth store
		if (pb.authStore.isValid && pb.authStore.record) {
			user = pb.authStore.record as unknown as User;
		}
		isLoading = false;

		// Listen for auth changes
		pb.authStore.onChange(() => {
			if (pb.authStore.isValid && pb.authStore.record) {
				user = pb.authStore.record as unknown as User;
			} else {
				user = null;
			}
		});
	}

	return {
		get user() {
			return user;
		},
		get isAuthenticated() {
			return !!user;
		},
		get isLoading() {
			return isLoading;
		},
		setUser(newUser: User | null) {
			user = newUser;
		},
		clear() {
			user = null;
			pb.authStore.clear();
		}
	};
}

export const auth = createAuthStore();

export function isAuthenticated(): boolean {
	return auth.isAuthenticated;
}

export function getCurrentUser(): User | null {
	return auth.user;
}
