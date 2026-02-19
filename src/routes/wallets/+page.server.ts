import type { PageServerLoad } from './$types';
import type { Wallet } from '$lib/types/budget';

export const load: PageServerLoad = async () => {
	// Wallets are loaded client-side via the API
	// This allows proper authentication handling
	return {
		wallets: [] as Wallet[],
		error: null as string | null
	};
};
