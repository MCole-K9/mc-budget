<script lang="ts">
	import type { BudgetCategory } from '$lib/types/budget';

	interface Props {
		category: BudgetCategory;
		budgetType?: 'percentage' | 'fixed';
		onremove?: () => void;
		onchange?: (category: BudgetCategory) => void;
	}

	let { category = $bindable(), budgetType = 'percentage', onremove, onchange }: Props = $props();

	function handleChange() {
		onchange?.(category);
	}
</script>

<div class="flex items-center gap-2 p-2 bg-base-200 rounded-lg">
	<input
		type="color"
		bind:value={category.color}
		onchange={handleChange}
		class="w-10 h-10 rounded cursor-pointer border-0"
	/>
	<input
		type="text"
		bind:value={category.name}
		onchange={handleChange}
		placeholder="Category name"
		class="input input-sm input-bordered flex-1"
	/>
	{#if budgetType === 'fixed'}
		<div class="flex items-center gap-1">
			<input
				type="number"
				bind:value={category.fixedAmount}
				onchange={handleChange}
				min="0"
				step="0.01"
				placeholder="0.00"
				class="input input-sm input-bordered w-28 text-right"
			/>
		</div>
	{:else}
		<div class="flex items-center gap-1">
			<input
				type="number"
				bind:value={category.percentage}
				onchange={handleChange}
				min="0"
				max="100"
				step="1"
				class="input input-sm input-bordered w-20 text-right"
			/>
			<span class="text-sm">%</span>
		</div>
	{/if}
	{#if onremove}
		<button
			type="button"
			class="btn btn-sm btn-ghost btn-circle text-error"
			onclick={onremove}
		>
			✕
		</button>
	{/if}
</div>
