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
	let isRecurring = $state(false);
	let recurDay = $state(1);
	let lastResultId = $state(createTransaction.result?.id ?? '');

	const categoryOptions = $derived(
		wallet.categories.map((c) => ({ value: c.name, label: c.name }))
	);

	const dayOptions = Array.from({ length: 28 }, (_, i) => ({
		value: String(i + 1),
		label: String(i + 1)
	}));

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
	<input type="hidden" name="recurring" value={String(isRecurring)} />

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

	<!-- Recurring -->
	<div class="space-y-2">
		<label class="flex items-center gap-3 cursor-pointer">
			<input
				type="checkbox"
				class="checkbox checkbox-sm"
				bind:checked={isRecurring}
			/>
			<span class="label-text">Repeat monthly</span>
		</label>

		{#if isRecurring}
			<div class="flex items-center gap-2 pl-7">
				<span class="text-sm text-base-content/70">on day</span>
				<select
					name="n:recur_day"
					class="select select-bordered select-sm w-20"
					value={String(recurDay)}
					onchange={(e) => (recurDay = Number(e.currentTarget.value))}
				>
					{#each dayOptions as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
				<span class="text-sm text-base-content/70">of each month</span>
			</div>
		{/if}
	</div>

	<Button type="submit" variant="primary" class="w-full" loading={!!createTransaction.pending}>
		Add Transaction
	</Button>
</form>
