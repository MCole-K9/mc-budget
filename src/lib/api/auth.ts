import pb from './pocketbase';
import type { User, LoginInput, RegisterInput } from '$lib/types/budget';

export async function login(input: LoginInput): Promise<User> {
	const authData = await pb.collection('users').authWithPassword(input.email, input.password);
	return authData.record as unknown as User;
}

export async function register(input: RegisterInput): Promise<User> {
	if (input.password !== input.passwordConfirm) {
		throw new Error('Passwords do not match');
	}

	const record = await pb.collection('users').create({
		email: input.email,
		password: input.password,
		passwordConfirm: input.passwordConfirm,
		name: input.name
	});

	// Auto-login after registration
	await pb.collection('users').authWithPassword(input.email, input.password);

	return record as unknown as User;
}

export async function logout(): Promise<void> {
	pb.authStore.clear();
}

export function isAuthenticated(): boolean {
	return pb.authStore.isValid;
}

export function getCurrentUser(): User | null {
	if (!pb.authStore.isValid) return null;
	return pb.authStore.record as unknown as User;
}

export async function refreshAuth(): Promise<User | null> {
	if (!pb.authStore.isValid) return null;

	try {
		const authData = await pb.collection('users').authRefresh();
		return authData.record as unknown as User;
	} catch {
		pb.authStore.clear();
		return null;
	}
}

export async function updateProfile(data: { name?: string; avatar?: File }): Promise<User> {
	const user = getCurrentUser();
	if (!user) {
		throw new Error('Not authenticated');
	}

	const formData = new FormData();
	if (data.name) formData.append('name', data.name);
	if (data.avatar) formData.append('avatar', data.avatar);

	const record = await pb.collection('users').update(user.id, formData);
	return record as unknown as User;
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
	const user = getCurrentUser();
	if (!user) {
		throw new Error('Not authenticated');
	}

	await pb.collection('users').update(user.id, {
		oldPassword,
		password: newPassword,
		passwordConfirm: newPassword
	});
}
