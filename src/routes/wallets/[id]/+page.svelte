<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { getWallet, deleteWallet } from '$lib/api/wallets';
	import { getTransactions, createTransaction, deleteTransaction, getCategorySummary } from '$lib/api/transactions';
	import type { Wallet, Transaction, CreateTransactionInput } from '$lib/types/budget';
	import AuthGuard from '$lib/components/AuthGuard.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import TransactionList from '$lib/components/TransactionList.svelte';
	import TransactionForm from '$lib/components/TransactionForm.svelte';

	let wallet = $state<Wallet | null>(null);
	let transactions = $state<Transaction[]>([]);
	let loading = $state(true);
	let error = $state('');
	let showAddTransaction = $state(false);
	let showDeleteConfirm = $state(false);
	let transactionLoading = $state(false);

	const walletId = $derived(page.params.id);

	$effect(() => {
		if (walletId) {
			loadData();
		}
	});

	async function loadData() {
		if (!walletId) return;

		loading = true;
		error = '';

		try {
			const [walletData, transactionData] = await Promise.all([
				getWallet(walletId),
				getTransactions(walletId)
			]);
			wallet = walletData;
			transactions = transactionData;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load wallet';
		} finally {
			loading = false;
		}
	}

	async function handleAddTransaction(input: CreateTransactionInput) {
		if (!wallet) return;
		transactionLoading = true;

		try {
			await createTransaction(input, wallet);
			await loadData();
			showAddTransaction = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to add transaction';
		} finally {
			transactionLoading = false;
		}
	}

	async function handleDeleteTransaction(transaction: Transaction) {
		try {
			await deleteTransaction(transaction.id);
			transactions = transactions.filter((t) => t.id !== transaction.id);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete transaction';
		}
	}

	async function handleDeleteWallet() {
		if (!wallet) return;

		try {
			await deleteWallet(wallet.id);
			await goto('/wallets');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete wallet';
		}
	}

	function formatCurrency(amount: number): string {
		if (!wallet) return '';
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: wallet.currency
		}).format(amount);
	}

	function getCategoryAmount(percentage: number): number {
		if (!wallet) return 0;
		return (wallet.balance * percentage) / 100;
	}
</script>

<svelte:head>
	<title>{wallet?.name || 'Wallet'} - MC Budget</title>
</svelte:head>

<AuthGuard>
	{#snippet children()}
		{#if loading}
			<div class="flex justify-center py-12">
				<span class="loading loading-spinner loading-lg"></span>
			</div>
		{:else if error && !wallet}
			<Alert type="error">
				{#snippet children()}{error}{/snippet}
			</Alert>
		{:else if wallet}
			{@const currentWallet = wallet}
			<div class="max-w-4xl mx-auto space-y-6">
				{#if error}
					<Alert type="error" dismissible ondismiss={() => (error = '')}>
						{#snippet children()}{error}{/snippet}
					</Alert>
				{/if}

				<!-- Header -->
				<div class="flex justify-between items-start">
					<div>
						<a href="/wallets" class="btn btn-ghost btn-sm mb-2">&larr; Back to Wallets</a>
						<h1 class="text-3xl font-bold">{currentWallet.name}</h1>
						<p class="text-4xl font-bold text-primary mt-2">
							{formatCurrency(currentWallet.balance)}
						</p>
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
						<div class="space-y-3">
							{#each currentWallet.categories as category}
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<span
											class="w-4 h-4 rounded"
											style="background-color: {category.color};"
										></span>
										<span class="font-medium">{category.name}</span>
										<span class="text-base-content/60">({category.percentage}%)</span>
									</div>
									<span class="font-semibold">
										{formatCurrency(getCategoryAmount(category.percentage))}
									</span>
								</div>
							{/each}
						</div>

						<!-- Visual bar -->
						<div class="flex h-4 rounded-full overflow-hidden bg-base-300 mt-4">
							{#each currentWallet.categories as category}
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
						<TransactionList
							{transactions}
							wallet={currentWallet}
							ondelete={handleDeleteTransaction}
						/>
					{/snippet}
				</Card>
			</div>

			<!-- Add Transaction Modal -->
			<Modal bind:open={showAddTransaction} title="Add Transaction">
				{#snippet children()}
					<TransactionForm
						wallet={currentWallet}
						onsubmit={handleAddTransaction}
						loading={transactionLoading}
					/>
				{/snippet}
			</Modal>

			<!-- Delete Confirmation Modal -->
			<Modal bind:open={showDeleteConfirm} title="Delete Wallet?">
				{#snippet children()}
					<p class="text-base-content/70">
						Are you sure you want to delete "{currentWallet.name}"? This action cannot be undone
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
		{/if}
	{/snippet}
</AuthGuard>
