import { z } from 'zod';
import { command, form, getRequestEvent } from '$app/server';
import { redirect } from '@sveltejs/kit';
import { pb } from '$lib/server/db';
import {
	LoginInputSchema,
	RegisterInputSchema,
	UserSchema
} from '$lib/schemas/budget';

const COOKIE_NAME = 'pb_auth';
const COOKIE_OPTS = {
	path: '/',
	httpOnly: true,
	maxAge: 60 * 60 * 24 * 30,
	sameSite: 'lax'
} as const;

function authCookieValue() {
	return JSON.stringify({ token: pb.authStore.token, record: pb.authStore.record });
}

/**
 * Login with email and password
 */
export const login = form(LoginInputSchema, async (input) => {
	await pb.collection('users').authWithPassword(input.email, input.password);
	getRequestEvent().cookies.set(COOKIE_NAME, authCookieValue(), COOKIE_OPTS);
	redirect(303, '/wallets');
});

/**
 * Register a new user
 */
export const register = form(RegisterInputSchema, async (input) => {
	await pb.collection('users').create({
		email: input.email,
		password: input.password,
		passwordConfirm: input.passwordConfirm,
		name: input.name || ''
	}).catch(err => {
		if (err.response?.data?.email?.code === 'validation_not_unique') {
			throw new Error('An account with this email already exists');
		}
		throw new Error('Failed to create account');
	});

	await pb.collection('users').authWithPassword(input.email, input.password);
	getRequestEvent().cookies.set(COOKIE_NAME, authCookieValue(), COOKIE_OPTS);
	redirect(303, '/wallets');
});

/**
 * Logout the current user
 */
export const logout = command(async () => {
	pb.authStore.clear();
	getRequestEvent().cookies.delete(COOKIE_NAME, { path: '/' });
	return { success: true };
});

/**
 * Refresh the current auth session
 */
export const refreshAuth = command(async () => {
	if (!pb.authStore.isValid) return null;

	try {
		const authData = await pb.collection('users').authRefresh();
		return {
			user: authData.record,
			token: pb.authStore.token
		};
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
		const user = pb.authStore.record;
		if (!user) {
			throw new Error('Not authenticated');
		}

		const record = await pb.collection('users').update(user.id, data);
		return record;
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
		const user = pb.authStore.record;
		if (!user) {
			throw new Error('Not authenticated');
		}

		await pb.collection('users').update(user.id, {
			oldPassword,
			password: newPassword,
			passwordConfirm: newPassword
		});

		return { success: true };
	}
);
