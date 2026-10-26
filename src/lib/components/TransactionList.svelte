<script lang="ts">
	import { env } from '$env/dynamic/public';
	import type { Transaction, Wallet } from '$lib/types/budget';
	import EmptyState from './EmptyState.svelte';
	import Icon from './Icon.svelte';
	import TransactionGroups from './TransactionGroups.svelte';
	import TransactionRow from './TransactionRow.svelte';

	interface Props {
		transactions: Transaction[];
		wallet: Wallet;
		ondelete?: (transaction: Transaction) => void;
		onedit?: (transaction: Transaction) => void;
	}

	let { transactions, wallet, ondelete, onedit }: Props = $props();

	function getCategoryColor(transaction: Transaction): string | null {
		const cat = wallet.categories.find(
			(c) => c.name.toLowerCase() === transaction.category.toLowerCase()
		);
		return cat?.color ?? null;
	}

	function getReceiptUrl(transaction: Transaction): string | null {
		if (!transaction.receipt) return null;
		return `${env.PUBLIC_POCKETBASE_URL}/api/files/transactions/${transaction.id}/${transaction.receipt}`;
	}
</script>

{#if transactions.length === 0}
	<EmptyState
		plain
		icon="receipt"
		title="No transactions in this period"
		description="Add one, or pick a different period above."
	/>
{:else}
	<TransactionGroups items={transactions} surface={false}>
		{#snippet row(transaction)}
			{@const receiptUrl = getReceiptUrl(transaction)}
			<TransactionRow
				{transaction}
				currency={wallet.currency}
				color={getCategoryColor(transaction)}
			>
				{#snippet actions()}
					{#if receiptUrl}
						<!-- eslint-disable svelte/no-navigation-without-resolve -- external file URL -->
						<a
							href={receiptUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="btn btn-square text-base-content/50 btn-ghost btn-xs hover:text-base-content"
							title="View receipt"
							aria-label="View receipt"
						>
							<Icon name="receipt" class="size-4" />
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{/if}
					{#if onedit && !transaction.transfer_id && !transaction.balance_adjustment}
						<button
							class="btn btn-square text-base-content/50 btn-ghost btn-xs hover:text-base-content"
							onclick={() => onedit(transaction)}
							title="Edit transaction"
							aria-label="Edit transaction"
						>
							<Icon name="pencil" class="size-4" />
						</button>
					{/if}
					{#if ondelete}
						<button
							class="btn btn-square text-base-content/50 btn-ghost btn-xs hover:text-error"
							onclick={() => ondelete(transaction)}
							title="Delete transaction"
							aria-label="Delete transaction"
						>
							<Icon name="trash" class="size-4" />
						</button>
					{/if}
				{/snippet}
			</TransactionRow>
		{/snippet}
	</TransactionGroups>
{/if}
