<script lang="ts">
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import { getWallet, deleteWallet } from '$lib/wallets.remote';
	import {
		getTransactions,
		createTransaction,
		deleteTransaction as removeTransaction
	} from '$lib/transactions.remote';
	import type { Transaction, CreateTransactionInput, Wallet } from '$lib/types/budget';
	import AuthGuard from '$lib/components/AuthGuard.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import TransactionList from '$lib/components/TransactionList.svelte';
	import TransactionForm from '$lib/components/TransactionForm.svelte';

	let showAddTransaction = $state(false);
	let showDeleteConfirm = $state(false);
	let transactionLoading = $state(false);
	let error = $state('');

	const walletId = $derived(page.params.id!);

	// Using experimental async - load data with remote functions
	const walletPromise = $derived(getWallet(walletId));
	const transactionsPromise = $derived(getTransactions(walletId));

	async function handleAddTransaction(input: CreateTransactionInput) {
		transactionLoading = true;
		error = '';

		try {
			const wallet = await walletPromise;
			// Pass both input and wallet as required by the schema
			await createTransaction({ input, wallet });
			await invalidateAll();
			showAddTransaction = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to add transaction';
		} finally {
			transactionLoading = false;
		}
	}

	async function handleDeleteTransaction(transaction: Transaction) {
		try {
			await removeTransaction(transaction.id);
			await invalidateAll();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete transaction';
		}
	}

	async function handleDeleteWallet() {
		try {
			const wallet = await walletPromise;
			await deleteWallet(wallet.id);
			await goto('/wallets');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete wallet';
		}
	}

	function formatCurrency(amount: number, currency: string): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency
		}).format(amount);
	}

	function getCategoryAmount(balance: number, percentage: number): number {
		return (balance * percentage) / 100;
	}
</script>

<svelte:head>
	{#await walletPromise then wallet}
		<title>{wallet.name} - MC Budget</title>
	{:catch}
		<title>Wallet - MC Budget</title>
	{/await}
</svelte:head>

<AuthGuard>
	{#snippet children()}
		{#await walletPromise}
			<div class="flex justify-center py-12">
				<span class="loading loading-spinner loading-lg"></span>
			</div>
		{:then wallet}
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
						<h1 class="text-3xl font-bold">{wallet.name}</h1>
						<p class="text-4xl font-bold text-primary mt-2">
							{formatCurrency(wallet.balance, wallet.currency)}
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
							{#each wallet.categories as category}
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
										{formatCurrency(
											getCategoryAmount(wallet.balance, category.percentage),
											wallet.currency
										)}
									</span>
								</div>
							{/each}
						</div>

						<!-- Visual bar -->
						<div class="flex h-4 rounded-full overflow-hidden bg-base-300 mt-4">
							{#each wallet.categories as category}
								<div
									class="h-full"
									style="width: {category.percentage}%; background-color: {category.color};"
									title="{category.name}: {category.percentage}%"
								></div>
							{/each}
						</div>
					{/snippet}
				</Card>

				<!-- Transactions with async loading -->
				<Card title="Transactions">
					{#snippet children()}
						{#await transactionsPromise}
							<div class="flex justify-center py-4">
								<span class="loading loading-spinner"></span>
							</div>
						{:then transactions}
							<TransactionList
								{transactions}
								{wallet}
								ondelete={handleDeleteTransaction}
							/>
						{:catch err}
							<Alert type="error">
								{#snippet children()}{err.message}{/snippet}
							</Alert>
						{/await}
					{/snippet}
				</Card>
			</div>

			<!-- Add Transaction Modal -->
			<Modal bind:open={showAddTransaction} title="Add Transaction">
				{#snippet children()}
					<TransactionForm
						{wallet}
						onsubmit={handleAddTransaction}
						loading={transactionLoading}
					/>
				{/snippet}
			</Modal>

			<!-- Delete Confirmation Modal -->
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
		{:catch err}
			<Alert type="error">
				{#snippet children()}{err.message}{/snippet}
			</Alert>
		{/await}
	{/snippet}
</AuthGuard>
