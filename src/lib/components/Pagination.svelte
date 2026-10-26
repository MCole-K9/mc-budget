<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		page: number;
		totalPages: number;
		totalItems: number;
		onchange: (page: number) => void;
	}

	let { page, totalPages, totalItems, onchange }: Props = $props();
</script>

<div class="flex items-center justify-between gap-3">
	<span class="text-sm text-base-content/50">
		{totalItems} transaction{totalItems !== 1 ? 's' : ''}
	</span>
	{#if totalPages > 1}
		<div class="flex items-center gap-1">
			<button
				class="btn btn-square btn-ghost btn-sm"
				disabled={page <= 1}
				onclick={() => onchange(page - 1)}
				aria-label="Previous page"
			>
				<Icon name="chevron-left" class="size-4" />
			</button>
			<span class="min-w-16 text-center text-sm text-base-content/70 tabular-nums">
				{page} / {totalPages}
			</span>
			<button
				class="btn btn-square btn-ghost btn-sm"
				disabled={page >= totalPages}
				onclick={() => onchange(page + 1)}
				aria-label="Next page"
			>
				<Icon name="chevron-right" class="size-4" />
			</button>
		</div>
	{/if}
</div>
