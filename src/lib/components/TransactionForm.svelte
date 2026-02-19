<script lang="ts">
	import type { Wallet, CreateTransactionInput } from '$lib/types/budget';
	import Input from './Input.svelte';
	import Select from './Select.svelte';
	import Button from './Button.svelte';

	interface Props {
		wallet: Wallet;
		onsubmit: (input: CreateTransactionInput) => void;
		loading?: boolean;
	}

	let { wallet, onsubmit, loading = false }: Props = $props();

	let category = $state('');
	let amount = $state<number | ''>('');
	let description = $state('');
	let date = $state(new Date().toISOString().split('T')[0]);
	let isExpense = $state(true);

	const categoryOptions = $derived(
		wallet.categories.map((c) => ({ value: c.name, label: c.name }))
	);

	function handleSubmit(e: Event) {
		e.preventDefault();

		if (!category || !amount || !date) return;

		const finalAmount = isExpense ? -Math.abs(Number(amount)) : Math.abs(Number(amount));

		onsubmit({
			wallet: wallet.id,
			category,
			amount: finalAmount,
			description: description.trim() || undefined,
			date
		});

		// Reset form
		category = '';
		amount = '';
		description = '';
		date = new Date().toISOString().split('T')[0];
	}
</script>

<form onsubmit={handleSubmit} class="space-y-4">
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

	<Select label="Category" bind:value={category} options={categoryOptions} required />

	<Input
		type="number"
		label="Amount"
		bind:value={amount}
		placeholder="0.00"
		min="0.01"
		step="0.01"
		required
	/>

	<Input
		type="text"
		label="Description (optional)"
		bind:value={description}
		placeholder="What was this for?"
	/>

	<Input type="date" label="Date" bind:value={date} required />

	<Button type="submit" variant="primary" class="w-full" {loading}>
		Add Transaction
	</Button>
</form>
