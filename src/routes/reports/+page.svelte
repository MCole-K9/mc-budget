<script lang="ts">
	import { resolve } from '$app/paths';
	import { getWallets, getWallet } from '$lib/wallets.remote';
	import { getReport } from '$lib/transactions.remote';
	import { getFinancialSettings, getExchangeRates } from '$lib/settings.remote';
	import { getStandardPeriodRange, formatShortDate, formatMonthLabel } from '$lib/utils/dateRange';
	import AuthGuard from '$lib/components/AuthGuard.svelte';
	import ChartCanvas from '$lib/components/ChartCanvas.svelte';
	import type { ChartConfiguration } from 'chart.js';

	const PERIODS: { value: string; label: string }[] = [
		{ value: 'this-month', label: 'This Month' },
		{ value: 'last-month', label: 'Last Month' },
		{ value: 'last-3-months', label: '3 Months' },
		{ value: 'this-year', label: 'This Year' },
		{ value: 'all-time', label: 'All Time' },
		{ value: 'custom', label: 'Custom' }
	];

	let selectedPeriod = $state('this-month');
	let selectedWalletId = $state('');
	let customStartDate = $state('');
	let customEndDate = $state('');
	const showDateInputs = $derived(selectedPeriod === 'custom');

	const wallets = await getWallets();
	const { baseCurrency } = await getFinancialSettings();
	const { rates } = await getExchangeRates(baseCurrency);

	function getDateRange(period: string): { startDate?: string; endDate?: string } {
		const standardRange = getStandardPeriodRange(period);
		if (standardRange) return standardRange;
		return { startDate: customStartDate || undefined, endDate: customEndDate || undefined };
	}

	const dateRange = $derived(getDateRange(selectedPeriod));

	const [walletData, report] = $derived(
		await Promise.all([
			selectedWalletId ? getWallet(selectedWalletId) : Promise.resolve(null),
			getReport({ walletId: selectedWalletId || undefined, ...dateRange })
		])
	);

	const primaryCurrency = $derived(
		walletData?.currency ?? Object.keys(report.byCurrency)[0] ?? 'USD'
	);

	const summaryEntries = $derived(Object.entries(report.byCurrency));

	const showConvertedTotal = $derived(summaryEntries.length > 1);

	const convertedTotal = $derived((() => {
		let income = 0, expense = 0;
		for (const [currency, data] of summaryEntries) {
			const r = rates[currency] ?? 1;
			income += data.income / r;
			expense += data.expense / r;
		}
		return { income, expense, net: income - expense };
	})());

	function formatCurrency(amount: number, currency: string): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
	}

	const formatDate = formatShortDate;

	// ── Donut chart: spending by category ─────────────────────────────────────
	const donutConfig = $derived<ChartConfiguration<'doughnut'>>({
		type: 'doughnut',
		data: (() => {
			const cats = report.byCategory[primaryCurrency] ?? {};
			const entries = Object.entries(cats).sort((a, b) => b[1].spent - a[1].spent);
			return {
				labels: entries.map(([name]) => name),
				datasets: [{
					data: entries.map(([, v]) => v.spent),
					backgroundColor: entries.map(([, v]) => v.color + 'cc'),
					borderColor: entries.map(([, v]) => v.color),
					borderWidth: 1
				}]
			};
		})(),
		options: {
			cutout: '65%',
			plugins: {
				legend: { position: 'right', labels: { boxWidth: 12, padding: 12, font: { size: 12 } } },
				tooltip: {
					callbacks: {
						label: (ctx) => ` ${formatCurrency(ctx.parsed, primaryCurrency)}`
					}
				}
			}
		}
	});

	// ── Grouped bar: income vs expenses by month ───────────────────────────────
	// When multiple currencies are present, convert all to base currency for a unified view.
	const trendCurrency = $derived(showConvertedTotal ? baseCurrency : primaryCurrency);

	const trendConfig = $derived<ChartConfiguration>({
		type: 'bar',
		data: (() => {
			const months = Object.keys(report.byMonth).sort();
			const getMonthValue = (month: string, field: 'income' | 'expense') => {
				if (showConvertedTotal) {
					return Object.entries(report.byMonth[month] ?? {}).reduce((sum, [currency, data]) => {
						return sum + data[field] / (rates[currency] ?? 1);
					}, 0);
				}
				return report.byMonth[month]?.[primaryCurrency]?.[field] ?? 0;
			};
			return {
				labels: months.map(formatMonthLabel),
				datasets: [
					{
						label: 'Income',
						data: months.map(m => getMonthValue(m, 'income')),
						backgroundColor: '#22c55e66',
						borderColor: '#22c55e',
						borderWidth: 1,
						borderRadius: 4
					},
					{
						label: 'Expenses',
						data: months.map(m => getMonthValue(m, 'expense')),
						backgroundColor: '#ef444466',
						borderColor: '#ef4444',
						borderWidth: 1,
						borderRadius: 4
					}
				]
			};
		})(),
		options: {
			responsive: true,
			plugins: {
				legend: { position: 'top', labels: { boxWidth: 12, padding: 12, font: { size: 12 } } },
				tooltip: {
					callbacks: {
						label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0, trendCurrency)}`
					}
				}
			},
			scales: {
				y: { beginAtZero: true, ticks: { callback: (v) => formatCurrency(Number(v), trendCurrency) } },
				x: { grid: { display: false } }
			}
		}
	});

	// ── Horizontal bar: budget vs actual (wallet only) ─────────────────────────
	const budgetVsActualConfig = $derived<ChartConfiguration | null>(
		walletData ? (() => {
			const spendingInPeriod = report.byCurrency[walletData.currency] ?? { income: 0, expense: 0 };
			const periodIncome = spendingInPeriod.income;
			const isFixed = walletData.budget_type === 'fixed';
			const cats = walletData.categories;
			return {
				type: 'bar',
				data: {
					labels: cats.map(c => c.name),
					datasets: [
						{
							label: 'Budget',
							data: cats.map(c => isFixed ? (c.fixedAmount ?? 0) : (periodIncome * c.percentage) / 100),
							backgroundColor: cats.map(c => c.color + '44'),
							borderColor: cats.map(c => c.color),
							borderWidth: 1,
							borderRadius: 4
						},
						{
							label: 'Spent',
							data: cats.map(c => report.byCategory[walletData.currency]?.[c.name]?.spent ?? 0),
							backgroundColor: cats.map(c => c.color + 'aa'),
							borderColor: cats.map(c => c.color),
							borderWidth: 1,
							borderRadius: 4
						}
					]
				},
				options: {
					indexAxis: 'y',
					responsive: true,
					plugins: {
						legend: { position: 'top', labels: { boxWidth: 12, padding: 12, font: { size: 12 } } },
						tooltip: {
							callbacks: {
								label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.x ?? 0, walletData.currency)}`
							}
						}
					},
					scales: {
						x: { beginAtZero: true, ticks: { callback: (v) => formatCurrency(Number(v), walletData.currency) } },
						y: { grid: { display: false } }
					}
				}
			} as ChartConfiguration;
		})() : null
	);

	const hasSpending = $derived(Object.keys(report.byCategory[primaryCurrency] ?? {}).length > 0);
	const hasMonthlyData = $derived(Object.keys(report.byMonth).length > 0);
