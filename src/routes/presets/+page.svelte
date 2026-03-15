<script lang="ts">
	import { getPresets, createPreset, deletePreset } from '$lib/presets.remote';
	import { auth } from '$lib/stores/auth.svelte';
	import type { BudgetCategory, BudgetPreset } from '$lib/types/budget';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import Input from '$lib/components/Input.svelte';
	import BudgetCategoryList from '$lib/components/BudgetCategoryList.svelte';
	import { validateCategories } from '$lib/validation/budget';

	const presets = $derived(await getPresets());

	let showCreate = $state(false);
	let createName = $state('');
	let createDescription = $state('');
	let createCategories = $state<BudgetCategory[]>([
		{ name: 'Category 1', percentage: 100, color: '#3B82F6' }
	]);
	let creating = $state(false);
	let error = $state('');

	const categoriesValid = $derived(validateCategories(createCategories).valid);

	function resetForm() {
		createName = '';
		createDescription = '';
		createCategories = [{ name: 'Category 1', percentage: 100, color: '#3B82F6' }];
	}

	async function handleCreate() {
		creating = true;
		error = '';
		try {
			await createPreset({
				name: createName,
				description: createDescription,
				categories: createCategories
			});
			showCreate = false;
			resetForm();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create preset';
		} finally {
			creating = false;
		}
	}

	async function handleDelete(id: string) {
		try {
			await deletePreset(id);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete preset';
		}
	}

	function usePreset(preset: BudgetPreset) {
		goto(resolve('/wallets/new'));
	}
</script>

<svelte:head>
	<title>Budget Presets - MC Budget</title>
</svelte:head>

<div class="max-w-4xl mx-auto">
	<div class="flex justify-between items-start mb-6">
		<div>
			<h1 class="text-2xl font-bold">Budget Presets</h1>
			<p class="text-base-content/70 mt-2">
				Browse proven budget templates. Choose one when creating a new wallet.
			</p>
		</div>
		{#if auth.isAuthenticated}
			<Button variant="primary" onclick={() => (showCreate = true)}>+ New Preset</Button>
		{/if}
	</div>

	{#if error}
		<Alert type="error" dismissible ondismiss={() => (error = '')} class="mb-6">
			{error}
		</Alert>
	{/if}

	<div class="grid gap-6 md:grid-cols-2">
		{#each presets as preset (preset.id)}
			<Card class="h-full">
				<h2 class="text-xl font-semibold">{preset.name}</h2>
				<p class="text-base-content/70 mt-2">{preset.description}</p>

				<div class="mt-4">
					<div class="flex h-4 rounded-full overflow-hidden bg-base-300">
						{#each preset.categories as category (category.name)}
							<div
								class="h-full"
								style="width: {category.percentage}%; background-color: {category.color};"
								title="{category.name}: {category.percentage}%"
							></div>
						{/each}
					</div>

					<div class="mt-3 space-y-1">
						{#each preset.categories as category (category.name)}
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

				{#snippet actions()}
					<Button variant="primary" size="sm" onclick={() => usePreset(preset)}>
						Use This Template
					</Button>
					{#if preset.user && preset.user === auth.user?.id}
						<Button variant="error" size="sm" outline onclick={() => handleDelete(preset.id)}>
							Delete
						</Button>
					{/if}
				{/snippet}
			</Card>
		{/each}
	</div>
</div>

<!-- Create Preset Modal -->
<Modal bind:open={showCreate} title="Create Preset" onclose={resetForm}>
	<div class="space-y-4">
		<Input
			type="text"
			label="Name"
			bind:value={createName}
			placeholder="e.g. My Custom Budget"
			required
		/>
		<Input
			type="text"
			label="Description (optional)"
			bind:value={createDescription}
			placeholder="What is this budget for?"
		/>
		<div>
			<p class="label-text mb-2 font-medium">Categories</p>
			<BudgetCategoryList bind:categories={createCategories} editable />
		</div>
	</div>

	{#snippet actions()}
		<Button variant="ghost" onclick={() => { showCreate = false; resetForm(); }}>Cancel</Button>
		<Button
			variant="primary"
			disabled={!createName || !categoriesValid}
			loading={creating}
			onclick={handleCreate}
		>
			Create Preset
		</Button>
	{/snippet}
</Modal>
