<script lang="ts">
	import { goto } from '$app/navigation';
	import { getPresets } from '$lib/api/presets';
	import type { BudgetPreset } from '$lib/types/budget';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Alert from '$lib/components/Alert.svelte';

	let presets = $state<BudgetPreset[]>([]);
	let loading = $state(true);
	let error = $state('');

	$effect(() => {
		loadPresets();
	});

	async function loadPresets() {
		loading = true;
		try {
			presets = await getPresets();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load presets';
		} finally {
			loading = false;
		}
	}

	function usePreset(preset: BudgetPreset) {
		// Navigate to wallet creation with preset pre-selected
		goto('/wallets/new');
	}
</script>

<svelte:head>
	<title>Budget Presets - MC Budget</title>
</svelte:head>

<div class="max-w-4xl mx-auto">
	<div class="mb-6">
		<h1 class="text-3xl font-bold">Budget Presets</h1>
		<p class="text-base-content/70 mt-2">
			Browse proven budget templates. Choose one when creating a new wallet.
		</p>
	</div>

	{#if error}
		<Alert type="error">
			{#snippet children()}{error}{/snippet}
		</Alert>
	{:else if loading}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else}
		<div class="grid gap-6 md:grid-cols-2">
			{#each presets as preset}
				<Card class="h-full">
					{#snippet children()}
						<h2 class="text-xl font-semibold">{preset.name}</h2>
						<p class="text-base-content/70 mt-2">{preset.description}</p>

						<div class="mt-4">
							<div class="flex h-4 rounded-full overflow-hidden bg-base-300">
								{#each preset.categories as category}
									<div
										class="h-full"
										style="width: {category.percentage}%; background-color: {category.color};"
										title="{category.name}: {category.percentage}%"
									></div>
								{/each}
							</div>

							<div class="mt-3 space-y-1">
								{#each preset.categories as category}
									<div class="flex items-center justify-between text-sm">
										<div class="flex items-center gap-2">
											<span
												class="w-3 h-3 rounded"
												style="background-color: {category.color};"
											></span>
											<span>{category.name}</span>
										</div>
										<span class="font-medium">{category.percentage}%</span>
									</div>
								{/each}
							</div>
						</div>
					{/snippet}
					{#snippet actions()}
						<Button variant="primary" size="sm" onclick={() => usePreset(preset)}>
							Use This Template
						</Button>
					{/snippet}
				</Card>
			{/each}
		</div>
	{/if}
</div>
