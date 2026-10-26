<script lang="ts">
	import type { BudgetCategory } from '$lib/types/budget';
	import { calculateCategoryTotal, validateCategories } from '$lib/validation/budget';
	import BudgetCategoryInput from './BudgetCategoryInput.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		categories: BudgetCategory[];
		editable?: boolean;
		budgetType?: 'percentage' | 'fixed';
		onchange?: (categories: BudgetCategory[]) => void;
	}

	let {
		categories = $bindable(),
		editable = true,
		budgetType = 'percentage',
		onchange
	}: Props = $props();

	const total = $derived(calculateCategoryTotal(categories));
	const isValid = $derived(validateCategories(categories, budgetType).valid);

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

<div class="space-y-2">
	{#each categories as category, index (index)}
		<BudgetCategoryInput
			bind:category={categories[index]}
			{budgetType}
			onchange={handleCategoryChange}
			onremove={editable && categories.length > 1 ? () => removeCategory(index) : undefined}
		/>
	{/each}

	{#if editable}
		<button
			type="button"
			class="btn w-full border-dashed border-base-300 btn-ghost btn-sm"
			onclick={addCategory}
		>
			<Icon name="plus" class="size-4" />
			Add category
		</button>
	{/if}

	{#if budgetType !== 'fixed'}
		<div class="pt-2">
			<div class="mb-1.5 flex items-center justify-between text-sm">
				<span class="text-base-content/60">Allocated</span>
				<span class={['font-semibold tabular-nums', isValid ? 'text-success' : 'text-error']}>
					{total.toFixed(1)}% of 100%
				</span>
			</div>
			<div class="flex h-2 gap-0.5 overflow-hidden rounded-full bg-base-200">
				{#each categories as category, i (i)}
					<div
						class="h-full transition-all"
						style:width="{Math.max(0, category.percentage)}%"
						style:background-color={category.color}
					></div>
				{/each}
			</div>
			{#if !isValid}
				<p class="mt-2 text-xs text-error">
					{total > 100
						? `Over by ${(total - 100).toFixed(1)}% — categories must total exactly 100%`
						: `${(100 - total).toFixed(1)}% left to allocate — categories must total exactly 100%`}
				</p>
			{/if}
		</div>
	{/if}
</div>
