<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getWallet, deleteWallet, recalculateBalance } from '$lib/wallets.remote';
	import {
		getTransactions,
		getTransactionsPaged,
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

	let showAddTransaction = $state(false);
	let showDeleteConfirm = $state(false);
	let transactionToDelete = $state<Transaction | null>(null);
	let reconciling = $state(false);
	let error = $state('');

	let filterMonth = $state(new Date().getMonth());
	let filterYear = $state(new Date().getFullYear());
	let currentPage = $state(1);
	const PER_PAGE = 15;

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	const walletId = page.params.id!;

	// All transactions — used for budget allocation card and CSV export
	const [wallet, transactions] = $derived(
		await Promise.all([getWallet(walletId), getTransactions(walletId)])
	);

	// Server-filtered + paginated — used for the transaction list only
	const pagedResult = $derived(
		await getTransactionsPaged({ walletId, page: currentPage, perPage: PER_PAGE, month: filterMonth, year: filterYear })
	);

	function refreshPagedQuery() {
		getTransactionsPaged({ walletId, page: currentPage, perPage: PER_PAGE, month: filterMonth, year: filterYear }).refresh();
	}

	function prevMonth() {
		if (filterMonth === 0) { filterMonth = 11; filterYear--; }
		else filterMonth--;
		currentPage = 1;
	}

	function nextMonth() {
		if (filterMonth === 11) { filterMonth = 0; filterYear++; }
		else filterMonth++;
		currentPage = 1;
	}

	// CSV exports the current month's transactions (from all-transactions cache, filtered client-side)
	function exportCsv() {
		const monthTransactions = transactions.filter((t) => {
			const d = new Date(t.date);
			return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
		});
		const rows = [
			['Date', 'Category', 'Description', 'Amount', 'Currency'],
			...monthTransactions.map((t) => [
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
		a.download = `${wallet.name}-${MONTHS[filterMonth]}-${filterYear}.csv`;
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

	// All-time spending per category (uses full transaction list)
	function getCategorySpent(categoryName: string): number {
		return transactions
			.filter((t) => t.category.toLowerCase() === categoryName.toLowerCase() && t.amount < 0)
			.reduce((sum, t) => sum + Math.abs(t.amount), 0);
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
					<div class="space-y-4">
						{#each wallet.categories as category (category.name)}
							{@const allocated = getCategoryAmount(wallet.total_funded, category.percentage)}
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
					<!-- Month filter + export -->
					<div class="flex items-center justify-between mb-4">
						<div class="flex items-center gap-1">
							<button class="btn btn-ghost btn-sm" onclick={prevMonth}>&larr;</button>
							<span class="font-medium w-28 text-center">{MONTHS[filterMonth]} {filterYear}</span>
							<button class="btn btn-ghost btn-sm" onclick={nextMonth}>&rarr;</button>
						</div>
						{#if pagedResult.totalItems > 0}
							<button class="btn btn-ghost btn-sm" onclick={exportCsv} title="Export as CSV">
								↓ CSV
							</button>
						{/if}
					</div>

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
