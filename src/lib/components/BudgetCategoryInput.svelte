<script lang="ts">
	import type { BudgetCategory } from '$lib/types/budget';
	import Icon from './Icon.svelte';

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

<div class="flex items-center gap-2 rounded-field border border-base-300/70 bg-base-100 p-1.5">
	<label
		class="relative size-9 shrink-0 cursor-pointer rounded-lg ring-1 ring-black/5 ring-inset"
		style:background-color={category.color}
		title="Change color"
	>
		<input
			type="color"
			bind:value={category.color}
			onchange={handleChange}
			class="absolute inset-0 cursor-pointer opacity-0"
			aria-label="Category color"
		/>
	</label>
	<input
		type="text"
		bind:value={category.name}
		onchange={handleChange}
		placeholder="Category name"
		aria-label="Category name"
		class="input input-sm min-w-0 flex-1 border-transparent bg-transparent shadow-none focus:border-base-300"
	/>
	{#if budgetType === 'fixed'}
		<label class="input input-sm w-32 shrink-0">
			<input
				type="number"
				bind:value={category.fixedAmount}
				onchange={handleChange}
				min="0"
				step="0.01"
				placeholder="0.00"
				aria-label="Fixed amount"
				class="text-right tabular-nums"
			/>
		</label>
	{:else}
		<label class="input input-sm w-24 shrink-0">
			<input
				type="number"
				bind:value={category.percentage}
				onchange={handleChange}
				min="0"
				max="100"
				step="1"
				aria-label="Percentage"
				class="text-right tabular-nums"
			/>
			<span class="text-base-content/50">%</span>
		</label>
	{/if}
	{#if onremove}
		<button
			type="button"
			class="btn btn-square text-base-content/40 btn-ghost btn-sm hover:text-error"
			onclick={onremove}
			aria-label="Remove category"
		>
			<Icon name="trash" class="size-4" />
		</button>
	{/if}
</div>
