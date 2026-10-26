<script lang="ts">
	import { resolve } from '$app/paths';
	import { getAllTransactionsPaged, getAllTransactionsSummary } from '$lib/transactions.remote';
	import { getStandardPeriodRange } from '$lib/utils/dateRange';
	import AuthGuard from '$lib/components/AuthGuard.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import PeriodFilter from '$lib/components/PeriodFilter.svelte';
	import IncomeExpenseStats from '$lib/components/IncomeExpenseStats.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import TransactionGroups from '$lib/components/TransactionGroups.svelte';
	import TransactionRow from '$lib/components/TransactionRow.svelte';

	const PERIODS: { value: string; label: string }[] = [
		{ value: 'this-month', label: 'This Month' },
		{ value: 'last-month', label: 'Last Month' },
		{ value: 'last-3-months', label: '3 Months' },
		{ value: 'this-year', label: 'This Year' },
		{ value: 'all-time', label: 'All Time' },
		{ value: 'custom', label: 'Custom' }
	];

	let selectedPeriod = $state('this-month');
	let customStartDate = $state('');
	let customEndDate = $state('');
	let currentPage = $state(1);
	const PER_PAGE = 25;

	function getDateRange(period: string): { startDate?: string; endDate?: string } {
		const standardRange = getStandardPeriodRange(period);
		if (standardRange) return standardRange;
		return { startDate: customStartDate || undefined, endDate: customEndDate || undefined };
	}

	const dateRange = $derived(getDateRange(selectedPeriod));

	const [pagedResult, summary] = $derived(
		await Promise.all([
			getAllTransactionsPaged({ page: currentPage, perPage: PER_PAGE, ...dateRange }),
			getAllTransactionsSummary(dateRange)
		])
	);

	const summaryEntries = $derived(Object.entries(summary.byCurrency));
</script>

<svelte:head>
	<title>Transactions - MC Budget</title>
</svelte:head>

<AuthGuard>
	<PageHeader title="Transactions" subtitle="Everything across all of your wallets." />

	<div class="space-y-6">
		<PeriodFilter
			periods={PERIODS}
			value={selectedPeriod}
			onselect={(p) => {
				selectedPeriod = p;
				currentPage = 1;
			}}
			startDate={customStartDate}
			endDate={customEndDate}
			ondateschange={(r) => {
				customStartDate = r.startDate;
				customEndDate = r.endDate;
				currentPage = 1;
			}}
		/>

		<!-- Summary stats -->
		{#each summaryEntries as [currency, { income, expense }] (currency)}
			<IncomeExpenseStats
				{income}
				{expense}
				{currency}
				labelSuffix={summaryEntries.length > 1 ? currency : ''}
			/>
		{/each}

		<!-- Transaction list -->
		{#if pagedResult.totalItems === 0}
			<EmptyState
				icon="receipt"
				title="No transactions in this period"
				description="Try a longer period, or add a transaction from one of your wallets."
			/>
		{:else}
			<TransactionGroups items={pagedResult.items}>
				{#snippet row(tx)}
					<TransactionRow transaction={tx} currency={tx.currency} color={tx.categoryColor}>
						{#snippet meta()}
							<a
								href={resolve('/wallets/[id]', { id: tx.wallet })}
								class="font-medium transition-colors hover:text-primary"
							>
								{tx.walletName}
							</a>
						{/snippet}
					</TransactionRow>
				{/snippet}
			</TransactionGroups>

			<Pagination
				page={currentPage}
				totalPages={pagedResult.totalPages}
				totalItems={pagedResult.totalItems}
				onchange={(p) => (currentPage = p)}
			/>
		{/if}
	</div>
</AuthGuard>
