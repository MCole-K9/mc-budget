import { z } from 'zod';
import { command, form } from '$app/server';
import { pb } from '$lib/server/db';
import {
	LoginInputSchema,
	RegisterInputSchema,
	UserSchema
} from '$lib/schemas/budget';

/**
 * Login with email and password
 */
export const login = form(LoginInputSchema, async (input) => {
	const authData = await pb
		.collection('users')
		.authWithPassword(input.email, input.password);

	return {
		user: UserSchema.parse(authData.record),
		token: pb.authStore.token
	};
});

/**
 * Register a new user
 */
export const register = form(RegisterInputSchema, async (input) => {
	const record = await pb.collection('users').create({
		email: input.email,
		password: input.password,
		passwordConfirm: input.passwordConfirm,
		name: input.name
	});

	// Auto-login after registration
	await pb.collection('users').authWithPassword(input.email, input.password);

	return {
		user: UserSchema.parse(record),
		token: pb.authStore.token
	};
});

/**
 * Logout the current user
 */
export const logout = command(async () => {
	pb.authStore.clear();
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
			user: UserSchema.parse(authData.record),
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
		return UserSchema.parse(record);
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
