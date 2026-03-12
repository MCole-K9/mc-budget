import type { Handle } from '@sveltejs/kit';
import { pb } from '$lib/server/db';

export const handle: Handle = async ({ event, resolve }) => {
	pb.authStore.loadFromCookie(event.request.headers.get('cookie') ?? '');
	return resolve(event);
};
