<script lang="ts">
	import { getPresets, createPreset, deletePreset } from '$lib/presets.remote';
	import { auth } from '$lib/stores/auth.svelte';
	import type { BudgetCategory, BudgetPreset } from '$lib/types/budget';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Icon from '$lib/components/Icon.svelte';
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
		goto(resolve('/wallets/new'), { state: { presetId: preset.id } });
	}
</script>

<svelte:head>
	<title>Budget Presets - MC Budget</title>
</svelte:head>

<PageHeader
	title="Budget presets"
	subtitle="Proven templates for splitting your income. Pick one when you create a wallet."
>
	{#snippet actions()}
		{#if auth.isAuthenticated}
			<Button size="sm" icon="plus" onclick={() => (showCreate = true)}>New preset</Button>
		{/if}
	{/snippet}
</PageHeader>

{#if error}
	<Alert type="error" dismissible ondismiss={() => (error = '')} class="mb-6">
		{error}
	</Alert>
{/if}

<div class="grid gap-4 md:grid-cols-2">
	{#each presets as preset (preset.id)}
		{@const isOwn = !!preset.user && preset.user === auth.user?.id}
		<div class="surface flex h-full flex-col p-5">
			<div class="flex items-start justify-between gap-3">
				<div>
					<h2 class="text-lg font-semibold">{preset.name}</h2>
					{#if preset.description}
						<p class="mt-1 text-sm text-base-content/60">{preset.description}</p>
					{/if}
				</div>
				{#if isOwn}
					<span class="badge shrink-0 badge-soft badge-sm badge-primary">Yours</span>
				{/if}
			</div>

			<div class="mt-5 flex h-2 gap-0.5 overflow-hidden rounded-full">
				{#each preset.categories as category (category.name)}
					<div
						class="h-full"
						style:width="{category.percentage}%"
						style:background-color={category.color}
						title="{category.name}: {category.percentage}%"
					></div>
				{/each}
			</div>

			<ul class="mt-4 space-y-1.5">
				{#each preset.categories as category (category.name)}
					<li class="flex items-center justify-between text-sm">
						<span class="flex items-center gap-2">
							<span class="size-2.5 rounded-full" style:background-color={category.color}></span>
							{category.name}
						</span>
						<span class="font-medium text-base-content/70 tabular-nums">{category.percentage}%</span>
					</li>
				{/each}
			</ul>

			<div class="mt-auto flex justify-end gap-2 pt-5">
				{#if isOwn}
					<Button
						variant="ghost"
						size="sm"
						icon="trash"
						class="text-error"
						onclick={() => handleDelete(preset.id)}
					>
						Delete
					</Button>
				{/if}
				<Button variant="soft" size="sm" onclick={() => usePreset(preset)}>
					Use this template
					<Icon name="arrow-right" class="size-4" />
				</Button>
			</div>
		</div>
	{/each}
</div>

<!-- Create Preset Modal -->
<Modal
	bind:open={showCreate}
	title="Create preset"
	description="Save a split you can reuse for new wallets."
	onclose={resetForm}
>
	<div class="space-y-4">
		<Input
			type="text"
			label="Name"
			bind:value={createName}
			placeholder="e.g. My custom budget"
			required
		/>
		<Input
			type="text"
			label="Description (optional)"
			bind:value={createDescription}
			placeholder="What is this budget for?"
		/>
		<div>
			<p class="mb-2 text-sm font-medium text-base-content/80">Categories</p>
			<BudgetCategoryList bind:categories={createCategories} editable />
		</div>
	</div>

	{#snippet actions()}
		<Button
			variant="ghost"
			onclick={() => {
				showCreate = false;
				resetForm();
			}}>Cancel</Button
		>
		<Button
			variant="primary"
			disabled={!createName || !categoriesValid}
			loading={creating}
			onclick={handleCreate}
		>
			Create preset
		</Button>
	{/snippet}
</Modal>
