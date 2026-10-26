<script lang="ts">
	import { untrack } from 'svelte';
	import { coverOverage, getCategoryBudgetsForDate } from '$lib/budgetCovers.remote';
	import type { Wallet } from '$lib/types/budget';
	import type { CategoryBudget } from '$lib/utils/budget';
	import { todayYmd } from '$lib/utils/dateRange';
	import Select from './Select.svelte';
	import Input from './Input.svelte';
	import Button from './Button.svelte';
	import Alert from './Alert.svelte';
	import { formatCurrency } from '$lib/utils/format';

	interface Props {
		wallet: Wallet;
		/** The over-budget category */
		category: string;
		overage: number;
		/** Date the cover is recorded on; it applies to any period containing this date */
		date: string;
		periodText: string;
		/** This wallet's category budgets for the same period */
		budgets: CategoryBudget[];
		wallets: Wallet[];
		onCovered?: () => void;
		onSkip?: () => void;
	}

	let { wallet, category, overage, date, periodText, budgets, wallets, onCovered, onSkip }: Props =
		$props();

	const today = todayYmd();
	const ownOptions = $derived(
		budgets.filter((b) => b.name !== category).sort((a, b) => b.remaining - a.remaining)
	);
	const otherWallets = $derived(wallets.filter((w) => w.id !== wallet.id && !w.archived));

	let sourceWalletId = $state(untrack(() => wallet.id));
	let sourceCategory = $state(untrack(() => ownOptions[0]?.name ?? ''));
	let amount = $state<number | ''>(untrack(() => Math.round(overage * 100) / 100));
	let submitting = $state(false);
	let error = $state('');

	const sourceWallet = $derived(
		sourceWalletId === wallet.id ? wallet : otherWallets.find((w) => w.id === sourceWalletId)
	);

	function optionLabel(b: CategoryBudget, currency: string): string {
		const left = b.remaining >= 0 ? `${formatCurrency(b.remaining, currency)} left` : `${formatCurrency(-b.remaining, currency)} over`;
		return `${b.name} · ${left}`;
	}

	function changeSourceWallet(id: string) {
		sourceWalletId = id;
		sourceCategory = id === wallet.id ? (ownOptions[0]?.name ?? '') : '';
	}

	function errorMessage(err: unknown): string {
		if (err instanceof Error) return err.message;
		return (err as { body?: { message?: string } })?.body?.message ?? 'Failed to cover overage';
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!sourceCategory) {
			error = 'Choose where the money comes from';
			return;
		}
		if (!amount || Number(amount) <= 0) {
			error = 'Amount must be greater than 0';
			return;
		}
		submitting = true;
		error = '';
		try {
			await coverOverage({
				walletId: wallet.id,
				category,
				amount: Number(amount),
				date,
				sourceWalletId,
				sourceCategory
			});
			onCovered?.();
		} catch (err) {
			error = errorMessage(err);
		} finally {
			submitting = false;
		}
	}
</script>

<form onsubmit={handleSubmit} class="space-y-4">
	<div class="rounded-box bg-error/8 p-4 text-sm">
		<p>
			<strong>{category}</strong> is
			<strong class="text-error">{formatCurrency(overage, wallet.currency)}</strong> over budget for
			{periodText}.
		</p>
		<p class="mt-1 text-base-content/60">Where should the extra money come from?</p>
	</div>

	{#if error}
		<Alert type="error">{error}</Alert>
	{/if}

	{#if otherWallets.length > 0}
		<Select
			label="From wallet"
			value={sourceWalletId}
			onchange={(e) => changeSourceWallet(e.currentTarget.value)}
		>
			<option value={wallet.id}>This wallet ({wallet.name})</option>
			{#each otherWallets as w (w.id)}
				<option value={w.id}>{w.name}{w.currency !== wallet.currency ? ` (${w.currency})` : ''}</option>
			{/each}
		</Select>
	{/if}

	{#if sourceWalletId === wallet.id}
		{#if ownOptions.length > 0}
			<Select label="Take it from category" bind:value={sourceCategory}>
				{#each ownOptions as b (b.name)}
					<option value={b.name}>{optionLabel(b, wallet.currency)}</option>
				{/each}
			</Select>
		{:else}
			<p class="text-sm text-base-content/50">This wallet has no other categories to take it from.</p>
		{/if}
	{:else if sourceWallet}
		<svelte:boundary>
			{@const other = await getCategoryBudgetsForDate({ walletId: sourceWallet.id, date, today })}
			<Select label="Take it from category in {sourceWallet.name}" bind:value={sourceCategory}>
				<option value="" disabled>Choose a category</option>
				{#each other.categories as b (b.name)}
					<option value={b.name}>{optionLabel(b, sourceWallet.currency)}</option>
				{/each}
			</Select>
			<p class="text-xs text-base-content/50">
				The money moves from {sourceWallet.name} into this wallet{sourceWallet.currency !== wallet.currency
					? `, converted from ${sourceWallet.currency} at today's rate`
					: ''}. It covers only {category} rather than counting as income.
			</p>

			{#snippet pending()}
				<span class="loading loading-spinner loading-sm"></span>
			{/snippet}
			{#snippet failed(err)}
				<Alert type="error">{errorMessage(err)}</Alert>
			{/snippet}
		</svelte:boundary>
	{/if}

	<Input
		type="number"
		label="Amount ({wallet.currency})"
		min="0.01"
		step="0.01"
		required
		bind:value={amount}
	/>

	<div class="flex gap-2 pt-2">
		<Button type="button" variant="ghost" class="flex-1" onclick={onSkip}>Leave over budget</Button>
		<Button type="submit" variant="primary" class="flex-1" loading={submitting}>Cover overage</Button>
	</div>
</form>
