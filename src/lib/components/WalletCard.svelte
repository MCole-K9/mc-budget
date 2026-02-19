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
			<div class="flex justify-between items-start">
				<div>
					<h3 class="font-semibold text-lg">{wallet.name}</h3>
					<p class="text-2xl font-bold text-primary mt-1">
						{formatCurrency(wallet.balance, wallet.currency)}
					</p>
				</div>
				<span class="badge badge-ghost">{wallet.currency}</span>
			</div>

			<div class="mt-4">
				<p class="text-sm text-base-content/70 mb-2">Budget Allocation</p>
				<div class="flex h-3 rounded-full overflow-hidden bg-base-300">
					{#each wallet.categories as category}
						<div
							class="h-full"
							style="width: {category.percentage}%; background-color: {category.color};"
							title="{category.name}: {category.percentage}%"
						></div>
					{/each}
				</div>
				<div class="flex flex-wrap gap-2 mt-2">
					{#each wallet.categories as category}
						<div class="flex items-center gap-1 text-xs">
							<span
								class="w-2 h-2 rounded-full"
								style="background-color: {category.color};"
							></span>
							<span>{category.name}</span>
						</div>
					{/each}
				</div>
			</div>
		{/snippet}
	</Card>
</button>
