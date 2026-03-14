<script lang="ts">
	import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
	import type { Transaction, Wallet } from '$lib/types/budget';

	interface Props {
		transactions: Transaction[];
		wallet: Wallet;
		ondelete?: (transaction: Transaction) => void;
	}

	let { transactions, wallet, ondelete }: Props = $props();

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: wallet.currency
		}).format(Math.abs(amount));
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getCategoryColor(categoryName: string): string {
		const category = wallet.categories.find(
			(c) => c.name.toLowerCase() === categoryName.toLowerCase()
		);
		return category?.color || '#6B7280';
	}

	function getReceiptUrl(transaction: Transaction): string | null {
		if (!transaction.receipt) return null;
		return `${PUBLIC_POCKETBASE_URL}/api/files/transactions/${transaction.id}/${transaction.receipt}`;
	}
</script>

{#if transactions.length === 0}
	<div class="text-center py-8 text-base-content/60">
		<p>No transactions yet</p>
		<p class="text-sm mt-1">Add your first transaction to get started</p>
	</div>
{:else}
	<div class="divide-y divide-base-300">
		{#each transactions as transaction (transaction.id)}
			{@const receiptUrl = getReceiptUrl(transaction)}
			<div class="flex items-center justify-between py-3">
				<div class="flex items-center gap-3">
					<span
						class="w-3 h-3 rounded-full"
						style="background-color: {getCategoryColor(transaction.category)};"
					></span>
					<div>
						<p class="font-medium flex items-center gap-1">
							{transaction.description || transaction.category}
							{#if transaction.recurring}
								<span class="text-base-content/40 text-xs" title="Repeats monthly on day {transaction.recur_day}">↻</span>
							{/if}
						</p>
						<p class="text-sm text-base-content/60">
							{transaction.category} &middot; {formatDate(transaction.date)}
						</p>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<span
						class={['font-semibold', transaction.amount < 0 ? 'text-error' : 'text-success']}
					>
						{transaction.amount < 0 ? '-' : '+'}{formatCurrency(transaction.amount)}
					</span>
					{#if receiptUrl}
						<a
							href={receiptUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="btn btn-ghost btn-xs text-base-content/50"
							title="View receipt"
						>
							🧾
						</a>
					{/if}
					{#if ondelete}
						<button
							class="btn btn-ghost btn-xs text-error"
							onclick={() => ondelete(transaction)}
						>
							✕
						</button>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}
