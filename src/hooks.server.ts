import { redirect, type Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { resolve } from '$app/paths';
import { env } from '$env/dynamic/public';
import PocketBase from 'pocketbase';
import { getPrivateInstance } from '$lib/server/settings';

const guestOnlyRoutes: string[] = [resolve('/auth/login'), resolve('/auth/register')];

function isProtectedRoute(pathname: string) {
	const walletsPath = resolve('/wallets');
	const presetsPath = resolve('/presets');
	const transactionsPath = resolve('/transactions');
	const reportsPath = resolve('/reports');
	const recurringPath = resolve('/recurring');
	const settingsPath = resolve('/settings');

	return (
		pathname === walletsPath ||
		pathname.startsWith(`${walletsPath}/`) ||
		pathname === presetsPath ||
		pathname.startsWith(`${presetsPath}/`) ||
		pathname === transactionsPath ||
		pathname.startsWith(`${transactionsPath}/`) ||
		pathname === reportsPath ||
		pathname.startsWith(`${reportsPath}/`) ||
		pathname === recurringPath ||
		pathname.startsWith(`${recurringPath}/`) ||
		pathname === settingsPath ||
		pathname.startsWith(`${settingsPath}/`)
	);
}

function isGuestOnlyRoute(pathname: string) {
	return guestOnlyRoutes.includes(pathname);
}

export const handle: Handle = async ({ event, resolve: resolveRequest }) => {
	event.locals.pb = new PocketBase(env.PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090');
	event.locals.pb.authStore.loadFromCookie(event.request.headers.get('cookie') ?? '');
	event.locals.user = null;

	try {
		if (event.locals.pb.authStore.isValid) {
			await event.locals.pb.collection('users').authRefresh();
			event.locals.user = event.locals.pb.authStore.record;
		}
	} catch {
		event.locals.pb.authStore.clear();
	}

	const pathname = event.url.pathname;
	const isAuthenticated = !!event.locals.user;
	const isApproved = event.locals.user?.approved === true;

	// A valid PocketBase token alone is not enough to access the tenant. Clear
	// sessions for accounts that have not yet been approved by an administrator.
	if (isAuthenticated && !isApproved && (await getPrivateInstance())) {
		event.locals.pb.authStore.clear();
		event.locals.user = null;

		if (isProtectedRoute(pathname)) {
			redirect(303, `${resolve('/auth/login')}?approval=required`);
		}
	}

	if (!event.locals.user && isProtectedRoute(pathname)) {
		redirect(303, resolve('/auth/login'));
	}

	if (event.locals.user && isGuestOnlyRoute(pathname)) {
		redirect(303, resolve('/wallets'));
	}

	const response = await resolveRequest(event);

	// httpOnly: true keeps the auth token out of client-side JS, reducing XSS token theft risk.
	// Note: PocketBase realtime/SSE subscriptions require httpOnly: false (JS must read the cookie
	// to authenticate the WebSocket). This app does not use realtime, so true is safe here.
	response.headers.set(
		'set-cookie',
		event.locals.pb.authStore.exportToCookie({ httpOnly: true, sameSite: 'Lax', secure: !dev })
	);

	return response;
};
