import { z } from 'zod';
import { command, form, getRequestEvent } from '$app/server';
import { redirect, invalid } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getPb } from '$lib/server/db';
import { LoginInputSchema, RegisterInputSchema } from '$lib/schemas/budget';

/**
 * Login with email and password
 */
export const login = form(LoginInputSchema, async (input) => {
	try {
		await getPb().collection('users').authWithPassword(input.email, input.password);
	} catch {
		invalid('Invalid email or password');
	}
	redirect(303, resolve('/wallets'));
});

/**
 * Register a new user
 */
export const register = form(RegisterInputSchema, async (input) => {
	try {
		await getPb().collection('users').create({
			email: input.email,
			password: input.password,
			passwordConfirm: input.passwordConfirm,
			name: input.name || ''
		});
	} catch (err: any) {
		if (err.response?.data?.email?.code === 'validation_not_unique') {
			invalid('An account with this email already exists');
		}
		invalid('Failed to create account');
	}

	await getPb().collection('users').authWithPassword(input.email, input.password);
	redirect(303, resolve('/wallets'));
});

/**
 * Logout the current user
 */
export const logout = command(async () => {
	getPb().authStore.clear();
	return { success: true };
});

/**
 * Refresh the current auth session
 */
export const refreshAuth = command(async () => {
	const pb = getPb();
	if (!pb.authStore.isValid) return null;

	try {
		const authData = await pb.collection('users').authRefresh();
		return { user: authData.record, token: pb.authStore.token };
	} catch {
		pb.authStore.clear();
		return null;
	}
});

/**
 * Update user profile
 */
export const updateProfile = command(
	z.object({ name: z.string().optional() }),
	async (data) => {
		const pb = getPb();
		const user = pb.authStore.record;
		if (!user) throw new Error('Not authenticated');
		return await pb.collection('users').update(user.id, data);
	}
);

/**
 * Change user password
 */
export const changePassword = command(
	z.object({
		oldPassword: z.string(),
		newPassword: z.string().min(8, 'Password must be at least 8 characters')
	}),
	async ({ oldPassword, newPassword }) => {
		const pb = getPb();
		const user = pb.authStore.record;
		if (!user) throw new Error('Not authenticated');

		await pb.collection('users').update(user.id, {
			oldPassword,
			password: newPassword,
			passwordConfirm: newPassword
		});
		return { success: true };
	}
);
