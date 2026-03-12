import type { User } from '$lib/types/budget';

class AuthStore {
	user = $state.raw<User | null>(null);
	isLoading = $state(true);

	get isAuthenticated() {
		return !!this.user;
	}

	setUser(user: unknown) {
		this.user = user as User | null;
		this.isLoading = false;
	}

	clear() {
		this.user = null;
		this.isLoading = false;
	}
}

export const auth = new AuthStore();
