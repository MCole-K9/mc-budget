<script lang="ts">
	import type { BudgetCategory } from '$lib/types/budget';
	import { calculateCategoryTotal } from '$lib/validation/budget';
	import BudgetCategoryInput from './BudgetCategoryInput.svelte';

	interface Props {
		categories: BudgetCategory[];
		editable?: boolean;
		onchange?: (categories: BudgetCategory[]) => void;
	}

	let { categories = $bindable(), editable = true, onchange }: Props = $props();

	const total = $derived(calculateCategoryTotal(categories));
	const isValid = $derived(Math.abs(total - 100) < 0.01);

	const defaultColors = [
		'#3B82F6',
		'#8B5CF6',
		'#10B981',
		'#F59E0B',
		'#EF4444',
		'#06B6D4',
		'#EC4899',
		'#6366F1'
	];

	function addCategory() {
		const newCategory: BudgetCategory = {
			name: '',
			percentage: 0,
			color: defaultColors[categories.length % defaultColors.length]
		};
		categories = [...categories, newCategory];
		onchange?.(categories);
	}

	function removeCategory(index: number) {
		categories = categories.filter((_, i) => i !== index);
		onchange?.(categories);
	}

	function handleCategoryChange() {
		onchange?.(categories);
	}
</script>

<div class="space-y-3">
	{#each categories as category, index}
		<BudgetCategoryInput
			bind:category={categories[index]}
			onchange={handleCategoryChange}
			onremove={editable && categories.length > 1 ? () => removeCategory(index) : undefined}
		/>
	{/each}

	{#if editable}
		<button type="button" class="btn btn-sm btn-ghost w-full" onclick={addCategory}>
			+ Add Category
		</button>
	{/if}

	<div
		class="flex justify-between items-center p-2 rounded-lg {isValid
			? 'bg-success/10 text-success'
			: 'bg-error/10 text-error'}"
	>
		<span class="font-medium">Total:</span>
		<span class="font-bold">{total.toFixed(1)}%</span>
	</div>

	{#if !isValid}
		<p class="text-sm text-error">Categories must total exactly 100%</p>
	{/if}
</div>
