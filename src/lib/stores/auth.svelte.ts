import { browser } from '$app/environment';
import pb from '$lib/api/pocketbase';
import type { User } from '$lib/types/budget';

class AuthStore {
	user = $state.raw<User | null>(null);
	isLoading = $state(true);

	get isAuthenticated() {
		return !!this.user;
	}

	constructor() {
		if (browser) {
			if (pb.authStore.isValid && pb.authStore.record) {
				this.user = pb.authStore.record as unknown as User;
			}
			this.isLoading = false;

			pb.authStore.onChange(() => {
				if (pb.authStore.isValid && pb.authStore.record) {
					this.user = pb.authStore.record as unknown as User;
				} else {
					this.user = null;
				}
			});
		}
	}

	setUser(newUser: unknown) {
		this.user = newUser as User | null;
	}

	clear() {
		this.user = null;
		pb.authStore.clear();
	}
}

export const auth = new AuthStore();
