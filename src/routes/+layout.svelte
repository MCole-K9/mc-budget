<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { logout } from '$lib/auth.remote';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { data, children } = $props();

	$effect(() => {
		auth.setUser(data.user ?? null);
	});

	async function handleLogout() {
		await logout();
		auth.clear();
		await goto(resolve('/auth/login'));
	}

	type NavItem = { href: string; label: string; short: string; icon: IconName };

	const mainNav: NavItem[] = [
		{ href: resolve('/'), label: 'Overview', short: 'Home', icon: 'home' },
		{ href: resolve('/wallets'), label: 'Wallets', short: 'Wallets', icon: 'wallet' },
		{ href: resolve('/transactions'), label: 'Transactions', short: 'Activity', icon: 'list' },
		{ href: resolve('/recurring'), label: 'Recurring', short: 'Recurring', icon: 'repeat' },
		{ href: resolve('/reports'), label: 'Reports', short: 'Reports', icon: 'chart' }
	];

	const secondaryNav: NavItem[] = [
		{ href: resolve('/presets'), label: 'Budget presets', short: 'Presets', icon: 'layers' },
		{ href: resolve('/settings'), label: 'Settings', short: 'Settings', icon: 'settings' }
	];

	function isActive(href: string): boolean {
		const path = page.url.pathname;
		if (href === resolve('/')) return path === href;
		return path === href || path.startsWith(`${href}/`);
	}

	// Before hydration the auth store is still loading, so fall back to the server's user
	// to render the right shell on the first paint
	const user = $derived(auth.isLoading ? data.user : auth.user);

	const initials = $derived(
		(user?.name || user?.email || '?')
			.split(/[\s@]+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part: string) => part[0]?.toUpperCase())
			.join('')
	);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>MC Budget</title>
</svelte:head>

<!-- eslint-disable svelte/no-navigation-without-resolve -- nav hrefs are built with resolve() above -->
{#snippet logo()}
	<a href={resolve('/')} class="flex items-center gap-2.5 font-semibold tracking-tight">
		<span
			class="grid size-8 place-items-center rounded-lg bg-primary text-primary-content shadow-sm shadow-primary/30"
		>
			<Icon name="wallet" class="size-[18px]" />
		</span>
		<span class="text-[1.05rem]">MC Budget</span>
	</a>
{/snippet}

{#snippet navLink(item: NavItem)}
	{@const active = isActive(item.href)}
	<a
		href={item.href}
		aria-current={active ? 'page' : undefined}
		class={[
			'flex items-center gap-3 rounded-field px-3 py-2 text-sm font-medium transition-colors',
			active
				? 'bg-primary/10 text-primary'
				: 'text-base-content/65 hover:bg-base-200 hover:text-base-content'
		]}
	>
		<Icon name={item.icon} class="size-[18px]" />
		{item.label}
	</a>
{/snippet}

{#snippet userMenuItems()}
	<li class="menu-title px-2 py-1.5">
		<span class="block truncate text-sm font-semibold text-base-content">{user?.name}</span>
		<span class="block truncate text-xs font-normal text-base-content/50">{user?.email}</span>
	</li>
	{#each secondaryNav as item (item.href)}
		<li>
			<a href={item.href}><Icon name={item.icon} class="size-4" />{item.label}</a>
		</li>
	{/each}
	<li class="mt-1 border-t border-base-300/70 pt-1">
		<button class="text-error" onclick={handleLogout}>
			<Icon name="logout" class="size-4" />Sign out
		</button>
	</li>
{/snippet}

{#if user}
	<div class="min-h-dvh lg:pl-64">
		<!-- Desktop sidebar -->
		<aside
			class="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-base-300/70 bg-base-100 lg:flex"
		>
			<div class="flex h-16 items-center px-5">{@render logo()}</div>

			<nav class="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2" aria-label="Main">
				{#each mainNav as item (item.href)}
					{@render navLink(item)}
				{/each}

				<p class="mt-6 mb-1 px-3 eyebrow">Manage</p>
				{#each secondaryNav as item (item.href)}
					{@render navLink(item)}
				{/each}

				<a
					href={resolve('/wallets/new')}
					class="btn mt-6 justify-start gap-3 btn-soft btn-sm btn-primary"
				>
					<Icon name="plus" class="size-4" />
					New wallet
				</a>
			</nav>

			<div class="flex items-center gap-2 border-t border-base-300/70 p-3">
				<div class="dropdown dropdown-top min-w-0 flex-1">
					<div
						tabindex="0"
						role="button"
						class="flex w-full items-center gap-3 rounded-field p-2 text-left transition-colors hover:bg-base-200"
					>
						<span
							class="grid size-9 shrink-0 place-items-center rounded-full bg-base-300 text-xs font-semibold"
						>
							{initials}
						</span>
						<span class="min-w-0">
							<span class="block truncate text-sm font-medium">{user?.name}</span>
							<span class="block truncate text-xs text-base-content/50">{user?.email}</span>
						</span>
					</div>
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<ul
						tabindex="0"
						class="dropdown-content menu z-40 mb-2 w-60 rounded-box border border-base-300/70 bg-base-100 p-1.5 shadow-xl"
					>
						{@render userMenuItems()}
					</ul>
				</div>
				<ThemeToggle />
			</div>
		</aside>

		<!-- Mobile top bar -->
		<header
			class="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-base-300/70 bg-base-100/85 px-4 backdrop-blur lg:hidden"
		>
			{@render logo()}
			<div class="flex items-center gap-1">
				<ThemeToggle />
				<div class="dropdown dropdown-end">
					<div
						tabindex="0"
						role="button"
						class="btn btn-circle btn-ghost btn-sm"
						aria-label="Account menu"
					>
						<span
							class="grid size-8 place-items-center rounded-full bg-base-300 text-xs font-semibold"
						>
							{initials}
						</span>
					</div>
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<ul
						tabindex="0"
						class="dropdown-content menu z-40 mt-2 w-60 rounded-box border border-base-300/70 bg-base-100 p-1.5 shadow-xl"
					>
						{@render userMenuItems()}
					</ul>
				</div>
			</div>
		</header>

		<main class="mx-auto w-full max-w-5xl px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
			{@render children()}
		</main>

		<!-- Mobile bottom navigation -->
		<nav
			class="dock dock-sm z-30 border-t border-base-300/70 bg-base-100/95 backdrop-blur lg:hidden"
			aria-label="Main"
		>
			{#each mainNav as item (item.href)}
				{@const active = isActive(item.href)}
				<a
					href={item.href}
					aria-current={active ? 'page' : undefined}
					class={[active ? 'dock-active text-primary' : 'text-base-content/55']}
				>
					<Icon name={item.icon} class="size-5" />
					<span class="dock-label">{item.short}</span>
				</a>
			{/each}
		</nav>
	</div>
{:else}
	<div class="flex min-h-dvh flex-col">
		<header class="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
			{@render logo()}
			<div class="flex items-center gap-1 sm:gap-2">
				<ThemeToggle />
				<a href={resolve('/auth/login')} class="btn btn-ghost btn-sm">Sign in</a>
				<a href={resolve('/auth/register')} class="btn btn-sm btn-primary">Get started</a>
			</div>
		</header>
		<main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
			{@render children()}
		</main>
	</div>
{/if}
