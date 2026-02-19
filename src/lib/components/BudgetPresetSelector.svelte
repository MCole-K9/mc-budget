<script lang="ts">
	import type { BudgetPreset, BudgetCategory } from '$lib/types/budget';
	import Card from './Card.svelte';

	interface Props {
		presets: BudgetPreset[];
		selected?: string;
		onselect: (preset: BudgetPreset) => void;
	}

	let { presets, selected, onselect }: Props = $props();

	function formatCategories(categories: BudgetCategory[]): string {
		return categories.map((c) => `${c.name} (${c.percentage}%)`).join(', ');
	}
</script>

<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
	{#each presets as preset}
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
						{#each preset.categories as category}
							<span
								class="badge badge-sm"
								style="background-color: {category.color}; color: white;"
							>
								{category.name}: {category.percentage}%
							</span>
						{/each}
					</div>
				{/snippet}
			</Card>
		</button>
	{/each}
</div>
