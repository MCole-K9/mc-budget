<script lang="ts">
	import { untrack } from 'svelte';
	import { transferBetweenWallets } from '$lib/transfers.remote';
	import type { Wallet } from '$lib/types/budget';
	import Select from './Select.svelte';
	import Input from './Input.svelte';
	import Button from './Button.svelte';

	interface Props {
		sourceWallet: Wallet;
		wallets: Wallet[];
		onSuccess?: () => void;
		onCancel?: () => void;
	}

	let { sourceWallet, wallets, onSuccess, onCancel }: Props = $props();

	const destWallets = $derived(wallets.filter((w) => w.id !== sourceWallet.id));
	const destOptions = $derived(destWallets.map((w) => ({ value: w.id, label: w.name })));
	const notifySuccess = () => onSuccess?.();

	let lastResultId = untrack(() => transferBetweenWallets.result?.debit?.id ?? '');

	$effect(() => {
		const result = transferBetweenWallets.result;
		if (result?.debit?.id && result.debit.id !== lastResultId) {
			lastResultId = result.debit.id;
			notifySuccess();
		}
	});
</script>

<form {...transferBetweenWallets} class="space-y-4">
	<input type="hidden" name="sourceWalletId" value={sourceWallet.id} />

	{#each transferBetweenWallets.fields.allIssues() as issue (issue.message)}
		<div class="alert alert-error py-2 text-sm">{issue.message}</div>
	{/each}

	{#if destWallets.length === 0}
		<p class="text-sm text-base-content/50 py-4 text-center">No other wallets to transfer to.</p>
	{:else}
		<div class="flex items-center gap-3 text-sm">
			<span class="font-medium shrink-0">{sourceWallet.name}</span>
			<span class="text-base-content/40 shrink-0">→</span>
			<div class="flex-1">
				<Select name="destWalletId" options={destOptions} required />
			</div>
		</div>

		<Input
			{...transferBetweenWallets.fields.amount.as('number')}
			label="Amount ({sourceWallet.currency})"
			placeholder="0.00"
			min="0.01"
			step="0.01"
			required
		/>

		<Input
			{...transferBetweenWallets.fields.description.as('text')}
			label="Description (optional)"
			placeholder="e.g. Moving savings"
		/>

		<Input
			{...transferBetweenWallets.fields.date.as('date')}
			label="Date"
			required
			value={new Date().toISOString().split('T')[0]}
		/>

		<div class="flex gap-2">
			{#if onCancel}
				<Button type="button" variant="ghost" class="flex-1" onclick={onCancel}>Cancel</Button>
			{/if}
			<Button type="submit" variant="primary" class="flex-1" loading={!!transferBetweenWallets.pending}>
				Transfer
			</Button>
		</div>
	{/if}
</form>
