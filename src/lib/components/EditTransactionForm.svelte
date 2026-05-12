<script lang="ts">
	import { untrack } from 'svelte';
	import { updateTransaction } from '$lib/transactions.remote';
	import type { Transaction, Wallet } from '$lib/types/budget';
	import Select from './Select.svelte';
	import Input from './Input.svelte';
	import Button from './Button.svelte';

	interface Props {
		transaction: Transaction;
		wallet: Wallet;
		onSuccess?: () => void;
		onCancel?: () => void;
	}

	let { transaction, wallet, onSuccess, onCancel }: Props = $props();

	const isInitiallyExpense = untrack(() => transaction.amount < 0);
	let isExpense = $state(isInitiallyExpense);
	let amount = $state<number | ''>(untrack(() => Math.abs(transaction.amount)));
	let description = $state(untrack(() => transaction.description || ''));
	let date = $state(untrack(() => transaction.date.split('T')[0].split(' ')[0]));
	let selectedCategory = $state(untrack(() => isInitiallyExpense ? transaction.category : ''));
	let incomeSource = $state(untrack(() => !isInitiallyExpense ? transaction.category : ''));
	let submitting = $state(false);
	let error = $state('');

	const categoryOptions = $derived(
		wallet.categories.map((c) => ({ value: c.name, label: c.name }))
	);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!amount || Number(amount) <= 0) {
			error = 'Amount must be greater than 0';
			return;
		}
		submitting = true;
		error = '';
		try {
			await updateTransaction({
				id: transaction.id,
				walletId: transaction.wallet,
				isExpense,
				category: isExpense ? selectedCategory : '',
				incomeSource: !isExpense ? incomeSource : undefined,
				amount: Number(amount),
				description: description || undefined,
				date
			});
			onSuccess?.();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update transaction';
		} finally {
			submitting = false;
		}
	}
</script>

<form onsubmit={handleSubmit} class="space-y-4">
	{#if error}
		<div class="alert alert-error py-2 text-sm">{error}</div>
	{/if}

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
		<Select
			label="Category"
			name="category"
			options={categoryOptions}
			required
			bind:value={selectedCategory}
		/>
	{:else}
		<Input
			type="text"
			name="incomeSource"
			label="Income Source (optional)"
			placeholder="e.g. Salary, Freelance"
			bind:value={incomeSource}
		/>
	{/if}

	<Input
		type="number"
		name="amount"
		label="Amount"
		placeholder="0.00"
		min="0.01"
		step="0.01"
		required
		bind:value={amount}
	/>

	<Input
		type="text"
		name="description"
		label="Description (optional)"
		placeholder="What was this for?"
		bind:value={description}
	/>

	<Input
		type="date"
		name="date"
		label="Date"
		required
		bind:value={date}
	/>

	<div class="flex gap-2">
		{#if onCancel}
			<Button type="button" variant="ghost" class="flex-1" onclick={onCancel}>Cancel</Button>
		{/if}
		<Button type="submit" variant="primary" class="flex-1" loading={submitting}>
			Save Changes
		</Button>
	</div>
</form>