</script>

<svelte:head>
	<title>Reports - MC Budget</title>
</svelte:head>

<AuthGuard>
	{#snippet children()}
		<div class="max-w-4xl mx-auto space-y-5">

			<!-- Header -->
			<div class="flex justify-between items-end">
				<div>
					<a href={resolve('/wallets')} class="btn btn-ghost btn-sm mb-3 -ml-3">&larr; Wallets</a>
					<h1 class="text-2xl font-bold">Reports</h1>
				</div>

				<!-- Wallet filter -->
				<div class="flex items-center gap-2">
					<span class="text-xs text-base-content/40 uppercase tracking-wider font-medium">Wallet</span>
					<select
						class="select select-bordered select-sm"
						value={selectedWalletId}
						onchange={(e) => (selectedWalletId = e.currentTarget.value)}
					>
						<option value="">All Wallets</option>
						{#each wallets as w (w.id)}
							<option value={w.id}>{w.name}</option>
						{/each}
					</select>
				</div>
			</div>

			<!-- Period selector -->
			<div class="space-y-2">
				<div class="flex flex-wrap gap-1">
					{#each PERIODS as p (p.value)}
						<button
							class={['btn btn-sm', selectedPeriod === p.value ? 'btn-primary' : 'btn-ghost']}
							onclick={() => (selectedPeriod = p.value)}
						>
							{p.label}
						</button>
					{/each}
				</div>
				{#if showDateInputs}
					<div class="flex items-center gap-2">
						<input type="date" class="input input-bordered input-sm flex-1" value={customStartDate}
							oninput={(e) => (customStartDate = e.currentTarget.value)} />
						<span class="text-base-content/50 text-sm shrink-0">to</span>
						<input type="date" class="input input-bordered input-sm flex-1" value={customEndDate}
							oninput={(e) => (customEndDate = e.currentTarget.value)} />
					</div>
				{/if}
			</div>

			<!-- Summary stat cards -->
			{#if summaryEntries.length > 0}
				{#each summaryEntries as [currency, { income, expense }] (currency)}
					{@const net = income - expense}
					<div class="grid grid-cols-3 gap-3">
						<div class="rounded-2xl bg-base-100 shadow-sm p-4">
							<p class="text-xs font-medium text-base-content/40 uppercase tracking-wider mb-1">Income</p>
							<p class="text-xl font-bold text-success tabular-nums">{formatCurrency(income, currency)}</p>
						</div>
						<div class="rounded-2xl bg-base-100 shadow-sm p-4">
							<p class="text-xs font-medium text-base-content/40 uppercase tracking-wider mb-1">Expenses</p>
							<p class="text-xl font-bold text-error tabular-nums">{formatCurrency(expense, currency)}</p>
						</div>
						<div class="rounded-2xl bg-base-100 shadow-sm p-4">
							<p class="text-xs font-medium text-base-content/40 uppercase tracking-wider mb-1">Net</p>
							<p class="text-xl font-bold tabular-nums {net >= 0 ? 'text-success' : 'text-error'}">
								{net >= 0 ? '+' : ''}{formatCurrency(Math.abs(net), currency)}
							</p>
						</div>
					</div>
				{/each}
			{#if showConvertedTotal}
				{@const net = convertedTotal.net}
				<div class="grid grid-cols-3 gap-3 border-t border-base-200/60 pt-3">
					<div class="rounded-2xl bg-base-200/40 p-4">
						<p class="text-xs font-medium text-base-content/40 uppercase tracking-wider mb-1">Total Income ({baseCurrency})</p>
						<p class="text-xl font-bold text-success tabular-nums">{formatCurrency(convertedTotal.income, baseCurrency)}</p>
					</div>
					<div class="rounded-2xl bg-base-200/40 p-4">
						<p class="text-xs font-medium text-base-content/40 uppercase tracking-wider mb-1">Total Expenses ({baseCurrency})</p>
						<p class="text-xl font-bold text-error tabular-nums">{formatCurrency(convertedTotal.expense, baseCurrency)}</p>
					</div>
					<div class="rounded-2xl bg-base-200/40 p-4">
						<p class="text-xs font-medium text-base-content/40 uppercase tracking-wider mb-1">Total Net ({baseCurrency})</p>
						<p class="text-xl font-bold tabular-nums {net >= 0 ? 'text-success' : 'text-error'}">
							{net >= 0 ? '+' : ''}{formatCurrency(Math.abs(net), baseCurrency)}
						</p>
					</div>
				</div>
			{/if}
			{/if}

			<!-- Charts row: Donut + Budget vs Actual -->
			{#if hasSpending}
				<div class={['grid gap-4', budgetVsActualConfig ? 'md:grid-cols-2' : 'grid-cols-1']}>
					<!-- Spending by Category -->
					<div class="rounded-2xl bg-base-100 shadow-sm p-5">
						<p class="text-xs font-semibold text-base-content/40 uppercase tracking-wider mb-4">Spending by Category</p>
						<div class="flex items-center justify-center" style="max-height: 260px;">
							<ChartCanvas config={donutConfig} class="max-h-64" />
						</div>
					</div>

					<!-- Budget vs Actual (wallet only) -->
					{#if budgetVsActualConfig}
						<div class="rounded-2xl bg-base-100 shadow-sm p-5">
							<p class="text-xs font-semibold text-base-content/40 uppercase tracking-wider mb-4">Budget vs Actual</p>
							<ChartCanvas config={budgetVsActualConfig} class="max-h-64" />
						</div>
					{/if}
				</div>
			{/if}

			<!-- Income vs Expenses by Month -->
			{#if hasMonthlyData}
				<div class="rounded-2xl bg-base-100 shadow-sm p-5">
					<p class="text-xs font-semibold text-base-content/40 uppercase tracking-wider mb-4">Income vs Expenses</p>
					<ChartCanvas config={trendConfig} class="max-h-64" />
				</div>
			{/if}

			<!-- Top 10 Expenses -->
			{#if report.topExpenses.length > 0}
				<div class="rounded-2xl bg-base-100 shadow-sm p-5">
					<p class="text-xs font-semibold text-base-content/40 uppercase tracking-wider mb-4">Top Expenses</p>
					<div class="divide-y divide-base-200/60">
						{#each report.topExpenses as tx, i (tx.id)}
							<div class="flex items-center gap-3 py-2.5">
								<span class="text-xs font-semibold text-base-content/30 w-5 text-right shrink-0">{i + 1}</span>
								<span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {tx.color};"></span>
								<div class="flex-1 min-w-0">
									<p class="text-sm font-medium truncate">{tx.description || tx.category}</p>
									<p class="text-xs text-base-content/40 truncate">{tx.category} · {tx.walletName} · {formatDate(tx.date)}</p>
								</div>
								<span class="text-sm font-semibold text-error tabular-nums shrink-0">
									−{formatCurrency(tx.amount, tx.currency)}
								</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Empty state -->
			{#if !hasSpending && !hasMonthlyData && summaryEntries.length === 0}
				<div class="rounded-2xl bg-base-100 shadow-sm p-12 text-center">
					<p class="text-base-content/40 text-sm">No data in this period.</p>
				</div>
			{/if}

		</div>
	{/snippet}
</AuthGuard>
