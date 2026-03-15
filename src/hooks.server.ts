import { redirect, type Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { resolve } from '$app/paths';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import PocketBase from 'pocketbase';

const guestOnlyRoutes: string[] = [resolve('/auth/login'), resolve('/auth/register')];

function isProtectedRoute(pathname: string) {
	const walletsPath = resolve('/wallets');
	const presetsPath = resolve('/presets');
	const transactionsPath = resolve('/transactions');
	const reportsPath = resolve('/reports');
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
		pathname === settingsPath ||
		pathname.startsWith(`${settingsPath}/`)
	);
}

function isGuestOnlyRoute(pathname: string) {
	return guestOnlyRoutes.includes(pathname);
}

export const handle: Handle = async ({ event, resolve: resolveRequest }) => {
	event.locals.pb = new PocketBase(PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090');
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

	if (!isAuthenticated && isProtectedRoute(pathname)) {
		redirect(303, resolve('/auth/login'));
	}

	if (isAuthenticated && isGuestOnlyRoute(pathname)) {
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
