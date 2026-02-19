<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { goto } from '$app/navigation';

	let { children } = $props();

	async function handleLogout() {
		auth.clear();
		await goto('/auth/login');
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>MC Budget</title>
</svelte:head>

<div class="min-h-screen bg-base-200">
	<nav class="navbar bg-base-100 shadow-sm">
		<div class="flex-1">
			<a href="/" class="btn btn-ghost text-xl">MC Budget</a>
		</div>
		<div class="flex-none gap-2">
			{#if auth.isAuthenticated}
				<a href="/wallets" class="btn btn-ghost btn-sm">Wallets</a>
				<a href="/presets" class="btn btn-ghost btn-sm">Presets</a>
				<div class="dropdown dropdown-end">
					<div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar placeholder">
						<div class="bg-neutral text-neutral-content w-10 rounded-full">
							<span class="text-sm">{auth.user?.name?.charAt(0) || '?'}</span>
						</div>
					</div>
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<ul
						tabindex="0"
						class="menu menu-sm dropdown-content bg-base-100 rounded-box z-10 mt-3 w-52 p-2 shadow"
					>
						<li><span class="font-medium">{auth.user?.name}</span></li>
						<li><button onclick={handleLogout}>Logout</button></li>
					</ul>
				</div>
			{:else}
				<a href="/auth/login" class="btn btn-ghost btn-sm">Login</a>
				<a href="/auth/register" class="btn btn-primary btn-sm">Sign Up</a>
			{/if}
			<ThemeToggle />
		</div>
	</nav>

	<main class="container mx-auto px-4 py-8">
		{@render children()}
	</main>
</div>
