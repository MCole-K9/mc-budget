<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getWallet, deleteWallet, recalculateBalance } from '$lib/wallets.remote';
	import {
		getTransactions,
		getTransactionsPaged,
		getTransactionSummary,
		deleteTransaction as removeTransaction
	} from '$lib/transactions.remote';
	import type { Transaction } from '$lib/types/budget';
	import AuthGuard from '$lib/components/AuthGuard.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import TransactionList from '$lib/components/TransactionList.svelte';
	import TransactionForm from '$lib/components/TransactionForm.svelte';

	type Period = 'this-month' | 'last-month' | 'last-3-months' | 'this-year' | 'all-time' | 'custom';

	const PERIODS: { value: Period; label: string }[] = [
		{ value: 'this-month', label: 'This Month' },
		{ value: 'last-month', label: 'Last Month' },
		{ value: 'last-3-months', label: '3 Months' },
		{ value: 'this-year', label: 'This Year' },
		{ value: 'all-time', label: 'All Time' },
		{ value: 'custom', label: 'Custom' }
	];

	let showAddTransaction = $state(false);
	let showDeleteConfirm = $state(false);
	let transactionToDelete = $state<Transaction | null>(null);
	let reconciling = $state(false);
	let error = $state('');

	let selectedPeriod = $state<Period>('this-month');
	let customStartDate = $state('');
	let customEndDate = $state('');
	let currentPage = $state(1);
	const PER_PAGE = 15;

	const walletId = page.params.id!;

	function getDateRange(period: Period): { startDate?: string; endDate?: string } {
		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

		if (period === 'this-month') {
			return { startDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, endDate: today };
		}
		if (period === 'last-month') {
			const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
			const m = now.getMonth() === 0 ? 12 : now.getMonth();
			const lastDay = new Date(y, m, 0).getDate();
			return { startDate: `${y}-${pad(m)}-01`, endDate: `${y}-${pad(m)}-${pad(lastDay)}` };
		}
		if (period === 'last-3-months') {
			const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
			return { startDate: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`, endDate: today };
		}
		if (period === 'this-year') {
			return { startDate: `${now.getFullYear()}-01-01`, endDate: today };
		}
		if (period === 'all-time') {
			return {};
		}
		// custom
		return {
			startDate: customStartDate || undefined,
			endDate: customEndDate || undefined
		};
	}

	const dateRange = $derived(getDateRange(selectedPeriod));

	// All three fetched in parallel to avoid waterfalls
	const [wallet, summary, pagedResult] = $derived(
		await Promise.all([
			getWallet(walletId),
			getTransactionSummary({ walletId, ...dateRange }),
			getTransactionsPaged({ walletId, page: currentPage, perPage: PER_PAGE, ...dateRange })
		])
	);

	function refreshPagedQuery() {
		getTransactionsPaged({ walletId, page: currentPage, perPage: PER_PAGE, ...dateRange }).refresh();
		getTransactionSummary({ walletId, ...dateRange }).refresh();
	}

	function setPeriod(p: Period) {
		selectedPeriod = p;
		currentPage = 1;
	}

	// CSV fetches transactions on demand (lazy) and exports the current date range
	async function exportCsv() {
		const allTx = await getTransactions(walletId);
		const filtered = allTx.filter((t) => {
			if (dateRange.startDate && t.date < dateRange.startDate) return false;
			if (dateRange.endDate && t.date > dateRange.endDate) return false;
			return true;
		});
		const rows = [
			['Date', 'Category', 'Description', 'Amount', 'Currency'],
			...filtered.map((t) => [
				t.date,
				t.category,
				t.description || '',
				t.amount.toFixed(2),
				wallet.currency
			])
		];
		const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		const suffix = dateRange.startDate ? dateRange.startDate : 'all';
		a.download = `${wallet.name}-${suffix}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function handleDeleteTransaction(transaction: Transaction) {
		transactionToDelete = transaction;
	}

	async function confirmDeleteTransaction() {
		if (!transactionToDelete) return;
		try {
			await removeTransaction({ id: transactionToDelete.id, walletId: transactionToDelete.wallet });
			transactionToDelete = null;
			refreshPagedQuery();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete transaction';
			transactionToDelete = null;
		}
	}

	async function handleDeleteWallet() {
		try {
			await deleteWallet(wallet.id);
			await goto(resolve('/wallets'));
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete wallet';
		}
	}

	async function handleRecalculate() {
		reconciling = true;
		try {
			await recalculateBalance(walletId);
			refreshPagedQuery();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to recalculate balance';
		} finally {
			reconciling = false;
		}
	}

	function formatCurrency(amount: number, currency: string): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
	}

	function getCategoryAmount(balance: number, percentage: number): number {
		return (balance * percentage) / 100;
	}

	function inDateRange(date: string): boolean {
		if (dateRange.startDate && date < dateRange.startDate) return false;
		if (dateRange.endDate && date > dateRange.endDate) return false;
		return true;
	}

	// Income received in the selected period.
	// For 'all-time' use total_funded (which includes initial_balance + all income).
	// For other periods: server-aggregated income + initial_balance if wallet was created in range.
	const periodIncome = $derived(
		selectedPeriod === 'all-time'
			? wallet.total_funded
			: summary.income + (inDateRange(wallet.created.split('T')[0]) ? wallet.initial_balance : 0)
	);

	// Spending per category for the selected period — from server-aggregated summary
	function getCategorySpent(categoryName: string): number {
		return summary.spendingByCategory[categoryName.toLowerCase()] ?? 0;
	}
</script>

<svelte:head>
	<title>{wallet.name} - MC Budget</title>
</svelte:head>

<AuthGuard>
	{#snippet children()}
		<div class="max-w-4xl mx-auto space-y-6">
			{#if error}
				<Alert type="error" dismissible ondismiss={() => (error = '')}>
					{#snippet children()}{error}{/snippet}
				</Alert>
			{/if}

			<!-- Header -->
			<div class="flex justify-between items-start">
				<div>
					<a href={resolve('/wallets')} class="btn btn-ghost btn-sm mb-2">&larr; Back to Wallets</a>
					<h1 class="text-3xl font-bold">{wallet.name}</h1>
					<div class="flex items-baseline gap-3 mt-2">
						<p class="text-4xl font-bold text-primary">
							{formatCurrency(wallet.balance, wallet.currency)}
						</p>
						<button
							class="btn btn-ghost btn-sm text-lg text-base-content/40 hover:text-base-content/70"
							onclick={handleRecalculate}
							disabled={reconciling}
							title="Recalculate balance from transaction history"
						>
							{reconciling ? '...' : '↺'}
						</button>
					</div>
				</div>
				<div class="flex gap-2">
					<Button variant="primary" onclick={() => (showAddTransaction = true)}>
						Add Transaction
					</Button>
					<Button variant="error" outline onclick={() => (showDeleteConfirm = true)}>
						Delete
					</Button>
				</div>
			</div>

			<!-- Budget Allocation -->
			<Card title="Budget Allocation">
				{#snippet children()}
					<!-- Period income summary -->
					<div class="flex justify-between items-center mb-4 text-sm text-base-content/60">
						<span>Based on {PERIODS.find(p => p.value === selectedPeriod)?.label} income</span>
						<span class="font-medium text-base-content">{formatCurrency(periodIncome, wallet.currency)}</span>
					</div>
					{#if periodIncome === 0 && selectedPeriod !== 'all-time'}
						<div class="text-sm text-base-content/60 text-center py-2">
							No income in this period — switch to All Time to see total allocation.
						</div>
					{/if}
					<div class="space-y-4">
						{#each wallet.categories as category (category.name)}
							{@const allocated = getCategoryAmount(periodIncome, category.percentage)}
							{@const spent = getCategorySpent(category.name)}
							{@const remaining = allocated - spent}
							{@const spentPct = allocated > 0 ? Math.min(100, (spent / allocated) * 100) : 0}
							{@const overBudget = remaining < 0}
							<div class="space-y-1">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<span
											class="w-4 h-4 rounded"
											style="background-color: {category.color};"
										></span>
										<span class="font-medium">{category.name}</span>
										<span class="text-base-content/60">{category.percentage}%</span>
										{#if overBudget}
											<span class="badge badge-error badge-sm">Over budget</span>
										{/if}
									</div>
									<span class={['font-semibold', overBudget && 'text-error']}>
										{formatCurrency(Math.abs(remaining), wallet.currency)}
										{overBudget ? 'over' : 'left'}
									</span>
								</div>
								<div class="flex items-center gap-2 pl-6">
									<div class="flex-1 h-2 rounded-full bg-base-300 overflow-hidden">
										<div
											class="h-full rounded-full transition-all"
											style="width: {spentPct}%; background-color: {overBudget ? 'var(--color-error)' : category.color}; opacity: 0.7;"
										></div>
									</div>
									<span class="text-xs text-base-content/60 shrink-0">
										{formatCurrency(spent, wallet.currency)} spent
									</span>
								</div>
							</div>
						{/each}
					</div>

					<!-- Visual bar -->
					<div class="flex h-4 rounded-full overflow-hidden bg-base-300 mt-4">
						{#each wallet.categories as category (category.name)}
							<div
								class="h-full"
								style="width: {category.percentage}%; background-color: {category.color};"
								title="{category.name}: {category.percentage}%"
							></div>
						{/each}
					</div>
				{/snippet}
			</Card>

			<!-- Transactions -->
			<Card title="Transactions">
				{#snippet children()}
					<!-- Period selector -->
					<div class="flex flex-wrap items-center justify-between gap-2 mb-4">
						<div class="join">
							{#each PERIODS as p (p.value)}
								<button
									class={['btn btn-sm join-item', selectedPeriod === p.value ? 'btn-primary' : 'btn-ghost']}
									onclick={() => setPeriod(p.value)}
								>
									{p.label}
								</button>
							{/each}
						</div>
						{#if pagedResult.totalItems > 0}
							<button class="btn btn-ghost btn-sm" onclick={exportCsv} title="Export as CSV">
								↓ CSV
							</button>
						{/if}
					</div>

					<!-- Custom date range inputs -->
					{#if selectedPeriod === 'custom'}
						<div class="flex items-center gap-2 mb-4">
							<input
								type="date"
								class="input input-bordered input-sm flex-1"
								value={customStartDate}
								oninput={(e) => { customStartDate = e.currentTarget.value; currentPage = 1; }}
							/>
							<span class="text-base-content/60 text-sm shrink-0">to</span>
							<input
								type="date"
								class="input input-bordered input-sm flex-1"
								value={customEndDate}
								oninput={(e) => { customEndDate = e.currentTarget.value; currentPage = 1; }}
							/>
						</div>
					{/if}

					<TransactionList
						transactions={pagedResult.items}
						{wallet}
						ondelete={handleDeleteTransaction}
					/>

					<!-- Pagination -->
					{#if pagedResult.totalPages > 1}
						<div class="flex items-center justify-center gap-3 mt-4 pt-4 border-t border-base-300">
							<button
								class="btn btn-ghost btn-sm"
								disabled={currentPage === 1}
								onclick={() => currentPage--}
							>&larr;</button>
							<span class="text-sm text-base-content/70">
								{currentPage} / {pagedResult.totalPages}
							</span>
							<button
								class="btn btn-ghost btn-sm"
								disabled={currentPage === pagedResult.totalPages}
								onclick={() => currentPage++}
							>&rarr;</button>
						</div>
					{/if}
				{/snippet}
			</Card>
		</div>

		<!-- Add Transaction Modal -->
		<Modal bind:open={showAddTransaction} title="Add Transaction">
			{#snippet children()}
				<TransactionForm
					{wallet}
					onSuccess={() => {
						showAddTransaction = false;
						refreshPagedQuery();
					}}
				/>
			{/snippet}
		</Modal>

		<!-- Delete Wallet Confirmation Modal -->
		<Modal bind:open={showDeleteConfirm} title="Delete Wallet?">
			{#snippet children()}
				<p class="text-base-content/70">
					Are you sure you want to delete "{wallet.name}"? This action cannot be undone
					and all transactions will be lost.
				</p>
			{/snippet}
			{#snippet actions()}
				<Button variant="ghost" onclick={() => (showDeleteConfirm = false)}>
					Cancel
				</Button>
				<Button variant="error" onclick={handleDeleteWallet}>
					Delete Wallet
				</Button>
			{/snippet}
		</Modal>

		<!-- Delete Transaction Confirmation Modal -->
		<Modal
			open={!!transactionToDelete}
			title="Delete Transaction?"
			onclose={() => (transactionToDelete = null)}
		>
			{#snippet children()}
				<p class="text-base-content/70">
					Are you sure you want to delete this transaction? This will reverse its effect on your
					wallet balance.
				</p>
			{/snippet}
			{#snippet actions()}
				<Button variant="ghost" onclick={() => (transactionToDelete = null)}>Cancel</Button>
				<Button variant="error" onclick={confirmDeleteTransaction}>Delete Transaction</Button>
			{/snippet}
		</Modal>
	{/snippet}
</AuthGuard>
