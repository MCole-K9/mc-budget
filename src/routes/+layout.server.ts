import type { LayoutServerLoad } from './$types';
import { pb } from '$lib/server/db';
import { UserSchema } from '$lib/schemas/budget';

export const load: LayoutServerLoad = () => {
	if (pb.authStore.isValid && pb.authStore.record) {
		try {
			return { user: UserSchema.parse(pb.authStore.record) };
		} catch {
			return { user: null };
		}
	}
	return { user: null };
};
