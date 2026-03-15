<script lang="ts">
	import { env } from '$env/dynamic/public';
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

	function getCategoryColor(transaction: Transaction): string {
		if (transaction.amount > 0) return '#22c55e';
		const cat = wallet.categories.find(
			(c) => c.name.toLowerCase() === transaction.category.toLowerCase()
		);
		return cat?.color ?? '#9ca3af';
	}

	function getReceiptUrl(transaction: Transaction): string | null {
		if (!transaction.receipt) return null;
		return `${env.PUBLIC_POCKETBASE_URL}/api/files/transactions/${transaction.id}/${transaction.receipt}`;
	}

	const grouped = $derived(
		transactions.reduce<{ date: string; items: Transaction[] }[]>((acc, tx) => {
			const datePart = tx.date.split('T')[0].split(' ')[0];
			const last = acc[acc.length - 1];
			if (last?.date === datePart) last.items.push(tx);
			else acc.push({ date: datePart, items: [tx] });
			return acc;
		}, [])
	);
</script>

{#if transactions.length === 0}
	<div class="py-12 text-center">
		<p class="text-base-content/40 text-sm">No transactions in this period</p>
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
				<div class="rounded-2xl overflow-hidden">
					<div class="divide-y divide-base-200/60">
						{#each items as transaction (transaction.id)}
							{@const receiptUrl = getReceiptUrl(transaction)}
							{@const color = getCategoryColor(transaction)}
							<div class="flex items-center gap-3 px-4 py-3 hover:bg-base-200/50 transition-colors bg-base-100">
								<span
									class="w-2.5 h-2.5 rounded-full shrink-0"
									style="background-color: {color};"
								></span>

								<div class="flex-1 min-w-0">
									<p class="font-medium text-sm leading-snug truncate">
										{transaction.description || transaction.category}
										{#if transaction.recurring}
											<span class="text-base-content/30 text-xs ml-1" title="Recurring">↻</span>
										{/if}
									</p>
									<p class="text-xs text-base-content/40 truncate">{transaction.category}</p>
								</div>

								<div class="flex items-center gap-1 shrink-0">
									<span class="font-semibold text-sm {transaction.amount < 0 ? 'text-error' : 'text-success'}">
										{transaction.amount < 0 ? '−' : '+'}{formatCurrency(transaction.amount)}
									</span>
									{#if receiptUrl}
										<a
											href={receiptUrl}
											target="_blank"
											rel="noopener noreferrer"
											class="btn btn-ghost btn-xs text-base-content/30 hover:text-base-content/70"
											title="View receipt"
										>🧾</a>
									{/if}
									{#if ondelete}
										<button
											class="btn btn-ghost btn-xs text-base-content/20 hover:text-error"
											onclick={() => ondelete(transaction)}
										>✕</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
