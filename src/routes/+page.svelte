<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { getWallets } from '$lib/wallets.remote';
	import { getAllTransactionsPaged } from '$lib/transactions.remote';
	import Button from '$lib/components/Button.svelte';
	import WalletCard from '$lib/components/WalletCard.svelte';
	import Card from '$lib/components/Card.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	const [wallets, recent] = $derived(
		auth.isAuthenticated
			? await Promise.all([getWallets(), getAllTransactionsPaged({ page: 1, perPage: 10 })])
			: [[], { items: [], totalItems: 0, totalPages: 0, page: 1 }]
	);

	type TxItem = (typeof recent.items)[number];

	const grouped = $derived(
		recent.items.reduce<{ date: string; items: TxItem[] }[]>((acc, tx) => {
			const last = acc[acc.length - 1];
			if (last?.date === tx.date) last.items.push(tx);
			else acc.push({ date: tx.date, items: [tx] });
			return acc;
		}, [])
	);

	function getGreeting(): string {
		const h = new Date().getHours();
		if (h < 12) return 'Good morning';
		if (h < 17) return 'Good afternoon';
		return 'Good evening';
	}

	function formatToday(): string {
		return new Date().toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatCurrency(amount: number, currency: string): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(
			amount
		);
	}

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr.split('T')[0] + 'T00:00:00');
		const now = new Date();
		const yesterday = new Date(now);
		yesterday.setDate(now.getDate() - 1);
		if (d.toDateString() === now.toDateString()) return 'Today';
		if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
		return d.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			...(d.getFullYear() !== now.getFullYear() && { year: 'numeric' })
		});
	}
</script>

<svelte:head>
	<title>MC Budget</title>
</svelte:head>

<div class="max-w-4xl mx-auto">
	{#if auth.isAuthenticated}
		<!-- Header -->
		<div class="flex justify-between items-start mb-6">
			<div>
				<h1 class="text-2xl font-bold">{getGreeting()}, {auth.user?.name}!</h1>
				<p class="text-sm text-base-content/50 mt-0.5">{formatToday()}</p>
			</div>
			<a href={resolve('/wallets/new')}>
				<Button variant="primary" size="sm">+ New Wallet</Button>
			</a>
		</div>

		{#if wallets.length === 0}
			<div class="text-center py-16">
				<p class="text-base-content/70 mb-4 text-lg">No wallets yet — create one to get started</p>
				<a href={resolve('/wallets/new')}>
					<Button variant="primary" size="lg">Create Your First Wallet</Button>
				</a>
			</div>
		{:else}
			<!-- Wallets -->
			<section class="mb-8">
				<div class="flex items-center justify-between mb-3">
					<h2 class="text-xs font-semibold text-base-content/40 uppercase tracking-widest">
						Wallets
					</h2>
					{#if wallets.length > 4}
						<a href={resolve('/wallets')} class="text-sm link link-primary">
							View all {wallets.length} &rarr;
						</a>
					{/if}
				</div>
				<div class="grid gap-3 md:grid-cols-2">
					{#each wallets.slice(0, 4) as wallet (wallet.id)}
						<WalletCard
							{wallet}
							onclick={() => goto(resolve('/wallets/[id]', { id: wallet.id }))}
						/>
					{/each}
				</div>
			</section>

			<!-- Recent Activity -->
			<section>
				<div class="flex items-center justify-between mb-3">
					<h2 class="text-xs font-semibold text-base-content/40 uppercase tracking-widest">
						Recent Activity
					</h2>
					<a href={resolve('/transactions')} class="text-sm link link-primary">View all &rarr;</a>
				</div>

				{#if recent.totalItems === 0}
					<div class="bg-base-100 rounded-2xl shadow-sm p-8 text-center">
						<p class="text-base-content/40 text-sm">No transactions yet.</p>
					</div>
				{:else}
					<div class="space-y-4">
						{#each grouped as { date, items } (date)}
							<div>
								<div class="flex items-center gap-3 px-1 mb-2">
									<span
										class="text-xs font-semibold text-base-content/40 uppercase tracking-widest whitespace-nowrap"
									>
										{formatDate(date)}
									</span>
									<div class="flex-1 h-px bg-base-200"></div>
								</div>

								<div class="bg-base-100 rounded-2xl shadow-sm overflow-hidden">
									<div class="divide-y divide-base-200">
										{#each items as tx (tx.id)}
											<a
												href={resolve('/wallets/[id]', { id: tx.wallet })}
												class="flex items-center gap-3 px-4 py-3 hover:bg-base-200/40 transition-colors"
											>
												<span
													class="w-2.5 h-2.5 rounded-full shrink-0"
													style="background-color: {tx.categoryColor ??
														(tx.amount > 0 ? '#22c55e' : '#9ca3af')};"
												></span>
												<div class="flex-1 min-w-0">
													<p class="font-medium text-sm leading-snug truncate">
														{tx.description || tx.category}
														{#if tx.recurring}
															<span class="text-base-content/30 text-xs ml-1" title="Recurring"
																>↻</span
															>
														{/if}
													</p>
													<p class="text-xs text-base-content/40 truncate">
														{tx.category} · {tx.walletName}
													</p>
												</div>
												<span
													class="font-semibold text-sm shrink-0 {tx.amount < 0
														? 'text-error'
														: 'text-success'}"
												>
													{tx.amount < 0 ? '−' : '+'}{formatCurrency(
														Math.abs(tx.amount),
														tx.currency
													)}
												</span>
											</a>
										{/each}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/if}
	{:else}
		<div class="hero min-h-[60vh]">
			<div class="hero-content text-center">
				<div class="max-w-md">
					<h1 class="text-5xl font-bold">MC Budget</h1>
					<p class="py-6 text-lg text-base-content/70">
						Take control of your finances with smart budget management. Create wallets, choose from
						proven budget templates, and track every transaction.
					</p>
					<div class="flex gap-4 justify-center">
						<a href={resolve('/auth/register')}>
							<Button variant="primary" size="lg">Get Started</Button>
						</a>
						<a href={resolve('/auth/login')}>
							<Button variant="ghost" size="lg">Sign In</Button>
						</a>
					</div>

					<div class="mt-12 grid gap-4 text-left">
						<Card compact>
							{#snippet children()}
								<h3 class="font-semibold">50/30/20 Rule</h3>
								<p class="text-sm text-base-content/70">
									Allocate 50% to needs, 30% to wants, 20% to savings
								</p>
							{/snippet}
						</Card>
						<Card compact>
							{#snippet children()}
								<h3 class="font-semibold">Zero-Based Budget</h3>
								<p class="text-sm text-base-content/70">
									Every dollar has a purpose with detailed categories
								</p>
							{/snippet}
						</Card>
						<Card compact>
							{#snippet children()}
								<h3 class="font-semibold">Envelope System</h3>
								<p class="text-sm text-base-content/70">
									Simple three-envelope approach for easy management
								</p>
							{/snippet}
						</Card>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
