<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { page } from '$app/state';
	import { getWallets } from '$lib/wallets.remote';
	import { getAllTransactionsPaged, getAllTransactionsSummary } from '$lib/transactions.remote';
	import Button from '$lib/components/Button.svelte';
	import WalletCard from '$lib/components/WalletCard.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import TransactionGroups from '$lib/components/TransactionGroups.svelte';
	import TransactionRow from '$lib/components/TransactionRow.svelte';
	import { resolve } from '$app/paths';
	import { getStandardPeriodRange } from '$lib/utils/dateRange';
	import { formatCurrency } from '$lib/utils/format';

	// Before hydration the auth store is still loading; use the server's user so SSR renders the dashboard
	const user = $derived(auth.isLoading ? page.data.user : auth.user);

	const thisMonth = getStandardPeriodRange('this-month') ?? {};

	const [wallets, recent, monthSummary] = $derived(
		user
			? await Promise.all([
					getWallets(),
					getAllTransactionsPaged({ page: 1, perPage: 10 }),
					getAllTransactionsSummary(thisMonth)
				])
			: [
					[],
					{ items: [], totalItems: 0, totalPages: 0, page: 1 },
					{ byCurrency: {} as Record<string, { income: number; expense: number }> }
				]
	);

	// Balances can't be summed across currencies, so total them per currency
	const balances = $derived(
		Object.entries(
			wallets.reduce<Record<string, number>>((acc, w) => {
				acc[w.currency] = (acc[w.currency] ?? 0) + w.balance;
				return acc;
			}, {})
		)
	);

	// One income/spent pair per currency, in a stable order
	const monthEntries = $derived(
		Object.entries(monthSummary.byCurrency).sort(([a], [b]) => a.localeCompare(b))
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
			day: 'numeric'
		});
	}

	const firstName = $derived((user?.name ?? '').split(' ')[0]);
	const monthName = new Date().toLocaleDateString('en-US', { month: 'long' });

	const features: { icon: IconName; title: string; text: string }[] = [
		{
			icon: 'layers',
			title: 'Proven templates',
			text: 'Start from 50/30/20, zero-based or envelope budgets — or build your own.'
		},
		{
			icon: 'chart',
			title: 'See where it goes',
			text: 'Every expense lands in a category, so overspending is visible the moment it happens.'
		},
		{
			icon: 'sparkles',
			title: 'Scan receipts',
			text: 'Snap a photo and AI fills in the amount, date and category for you.'
		},
		{
			icon: 'repeat',
			title: 'Recurring bills',
			text: 'Rent, subscriptions and salary repeat automatically every month.'
		}
	];
</script>

<svelte:head>
	<title>MC Budget</title>
</svelte:head>

