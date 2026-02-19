import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	// Server-side auth state can be loaded here if needed
	// For now, we rely on client-side auth store
	return {};
};
