<script lang="ts">
	import type { BudgetPreset } from '$lib/types/budget';
	import Icon from './Icon.svelte';

	interface Props {
		presets: BudgetPreset[];
		selected?: string;
		budgetType?: 'percentage' | 'fixed';
		onselect: (preset: BudgetPreset) => void;
	}

	let { presets, selected, budgetType = 'percentage', onselect }: Props = $props();
</script>

<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
	{#each presets as preset (preset.id)}
		{@const isSelected = selected === preset.id}
		<button
			type="button"
			class={[
				'group flex h-full flex-col surface p-4 text-left transition-all hover:border-primary/40 hover:shadow-md',
				isSelected && 'border-primary ring-2 ring-primary/20'
			]}
			onclick={() => onselect(preset)}
		>
			<div class="flex items-start justify-between gap-2">
				<h3 class="font-semibold">{preset.name}</h3>
				<Icon
					name={isSelected ? 'circle-check' : 'chevron-right'}
					class={[
						'size-4',
						isSelected ? 'text-primary' : 'text-base-content/30 group-hover:text-base-content/60'
					]}
				/>
			</div>
			<p class="mt-1 text-sm text-base-content/55">{preset.description}</p>
			<div class="mt-auto pt-4">
				{#if budgetType === 'percentage'}
					<div class="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
						{#each preset.categories as category (category.name)}
							<div
								class="h-full"
								style:width="{category.percentage}%"
								style:background-color={category.color}
							></div>
						{/each}
					</div>
				{/if}
				<div class="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
					{#each preset.categories as category (category.name)}
						<span class="flex items-center gap-1.5 text-xs text-base-content/60">
							<span class="size-2 rounded-full" style:background-color={category.color}></span>
							{category.name}{#if budgetType === 'percentage'}
								<span class="text-base-content/40 tabular-nums">{category.percentage}%</span>
							{/if}
						</span>
					{/each}
				</div>
			</div>
		</button>
	{/each}
</div>
