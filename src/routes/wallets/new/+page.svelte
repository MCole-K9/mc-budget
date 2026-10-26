<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
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
	import { CURRENCIES } from '$lib/settings';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Icon from '$lib/components/Icon.svelte';

	const STEPS = [
		{ id: 'preset', label: 'Template' },
		{ id: 'customize', label: 'Categories' },
		{ id: 'details', label: 'Details' }
	] as const;

	const BUDGET_TYPES = [
		{
			value: 'percentage',
			symbol: '%',
			label: 'Percent of income',
			description: 'Split whatever comes in, e.g. 50% needs, 30% wants, 20% savings.'
		},
		{
			value: 'fixed',
			symbol: '$',
			label: 'Fixed amounts',
			description: 'Set a monthly spending limit for each category.'
		}
	] as const;

	let step = $state<'preset' | 'customize' | 'details'>('preset');
	const stepIndex = $derived(STEPS.findIndex((s) => s.id === step));
	let name = $state('');
	let balance = $state<number | ''>(0);
	let currency = $state('USD');
	let categories = $state<BudgetCategory[]>([]);
	let selectedPresetId = $state<string | undefined>(undefined);
	let budgetType = $state<'percentage' | 'fixed'>('percentage');
	let loading = $state(false);
	let error = $state('');

	// Load presets using experimental async
	const presets = await getPresets();

	const categoriesValid = $derived(validateCategories(categories, budgetType).valid);

	// Preselected from the Presets page ("Use preset")
	const requestedPreset = presets.find((p) => p.id === page.state.presetId);
	if (requestedPreset) handlePresetSelect(requestedPreset);

	function handlePresetSelect(preset: BudgetPreset) {
		selectedPresetId = preset.id;
		categories = JSON.parse(JSON.stringify(preset.categories));
		// Presets are percentage-based; apply fixedAmount reset if user switched mode
		if (budgetType === 'fixed') {
			categories = categories.map((c) => ({ ...c, percentage: 0, fixedAmount: 0 }));
		}
		step = 'customize';
	}

	function handleCustomBudget() {
		selectedPresetId = undefined;
		if (budgetType === 'fixed') {
			categories = [{ name: 'Category 1', percentage: 0, fixedAmount: 0, color: '#3B82F6' }];
		} else {
			categories = [{ name: 'Category 1', percentage: 100, color: '#3B82F6' }];
		}
		step = 'customize';
	}

	function switchToFixed() {
		budgetType = 'fixed';
		categories = categories.map((c) => ({ ...c, percentage: 0, fixedAmount: c.fixedAmount ?? 0 }));
	}

	function switchToPercentage() {
		budgetType = 'percentage';
		categories = categories.map((c) => ({ ...c, fixedAmount: undefined }));
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';

		if (!categoriesValid) {
			error = budgetType === 'fixed'
				? 'Each category must have a fixed amount greater than 0'
				: 'Categories must total exactly 100%';
			return;
		}

		loading = true;

		try {
			const wallet = await createWallet({
				name: name.trim(),
				balance: Number(balance) || 0,
				currency,
				budget_type: budgetType,
				categories
			});
			await goto(resolve('/wallets/[id]', { id: wallet.id }));
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create wallet';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>New Wallet - MC Budget</title>
</svelte:head>

<AuthGuard>
	<div class="mx-auto max-w-4xl">
		<PageHeader
			title="New wallet"
			subtitle="Pick a budget style, tune the categories, then name your wallet."
			backHref={resolve('/wallets')}
			backLabel="Wallets"
		/>

		{#if error}
			<Alert type="error" dismissible ondismiss={() => (error = '')} class="mb-6">
				{error}
			</Alert>
		{/if}

		<!-- Progress Steps -->
		<ol class="mb-8 grid grid-cols-3 gap-2">
			{#each STEPS as s, i (s.id)}
				{@const done = i < stepIndex}
				{@const current = i === stepIndex}
				<li class="min-w-0">
					<div
						class={[
							'h-1 rounded-full transition-colors',
							done || current ? 'bg-primary' : 'bg-base-300'
						]}
					></div>
					<p
						class={[
							'mt-2 flex items-center gap-1.5 truncate text-xs font-medium sm:text-sm',
							current ? 'text-base-content' : 'text-base-content/45'
						]}
					>
						{#if done}
							<Icon name="circle-check" class="size-4 text-primary" />
						{:else}
							<span class="text-base-content/40 tabular-nums">{i + 1}.</span>
						{/if}
						{s.label}
					</p>
				</li>
			{/each}
		</ol>

		{#if step === 'preset'}
			<div class="space-y-6">
				<!-- Budget type selection -->
				<div class="grid gap-3 sm:grid-cols-2">
					{#each BUDGET_TYPES as t (t.value)}
						<button
							type="button"
							class={[
								'surface flex items-start gap-3 p-4 text-left transition-all',
								budgetType === t.value
									? 'border-primary ring-2 ring-primary/20'
									: 'hover:border-base-content/20'
							]}
							onclick={() => (budgetType = t.value)}
							aria-pressed={budgetType === t.value}
						>
							<span
								class={[
									'grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold',
									budgetType === t.value
										? 'bg-primary text-primary-content'
										: 'bg-base-200 text-base-content/60'
								]}
							>
								{t.symbol}
							</span>
							<span>
								<span class="block font-semibold">{t.label}</span>
								<span class="mt-0.5 block text-sm text-base-content/55">{t.description}</span>
							</span>
						</button>
					{/each}
				</div>

				<div>
					<h2 class="mb-3 text-sm font-semibold">
						{budgetType === 'fixed' ? 'Start from a category template' : 'Choose a template'}
					</h2>
					<BudgetPresetSelector
						{presets}
						selected={selectedPresetId}
						{budgetType}
						onselect={handlePresetSelect}
					/>
				</div>

				<div class="divider text-xs text-base-content/45">OR</div>

				<button
					type="button"
					class="btn w-full border-dashed border-base-300 btn-ghost"
					onclick={handleCustomBudget}
				>
					<Icon name="plus" class="size-4" />
					Start from scratch
				</button>
			</div>
		{:else if step === 'customize'}
			<Card
				title="Customize your budget"
				subtitle={budgetType === 'fixed'
					? 'Set a fixed monthly spending limit for each category.'
					: 'Adjust categories and percentages. The total must equal 100%.'}
			>
				<BudgetCategoryList bind:categories editable {budgetType} />

				<div class="mt-6 flex gap-2">
					<Button variant="ghost" icon="arrow-left" onclick={() => (step = 'preset')}>Back</Button>
					<Button
						variant="primary"
						class="flex-1"
						disabled={!categoriesValid}
						onclick={() => (step = 'details')}
					>
						Continue
					</Button>
				</div>
			
			</Card>
		{:else if step === 'details'}
			<Card title="Wallet details" subtitle="You can't change the budget split after this step.">
				<form onsubmit={handleSubmit} class="space-y-4">
					<Input
						type="text"
						label="Wallet name"
						bind:value={name}
						placeholder="e.g. Main budget, Savings"
						required
					/>

					<div class="grid gap-4 sm:grid-cols-2">
						<Input
							type="number"
							label="Starting balance"
							bind:value={balance}
							placeholder="0.00"
							min="0"
							step="0.01"
							required
						/>

						<Select label="Currency" bind:value={currency} options={CURRENCIES} required />
					</div>

					<div class="rounded-box bg-base-200/60 p-4">
						<p class="eyebrow mb-3">Budget summary</p>
						{#if budgetType === 'percentage'}
							<div class="mb-3 flex h-2 gap-0.5 overflow-hidden rounded-full">
								{#each categories as category (category.name)}
									<div
										class="h-full"
										style:width="{category.percentage}%"
										style:background-color={category.color}
									></div>
								{/each}
							</div>
						{/if}
						<div class="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
							{#each categories as category (category.name)}
								<div class="flex items-center justify-between gap-2 text-sm">
									<span class="flex min-w-0 items-center gap-2">
										<span
											class="size-2.5 shrink-0 rounded-full"
											style:background-color={category.color}
										></span>
										<span class="truncate">{category.name}</span>
									</span>
									<span class="font-medium tabular-nums">
										{budgetType === 'fixed'
											? (category.fixedAmount ?? 0).toFixed(2)
											: category.percentage + '%'}
									</span>
								</div>
							{/each}
						</div>
					</div>

					<div class="flex gap-2 pt-2">
						<Button variant="ghost" icon="arrow-left" onclick={() => (step = 'customize')}>
							Back
						</Button>
						<Button type="submit" variant="primary" class="flex-1" {loading}>
							Create wallet
						</Button>
					</div>
				</form>
			
			</Card>
		{/if}
	</div>
</AuthGuard>
