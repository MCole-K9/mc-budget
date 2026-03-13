<script lang="ts">
	import { createTransaction } from '$lib/transactions.remote';
	import type { Wallet } from '$lib/types/budget';
	import Select from './Select.svelte';
	import Input from './Input.svelte';
	import Button from './Button.svelte';

	interface Props {
		wallet: Wallet;
		onSuccess?: () => void;
	}

	let { wallet, onSuccess }: Props = $props();

	let isExpense = $state(true);
	let lastResultId = $state('');

	const categoryOptions = $derived(
		wallet.categories.map((c) => ({ value: c.name, label: c.name }))
	);

	$effect(() => {
		const result = createTransaction.result;
		if (result?.id && result.id !== lastResultId) {
			lastResultId = result.id;
			onSuccess?.();
		}
	});
</script>

<form {...createTransaction} enctype="multipart/form-data" class="space-y-4">
	<input type="hidden" name="walletId" value={wallet.id} />
	<input type="hidden" name="isExpense" value={String(isExpense)} />

	{#each createTransaction.fields.allIssues() as issue (issue.message)}
		<div class="alert alert-error py-2 text-sm">{issue.message}</div>
	{/each}

	<div class="flex gap-2">
		<button
			type="button"
			class="btn flex-1 {isExpense ? 'btn-error' : 'btn-ghost'}"
			onclick={() => (isExpense = true)}
		>
			Expense
		</button>
		<button
			type="button"
			class="btn flex-1 {!isExpense ? 'btn-success' : 'btn-ghost'}"
			onclick={() => (isExpense = false)}
		>
			Income
		</button>
	</div>

	{#if isExpense}
		<Select label="Category" name="category" options={categoryOptions} required />
	{:else}
		<Input
			type="text"
			name="incomeSource"
			label="Income Source (optional)"
			placeholder="e.g. Salary, Freelance"
		/>
	{/if}

	<Input
		{...createTransaction.fields.amount.as('number')}
		label="Amount"
		placeholder="0.00"
		min="0.01"
		step="0.01"
		required
	/>

	<Input
		{...createTransaction.fields.description.as('text')}
		label="Description (optional)"
		placeholder="What was this for?"
	/>

	<Input
		{...createTransaction.fields.date.as('date')}
		label="Date"
		value={new Date().toISOString().split('T')[0]}
		required
	/>

	<div class="form-control">
		<div class="label">
			<span class="label-text">Receipt (optional)</span>
		</div>
		<input
			{...createTransaction.fields.receipt.as('file')}
			accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
			class="file-input file-input-bordered w-full"
		/>
	</div>

	<Button type="submit" variant="primary" class="w-full" loading={!!createTransaction.pending}>
		Add Transaction
	</Button>
</form>
