<script lang="ts">
	import type { Wallet } from '$lib/types/budget';
	import Card from './Card.svelte';

	interface Props {
		wallet: Wallet;
		onclick?: () => void;
	}

	let { wallet, onclick }: Props = $props();

	function formatCurrency(amount: number, currency: string): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency
		}).format(amount);
	}
</script>

<button type="button" class="text-left w-full" onclick={onclick}>
	<Card class="h-full transition-all hover:shadow-md cursor-pointer">
		{#snippet children()}
			<div class="flex justify-between items-start mb-5">
				<div>
					<p class="text-xs font-medium text-base-content/40 uppercase tracking-wider mb-0.5">{wallet.currency}</p>
					<h3 class="font-semibold text-lg leading-tight">{wallet.name}</h3>
				</div>
				<p class="text-2xl font-bold text-primary tabular-nums">
					{formatCurrency(wallet.balance, wallet.currency)}
				</p>
			</div>

			<div class="flex h-2 rounded-full overflow-hidden bg-base-200">
				{#each wallet.categories as category (category.name)}
					<div
						class="h-full"
						style="width: {category.percentage}%; background-color: {category.color};"
						title="{category.name}: {category.percentage}%"
					></div>
				{/each}
			</div>
			<div class="flex flex-wrap gap-x-3 gap-y-1 mt-2.5">
				{#each wallet.categories as category (category.name)}
					<div class="flex items-center gap-1 text-xs text-base-content/50">
						<span
							class="w-2 h-2 rounded-full shrink-0"
							style="background-color: {category.color};"
						></span>
						<span>{category.name}</span>
					</div>
				{/each}
			</div>
		{/snippet}
	</Card>
</button>
