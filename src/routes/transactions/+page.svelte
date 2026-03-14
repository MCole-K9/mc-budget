<script lang="ts">
	import { resolve } from '$app/paths';
	import { getAllTransactionsPaged, getAllTransactionsSummary } from '$lib/transactions.remote';
	import AuthGuard from '$lib/components/AuthGuard.svelte';

	const PERIODS: { value: string; label: string }[] = [
		{ value: 'this-month', label: 'This Month' },
		{ value: 'last-month', label: 'Last Month' },
		{ value: 'last-3-months', label: '3 Months' },
		{ value: 'this-year', label: 'This Year' },
		{ value: 'all-time', label: 'All Time' },
		{ value: 'custom', label: 'Custom' }
	];

	let selectedPeriod = $state('this-month');
	const showDateInputs = $derived(selectedPeriod === 'custom');
	let customStartDate = $state('');
	let customEndDate = $state('');
	let currentPage = $state(1);
	const PER_PAGE = 25;

	function getDateRange(period: string): { startDate?: string; endDate?: string } {
		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
		if (period === 'this-month') return { startDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, endDate: today };
		if (period === 'last-month') {
			const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
			const m = now.getMonth() === 0 ? 12 : now.getMonth();
			return { startDate: `${y}-${pad(m)}-01`, endDate: `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}` };
		}
		if (period === 'last-3-months') {
			const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
			return { startDate: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`, endDate: today };
		}
		if (period === 'this-year') return { startDate: `${now.getFullYear()}-01-01`, endDate: today };
		if (period === 'all-time') return {};
		return { startDate: customStartDate || undefined, endDate: customEndDate || undefined };
	}

	const dateRange = $derived(getDateRange(selectedPeriod));

	const [pagedResult, summary] = $derived(
		await Promise.all([
			getAllTransactionsPaged({ page: currentPage, perPage: PER_PAGE, ...dateRange }),
			getAllTransactionsSummary(dateRange)
		])
	);

	type TxItem = typeof pagedResult.items[number];

	const grouped = $derived(
		pagedResult.items.reduce<{ date: string; items: TxItem[] }[]>((acc, tx) => {
			const last = acc[acc.length - 1];
			if (last?.date === tx.date) last.items.push(tx);
			else acc.push({ date: tx.date, items: [tx] });
			return acc;
		}, [])
	);

	const summaryEntries = $derived(Object.entries(summary.byCurrency));

	function formatCurrency(amount: number, currency: string): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
	}

	function formatDate(dateStr: string): string {
		const datePart = dateStr.split('T')[0].split(' ')[0];
		const d = new Date(datePart + 'T00:00:00');
		const now = new Date();
		return d.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			...(d.getFullYear() !== now.getFullYear() && { year: 'numeric' })
		});
	}
</script>

<svelte:head>
	<title>All Transactions - MC Budget</title>
</svelte:head>

<AuthGuard>
	{#snippet children()}
		<div class="max-w-4xl mx-auto space-y-4">

			<!-- Header -->
			<div>
				<a href={resolve('/wallets')} class="btn btn-ghost btn-sm mb-2">&larr; Wallets</a>
				<h1 class="text-2xl font-bold">All Transactions</h1>
			</div>

			<!-- Period selector -->
			<div class="space-y-2">
				<div class="flex flex-wrap gap-1">
					{#each PERIODS as p (p.value)}
						<button
							class={['btn btn-sm', selectedPeriod === p.value ? 'btn-primary' : 'btn-ghost']}
							onclick={() => { selectedPeriod = p.value; currentPage = 1; }}
						>
							{p.label}
						</button>
					{/each}
				</div>
				{#if showDateInputs}
					<div class="flex items-center gap-2">
						<input type="date" class="input input-bordered input-sm flex-1" value={customStartDate}
							oninput={(e) => { customStartDate = e.currentTarget.value; currentPage = 1; }} />
						<span class="text-base-content/50 text-sm shrink-0">to</span>
						<input type="date" class="input input-bordered input-sm flex-1" value={customEndDate}
							oninput={(e) => { customEndDate = e.currentTarget.value; currentPage = 1; }} />
					</div>
				{/if}
			</div>

			<!-- Summary stats -->
			{#if summaryEntries.length > 0}
				{#each summaryEntries as [currency, { income, expense }] (currency)}
					{@const net = income - expense}
					<div class="grid grid-cols-3 gap-3">
						<div class="bg-base-100 rounded-2xl p-4 shadow-sm">
							<p class="text-xs font-medium text-base-content/40 uppercase tracking-wider mb-1">Income</p>
							<p class="text-xl font-bold text-success tabular-nums">{formatCurrency(income, currency)}</p>
						</div>
						<div class="bg-base-100 rounded-2xl p-4 shadow-sm">
							<p class="text-xs font-medium text-base-content/40 uppercase tracking-wider mb-1">Expenses</p>
							<p class="text-xl font-bold text-error tabular-nums">{formatCurrency(expense, currency)}</p>
						</div>
						<div class="bg-base-100 rounded-2xl p-4 shadow-sm">
							<p class="text-xs font-medium text-base-content/40 uppercase tracking-wider mb-1">Net</p>
							<p class="text-xl font-bold tabular-nums {net >= 0 ? 'text-success' : 'text-error'}">
								{net >= 0 ? '+' : ''}{formatCurrency(Math.abs(net), currency)}
							</p>
						</div>
					</div>
				{/each}
			{/if}

			<!-- Transaction list -->
			{#if pagedResult.totalItems === 0}
				<div class="rounded-2xl bg-base-100 shadow-sm p-12 text-center">
					<p class="text-base-content/40 text-sm">No transactions in this period.</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each grouped as { date, items } (date)}
						<div>
							<!-- Date header -->
							<div class="flex items-center gap-3 px-1 mb-2">
								<span class="text-xs font-semibold text-base-content/40 uppercase tracking-widest whitespace-nowrap">
									{formatDate(date)}
								</span>
								<div class="flex-1 h-px bg-base-200"></div>
							</div>

							<!-- Transactions for this date -->
							<div class="bg-base-100 rounded-2xl shadow-sm overflow-hidden">
								<div class="divide-y divide-base-200">
									{#each items as tx (tx.id)}
										<div class="flex items-center gap-3 px-4 py-3 hover:bg-base-200/40 transition-colors">
											<!-- Category color dot -->
											<span
												class="w-2.5 h-2.5 rounded-full shrink-0"
												style="background-color: {tx.categoryColor ?? (tx.amount > 0 ? '#22c55e' : '#9ca3af')};"
											></span>

											<!-- Description + meta -->
											<div class="flex-1 min-w-0">
												<p class="font-medium text-sm leading-snug truncate">
													{tx.description || tx.category}
													{#if tx.recurring}
														<span class="text-base-content/30 text-xs ml-1" title="Recurring">↻</span>
													{/if}
												</p>
												<p class="text-xs text-base-content/40 truncate">
													{tx.category}
													<span class="mx-1">·</span>
													<a href={resolve('/wallets/[id]', { id: tx.wallet })} class="hover:text-base-content/70 transition-colors">
														{tx.walletName}
													</a>
												</p>
											</div>

											<!-- Amount -->
											<span class="font-semibold text-sm shrink-0 {tx.amount < 0 ? 'text-error' : 'text-success'}">
												{tx.amount < 0 ? '−' : '+'}{ formatCurrency(Math.abs(tx.amount), tx.currency)}
											</span>
										</div>
									{/each}
								</div>
							</div>
						</div>
					{/each}
				</div>

				<!-- Pagination -->
				{#if pagedResult.totalPages > 1}
					<div class="flex items-center justify-between">
						<span class="text-sm text-base-content/40">{pagedResult.totalItems} transactions</span>
						<div class="join">
							<button class="join-item btn btn-sm" disabled={currentPage === 1} onclick={() => currentPage--}>&larr;</button>
							<button class="join-item btn btn-sm btn-disabled">{currentPage} / {pagedResult.totalPages}</button>
							<button class="join-item btn btn-sm" disabled={currentPage === pagedResult.totalPages} onclick={() => currentPage++}>&rarr;</button>
						</div>
					</div>
				{:else}
					<p class="text-sm text-base-content/40 text-center">{pagedResult.totalItems} transaction{pagedResult.totalItems !== 1 ? 's' : ''}</p>
				{/if}
			{/if}
		</div>
	{/snippet}
</AuthGuard>
