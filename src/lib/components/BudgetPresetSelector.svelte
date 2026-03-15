<script lang="ts">
	import type { BudgetPreset } from '$lib/types/budget';
	import Card from './Card.svelte';

	interface Props {
		presets: BudgetPreset[];
		selected?: string;
		budgetType?: 'percentage' | 'fixed';
		onselect: (preset: BudgetPreset) => void;
	}

	let { presets, selected, budgetType = 'percentage', onselect }: Props = $props();
</script>

<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
	{#each presets as preset (preset.id)}
		<button
			type="button"
			class="text-left w-full"
			onclick={() => onselect(preset)}
		>
			<Card
				class="h-full transition-all hover:shadow-md {selected === preset.id
					? 'ring-2 ring-primary'
					: ''}"
			>
				{#snippet children()}
					<h3 class="font-semibold text-lg">{preset.name}</h3>
					<p class="text-sm text-base-content/70 mt-1">{preset.description}</p>
					<div class="mt-3 flex flex-wrap gap-1">
						{#each preset.categories as category (category.name)}
							<span
								class="badge badge-sm"
								style="background-color: {category.color}; color: white;"
							>
								{category.name}{budgetType === 'percentage' ? ': ' + category.percentage + '%' : ''}
							</span>
						{/each}
					</div>
				{/snippet}
			</Card>
		</button>
	{/each}
</div>
