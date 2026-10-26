<script lang="ts">
	import { getWallets, getWallet } from '$lib/wallets.remote';
	import { getReport } from '$lib/transactions.remote';
	import { getFinancialSettings, getExchangeRates } from '$lib/settings.remote';
	import { getStandardPeriodRange, formatShortDate, formatMonthLabel } from '$lib/utils/dateRange';
	import AuthGuard from '$lib/components/AuthGuard.svelte';
	import ChartCanvas from '$lib/components/ChartCanvas.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import PeriodFilter from '$lib/components/PeriodFilter.svelte';
	import IncomeExpenseStats from '$lib/components/IncomeExpenseStats.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Card from '$lib/components/Card.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import { formatCurrency } from '$lib/utils/format';
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

	// The rate lookup falls back to just the base currency when the API is down; never convert 1:1
	const ratesAvailable = $derived(
		summaryEntries.every(([currency]) => typeof rates[currency] === 'number')
	);

	const multiCurrency = $derived(summaryEntries.length > 1);
	const showConvertedTotal = $derived(multiCurrency && ratesAvailable);
	const ratesMissing = $derived(multiCurrency && !ratesAvailable);

	const convertedTotal = $derived((() => {
		let income = 0, expense = 0;
		for (const [currency, data] of summaryEntries) {
			const r = rates[currency];
			income += data.income / r;
			expense += data.expense / r;
		}
		return { income, expense };
	})());

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
					borderWidth: 1,
					hoverOffset: 6
				}]
			};
		})(),
		options: {
			cutout: '70%',
			plugins: {
				legend: {
					position: 'bottom',
					labels: { boxWidth: 10, padding: 14, usePointStyle: true, font: { size: 12 } }
				},
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
						return sum + data[field] / rates[currency];
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
	<PageHeader title="Reports" subtitle="Where your money came from and where it went.">
		{#snippet actions()}
			<label class="flex items-center gap-2">
				<span class="sr-only">Wallet</span>
				<select
					class="select w-48 select-sm"
					value={selectedWalletId}
					onchange={(e) => (selectedWalletId = e.currentTarget.value)}
				>
					<option value="">All wallets</option>
					{#each wallets as w (w.id)}
						<option value={w.id}>{w.name}</option>
					{/each}
				</select>
			</label>
		{/snippet}
	</PageHeader>

	<div class="space-y-6">
		<PeriodFilter
			periods={PERIODS}
			value={selectedPeriod}
			onselect={(p) => (selectedPeriod = p)}
			startDate={customStartDate}
			endDate={customEndDate}
			ondateschange={(r) => {
				customStartDate = r.startDate;
				customEndDate = r.endDate;
			}}
		/>

		<!-- Summary stat cards -->
		{#if summaryEntries.length > 0}
			<div class="space-y-3">
				{#each summaryEntries as [currency, { income, expense }] (currency)}
					<IncomeExpenseStats
						{income}
						{expense}
						{currency}
						labelSuffix={multiCurrency ? currency : ''}
					/>
				{/each}
				{#if showConvertedTotal}
					<div class="border-t border-base-300/60 pt-3">
						<IncomeExpenseStats
							muted
							income={convertedTotal.income}
							expense={convertedTotal.expense}
							currency={baseCurrency}
							labelSuffix="{baseCurrency} total"
						/>
					</div>
				{/if}
				{#if ratesMissing}
					<Alert type="warning">
						Exchange rates are unavailable right now, so totals are not combined into {baseCurrency}.
						The monthly trend shows {primaryCurrency} only.
					</Alert>
				{/if}
			</div>
		{/if}

		<!-- Charts row: Donut + Budget vs Actual -->
		{#if hasSpending}
			<div class={['grid gap-4', budgetVsActualConfig ? 'lg:grid-cols-2' : 'grid-cols-1']}>
				<Card title="Spending by category" subtitle={primaryCurrency}>
					<div class="mx-auto flex max-w-sm items-center justify-center">
						<ChartCanvas config={donutConfig} class="max-h-72" />
					</div>
				</Card>

				{#if budgetVsActualConfig}
					<Card title="Budget vs actual" subtitle={walletData?.name}>
						<ChartCanvas config={budgetVsActualConfig} class="max-h-72" />
					</Card>
				{/if}
			</div>
		{/if}

		<!-- Income vs Expenses by Month -->
		{#if hasMonthlyData}
			<Card title="Income vs expenses" subtitle="By month · {trendCurrency}">
				<ChartCanvas config={trendConfig} class="max-h-72" />
			</Card>
		{/if}

		<!-- Top 10 Expenses -->
		{#if report.topExpenses.length > 0}
			<Card title="Top expenses">
				<ol class="-mx-2 divide-y divide-base-300/60">
					{#each report.topExpenses as tx, i (tx.id)}
						<li class="flex items-center gap-3 px-2 py-2.5">
							<span class="w-5 shrink-0 text-right text-xs font-semibold text-base-content/35 tabular-nums">
								{i + 1}
							</span>
							<span class="size-2.5 shrink-0 rounded-full" style:background-color={tx.color}></span>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium">{tx.description || tx.category}</p>
								<p class="truncate text-xs text-base-content/50">
									{tx.category} · {tx.walletName} · {formatDate(tx.date)}
								</p>
							</div>
							<span class="shrink-0 text-sm font-semibold text-error tabular-nums">
								−{formatCurrency(tx.amount, tx.currency)}
							</span>
						</li>
					{/each}
				</ol>
			</Card>
		{/if}

		<!-- Empty state -->
		{#if !hasSpending && !hasMonthlyData && summaryEntries.length === 0}
			<EmptyState
				icon="chart"
				title="No data in this period"
				description="Pick a longer period or another wallet to see your reports."
			/>
		{/if}
	</div>
</AuthGuard>