{#if user}
	<header class="mb-8 flex flex-wrap items-end justify-between gap-4">
		<div>
			<p class="text-sm text-base-content/55">{formatToday()}</p>
			<h1 class="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
				{getGreeting()}{firstName ? `, ${firstName}` : ''}
			</h1>
		</div>
		<Button href={resolve('/wallets/new')} icon="plus" size="sm">New wallet</Button>
	</header>

	{#if wallets.length === 0}
		<EmptyState
			icon="wallet"
			title="Create your first wallet"
			description="A wallet holds a balance and a budget split across categories. Pick a template to get going in under a minute."
		>
			{#snippet action()}
				<Button href={resolve('/wallets/new')} icon="plus">Create a wallet</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<!-- Overview -->
		<section class="mb-10 grid grid-cols-2 gap-3 xl:grid-cols-4">
			<div
				class="relative col-span-2 overflow-hidden rounded-box bg-primary p-5 text-primary-content"
			>
				<div
					class="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-white/10"
				></div>
				<div
					class="pointer-events-none absolute -right-20 -bottom-24 size-56 rounded-full bg-white/5"
				></div>
				<p class="text-xs font-semibold tracking-wider uppercase opacity-75">Total balance</p>
				<div class="relative mt-2 space-y-1">
					{#each balances as [currency, total] (currency)}
						<p
							class={[
								'font-bold tracking-tight tabular-nums',
								balances.length > 1 ? 'text-2xl' : 'text-4xl'
							]}
						>
							{formatCurrency(total, currency)}
						</p>
					{/each}
				</div>
				<p class="relative mt-3 text-sm opacity-75">
					Across {wallets.length} wallet{wallets.length !== 1 ? 's' : ''}
				</p>
			</div>

			<!-- With several currencies, label each pair by currency instead of the month -->
			{#each monthEntries as [currency, { income, expense }] (currency)}
				{@const suffix = monthEntries.length > 1 ? currency : monthName}
				<StatCard
					label="Income · {suffix}"
					value={formatCurrency(income, currency)}
					tone="success"
					icon="trending-up"
				/>
				<StatCard
					label="Spent · {suffix}"
					value={formatCurrency(expense, currency)}
					tone="error"
					icon="trending-down"
				/>
			{:else}
				<StatCard label="Income · {monthName}" value="—" tone="success" icon="trending-up" />
				<StatCard label="Spent · {monthName}" value="—" tone="error" icon="trending-down" />
			{/each}
		</section>

		<div class="grid gap-10 xl:grid-cols-5">
			<!-- Wallets -->
			<section class="xl:col-span-3">
				<div class="mb-3 flex items-center justify-between">
					<h2 class="text-lg font-semibold">Wallets</h2>
					<a
						href={resolve('/wallets')}
						class="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
					>
						View all <Icon name="arrow-right" class="size-3.5" />
					</a>
				</div>
				<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
					{#each wallets.slice(0, 4) as wallet (wallet.id)}
						<WalletCard {wallet} />
					{/each}
				</div>
			</section>

			<!-- Recent Activity -->
			<section class="xl:col-span-2">
				<div class="mb-3 flex items-center justify-between">
					<h2 class="text-lg font-semibold">Recent activity</h2>
					<a
						href={resolve('/transactions')}
						class="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
					>
						View all <Icon name="arrow-right" class="size-3.5" />
					</a>
				</div>

				{#if recent.totalItems === 0}
					<EmptyState
						icon="receipt"
						title="No transactions yet"
						description="Open a wallet and add your first income or expense."
					/>
				{:else}
					<TransactionGroups items={recent.items}>
						{#snippet row(tx)}
							<TransactionRow
								href={resolve('/wallets/[id]', { id: tx.wallet })}
								transaction={tx}
								currency={tx.currency}
								color={tx.categoryColor}
							>
								{#snippet meta()}{tx.walletName}{/snippet}
							</TransactionRow>
						{/snippet}
					</TransactionGroups>
				{/if}
			</section>
		</div>
	{/if}
{:else}
	<!-- Landing -->
	<section class="mx-auto max-w-3xl pt-8 pb-16 text-center sm:pt-16">
		<span
			class="mb-6 inline-flex items-center gap-2 rounded-full border border-base-300 bg-base-100 px-3 py-1 text-xs font-medium text-base-content/70"
		>
			<Icon name="sparkles" class="size-3.5 text-primary" />
			Budgeting that keeps itself honest
		</span>
		<h1 class="text-4xl font-bold tracking-tight text-balance sm:text-6xl">
			Give every dollar a <span class="text-primary">job</span>.
		</h1>
		<p class="mx-auto mt-6 max-w-xl text-lg text-balance text-base-content/65">
			Create wallets with a fixed budget split, track every transaction, and see exactly where your
			money goes — across currencies.
		</p>
		<div class="mt-10 flex flex-wrap justify-center gap-3">
			<Button href={resolve('/auth/register')} size="lg">Get started — it's free</Button>
			<Button href={resolve('/auth/login')} variant="ghost" size="lg">Sign in</Button>
		</div>
	</section>

	<!-- Budget preview -->
	<section class="mx-auto mb-16 max-w-md">
		<div class="surface p-5 shadow-xl shadow-primary/5">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<span class="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
						<Icon name="wallet" />
					</span>
					<div>
						<p class="font-semibold">Monthly budget</p>
						<p class="text-xs text-base-content/50">50/30/20 rule</p>
					</div>
				</div>
				<p class="text-xl font-bold tabular-nums">$4,250.00</p>
			</div>
			<div class="mt-5 space-y-3">
				{#each [{ name: 'Needs', pct: 50, used: 72, color: '#3B82F6' }, { name: 'Wants', pct: 30, used: 45, color: '#8B5CF6' }, { name: 'Savings', pct: 20, used: 100, color: '#10B981' }] as c (c.name)}
					<div>
						<div class="mb-1 flex justify-between text-sm">
							<span class="flex items-center gap-2 font-medium">
								<span class="size-2.5 rounded-full" style:background-color={c.color}></span>
								{c.name}
								<span class="text-base-content/45">{c.pct}%</span>
							</span>
							<span class="text-base-content/55 tabular-nums">{c.used}% used</span>
						</div>
						<div class="h-1.5 overflow-hidden rounded-full bg-base-200">
							<div
								class="h-full rounded-full"
								style:width="{c.used}%"
								style:background-color={c.color}
							></div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section class="grid gap-4 pb-12 sm:grid-cols-2 lg:grid-cols-4">
		{#each features as feature (feature.title)}
			<div class="surface p-5">
				<span class="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
					<Icon name={feature.icon} />
				</span>
				<h3 class="mt-4 font-semibold">{feature.title}</h3>
				<p class="mt-1 text-sm text-base-content/60">{feature.text}</p>
			</div>
		{/each}
	</section>
{/if}
