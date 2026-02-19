<script lang="ts">
	import { goto } from '$app/navigation';
	import { createWallet } from '$lib/wallets.remote';
	import { getPresets } from '$lib/presets.remote';
	import type { BudgetPreset, BudgetCategory } from '$lib/types/budget';
	import AuthGuard from '$lib/components/AuthGuard.svelte';
	import Input from '$lib/components/Input.svelte';
	import Select from '$lib/components/Select.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import BudgetPresetSelector from '$lib/components/BudgetPresetSelector.svelte';
	import BudgetCategoryList from '$lib/components/BudgetCategoryList.svelte';
	import { validateCategories } from '$lib/validation/budget';

	let step = $state<'preset' | 'customize' | 'details'>('preset');
	let name = $state('');
	let balance = $state<number | ''>(0);
	let currency = $state('USD');
	let categories = $state<BudgetCategory[]>([]);
	let selectedPresetId = $state<string | undefined>(undefined);
	let loading = $state(false);
	let error = $state('');

	// Load presets using experimental async
	const presets = await getPresets();

	const currencyOptions = [
		{ value: 'USD', label: 'USD - US Dollar' },
		{ value: 'EUR', label: 'EUR - Euro' },
		{ value: 'GBP', label: 'GBP - British Pound' },
		{ value: 'JPY', label: 'JPY - Japanese Yen' },
		{ value: 'CAD', label: 'CAD - Canadian Dollar' },
		{ value: 'AUD', label: 'AUD - Australian Dollar' }
	];

	const categoriesValid = $derived(validateCategories(categories).valid);

	function handlePresetSelect(preset: BudgetPreset) {
		selectedPresetId = preset.id;
		categories = JSON.parse(JSON.stringify(preset.categories));
		step = 'customize';
	}

	function handleCustomBudget() {
		selectedPresetId = undefined;
		categories = [{ name: 'Category 1', percentage: 100, color: '#3B82F6' }];
		step = 'customize';
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';

		if (!categoriesValid) {
			error = 'Categories must total exactly 100%';
			return;
		}

		loading = true;

		try {
			const wallet = await createWallet({
				name: name.trim(),
				balance: Number(balance) || 0,
				currency,
				categories
			});
			await goto(`/wallets/${wallet.id}`);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create wallet';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Create Wallet - MC Budget</title>
</svelte:head>

<AuthGuard>
	{#snippet children()}
		<div class="max-w-4xl mx-auto">
			<h1 class="text-3xl font-bold mb-6">Create New Wallet</h1>

			{#if error}
				<Alert type="error" dismissible ondismiss={() => (error = '')} class="mb-6">
					{#snippet children()}{error}{/snippet}
				</Alert>
			{/if}

			<!-- Progress Steps -->
			<ul class="steps steps-horizontal w-full mb-8">
				<li
					class="step {step === 'preset' || step === 'customize' || step === 'details'
						? 'step-primary'
						: ''}"
				>
					Choose Template
				</li>
				<li class="step {step === 'customize' || step === 'details' ? 'step-primary' : ''}">
					Customize Budget
				</li>
				<li class="step {step === 'details' ? 'step-primary' : ''}">Wallet Details</li>
			</ul>

			{#if step === 'preset'}
				<div class="space-y-6">
					<p class="text-base-content/70">
						Choose a budget template to get started, or create a custom budget.
					</p>

					<BudgetPresetSelector
						{presets}
						selected={selectedPresetId}
						onselect={handlePresetSelect}
					/>

					<div class="divider">OR</div>

					<button type="button" class="btn btn-outline w-full" onclick={handleCustomBudget}>
						Create Custom Budget
					</button>
				</div>
			{:else if step === 'customize'}
				<Card title="Customize Your Budget">
					{#snippet children()}
						<p class="text-base-content/70 mb-4">
							Adjust categories and percentages. Total must equal 100%.
						</p>

						<BudgetCategoryList bind:categories editable />

						<div class="flex gap-2 mt-6">
							<Button variant="ghost" onclick={() => (step = 'preset')}>Back</Button>
							<Button
								variant="primary"
								class="flex-1"
								disabled={!categoriesValid}
								onclick={() => (step = 'details')}
							>
								Continue
							</Button>
						</div>
					{/snippet}
				</Card>
			{:else if step === 'details'}
				<Card title="Wallet Details">
					{#snippet children()}
						<form onsubmit={handleSubmit} class="space-y-4">
							<Input
								type="text"
								label="Wallet Name"
								bind:value={name}
								placeholder="e.g., Main Budget, Savings"
								required
							/>

							<Input
								type="number"
								label="Starting Balance"
								bind:value={balance}
								placeholder="0.00"
								min="0"
								step="0.01"
								required
							/>

							<Select
								label="Currency"
								bind:value={currency}
								options={currencyOptions}
								required
							/>

							<div class="bg-base-200 p-4 rounded-lg">
								<h4 class="font-medium mb-2">Budget Summary</h4>
								<div class="flex flex-wrap gap-2">
									{#each categories as category}
										<span
											class="badge"
											style="background-color: {category.color}; color: white;"
										>
											{category.name}: {category.percentage}%
										</span>
									{/each}
								</div>
							</div>

							<div class="flex gap-2 mt-6">
								<Button variant="ghost" onclick={() => (step = 'customize')}>Back</Button>
								<Button type="submit" variant="primary" class="flex-1" {loading}>
									Create Wallet
								</Button>
							</div>
						</form>
					{/snippet}
				</Card>
			{/if}
		</div>
	{/snippet}
</AuthGuard>
