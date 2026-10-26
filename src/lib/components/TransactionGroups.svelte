<script lang="ts" generics="T extends { id: string; date: string }">
	import type { Snippet } from 'svelte';
	import { groupByDate } from '$lib/utils/format';
	import { formatRelativeDate } from '$lib/utils/dateRange';

	interface Props {
		items: T[];
		row: Snippet<[T]>;
		/** Wrap each day's rows in a card surface (off when already inside a card) */
		surface?: boolean;
	}

	let { items, row, surface = true }: Props = $props();

	const groups = $derived(groupByDate(items));
</script>

<div class="space-y-5">
	{#each groups as { date, items: dayItems } (date)}
		<section>
			<h3 class="mb-2 px-1 eyebrow">{formatRelativeDate(date)}</h3>
			<div
				class={[
					'divide-y divide-base-300/60 overflow-hidden',
					surface ? 'surface' : 'rounded-box border border-base-300/60'
				]}
			>
				{#each dayItems as item (item.id)}
					{@render row(item)}
				{/each}
			</div>
		</section>
	{/each}
</div>
