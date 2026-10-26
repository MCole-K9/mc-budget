<script lang="ts">
	import { untrack } from 'svelte';
	import { transferBetweenWallets } from '$lib/transfers.remote';
	import type { Wallet } from '$lib/types/budget';
	import Select from './Select.svelte';
	import { todayYmd } from '$lib/utils/dateRange';
	import Input from './Input.svelte';
	import Button from './Button.svelte';
	import Alert from './Alert.svelte';
	import EmptyState from './EmptyState.svelte';
	import Icon from './Icon.svelte';

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
	const todayLocal = todayYmd();

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
		<Alert type="error">{issue.message}</Alert>
	{/each}

	{#if destWallets.length === 0}
		<EmptyState
			plain
			icon="wallet"
			title="No other wallets"
			description="Create another wallet to move money between them."
		/>
	{:else}
		<div class="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
			<div class="flex min-w-0 flex-col gap-1.5">
				<span class="text-sm font-medium text-base-content/80">From</span>
				<div class="input w-full bg-base-200/60">
					<span class="truncate font-medium">{sourceWallet.name}</span>
				</div>
			</div>
			<span class="grid size-10 place-items-center text-base-content/40">
				<Icon name="arrow-right" class="size-4" />
			</span>
			<Select label="To" name="destWalletId" options={destOptions} required />
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
			value={todayLocal}
		/>

		<div class="flex gap-2 pt-2">
			{#if onCancel}
				<Button type="button" variant="ghost" class="flex-1" onclick={onCancel}>Cancel</Button>
			{/if}
			<Button type="submit" variant="primary" class="flex-1" loading={!!transferBetweenWallets.pending}>
				Transfer
			</Button>
		</div>
	{/if}
</form>
