import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Client-side logout is handled via the auth store
	// This redirect ensures the user ends up at the login page
	redirect(302, '/auth/login');
};
