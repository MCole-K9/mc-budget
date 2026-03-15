<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { logout } from '$lib/auth.remote';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let { data, children } = $props();

	$effect(() => {
		auth.setUser(data.user ?? null);
	});

	async function handleLogout() {
		await logout();
		auth.clear();
		await goto(resolve('/auth/login'));
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>MC Budget</title>
</svelte:head>

<div class="min-h-screen bg-base-200">
	<nav class="navbar bg-base-100 border-b border-base-200">
		<div class="flex-1">
			<a href={resolve('/')} class="btn btn-ghost text-xl">MC Budget</a>
		</div>
		<div class="flex flex-none items-center gap-2">
			{#if auth.isAuthenticated}
				<!-- Desktop nav links -->
				<div class="hidden sm:flex gap-1">
					<a href={resolve('/wallets')} class="btn btn-ghost btn-sm">Wallets</a>
					<a href={resolve('/transactions')} class="btn btn-ghost btn-sm">Transactions</a>
					<a href={resolve('/reports')} class="btn btn-ghost btn-sm">Reports</a>
					<a href={resolve('/presets')} class="btn btn-ghost btn-sm">Presets</a>
				</div>

				<!-- Avatar dropdown (desktop: name + links hidden; mobile: includes nav links) -->
				<div class="dropdown dropdown-end">
					<div tabindex="0" role="button" class="btn btn-ghost btn-circle">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
							<path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
						</svg>
					</div>
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<ul
						tabindex="0"
						class="menu menu-sm dropdown-content bg-base-100 rounded-box z-10 mt-3 w-52 p-2 shadow"
					>
						<li><span class="font-medium">{auth.user?.name}</span></li>
						<!-- Mobile-only nav links -->
						<li class="sm:hidden"><a href={resolve('/wallets')}>Wallets</a></li>
						<li class="sm:hidden"><a href={resolve('/transactions')}>Transactions</a></li>
						<li class="sm:hidden"><a href={resolve('/reports')}>Reports</a></li>
						<li class="sm:hidden"><a href={resolve('/presets')}>Presets</a></li>
						<li class="sm:hidden divider my-0"></li>
						<li><a href={resolve('/settings')}>Settings</a></li>
						<li><button onclick={handleLogout}>Logout</button></li>
					</ul>
				</div>
			{:else}
				<a href={resolve('/auth/login')} class="btn btn-ghost btn-sm">Login</a>
				<a href={resolve('/auth/register')} class="btn btn-primary btn-sm">Sign Up</a>
			{/if}
			<ThemeToggle />
		</div>
	</nav>

	<main class="container mx-auto px-4 py-8">
		{@render children()}
	</main>
</div>
