<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Wallet } from '$lib/types/budget';
	import { formatCurrency } from '$lib/utils/format';
	import Icon from './Icon.svelte';

	interface Props {
		wallet: Wallet;
	}

	let { wallet }: Props = $props();

	// Fixed-amount wallets have no percentages; size the bar by each category's share of the total
	const shares = $derived.by(() => {
		if (wallet.budget_type !== 'fixed') return wallet.categories.map((c) => c.percentage);
		const total = wallet.categories.reduce((s, c) => s + (c.fixedAmount ?? 0), 0);
		return wallet.categories.map((c) => (total > 0 ? ((c.fixedAmount ?? 0) / total) * 100 : 0));
	});
</script>

<a
	href={resolve('/wallets/[id]', { id: wallet.id })}
	class="group flex h-full flex-col surface p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
>
	<div class="flex items-start justify-between gap-3">
		<div class="flex min-w-0 items-center gap-3">
			<span class="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
				<Icon name="wallet" class="size-5" />
			</span>
			<div class="min-w-0">
				<h3 class="truncate leading-tight font-semibold">{wallet.name}</h3>
				<p class="mt-0.5 text-xs text-base-content/50">
					{wallet.currency} · {wallet.budget_type === 'fixed' ? 'Fixed limits' : '% of income'}
				</p>
			</div>
		</div>
		<Icon
			name="chevron-right"
			class="mt-2.5 size-4 text-base-content/30 transition-transform group-hover:translate-x-0.5 group-hover:text-base-content/60"
		/>
	</div>

	<p class="mt-5 text-[1.75rem] leading-none font-bold tracking-tight tabular-nums">
		{formatCurrency(wallet.balance, wallet.currency)}
	</p>

	<div class="mt-auto pt-5">
		<div class="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
			{#each wallet.categories as category, i (category.name)}
				<div
					class="h-full first:rounded-l-full last:rounded-r-full"
					style:width="{shares[i]}%"
					style:background-color={category.color}
					title="{category.name}: {Math.round(shares[i])}%"
				></div>
			{/each}
		</div>
		<div class="mt-3 flex flex-wrap gap-x-3 gap-y-1">
			{#each wallet.categories as category (category.name)}
				<span class="flex items-center gap-1.5 text-xs text-base-content/55">
					<span class="size-2 shrink-0 rounded-full" style:background-color={category.color}></span>
					{category.name}
				</span>
			{/each}
		</div>
	</div>
</a>
