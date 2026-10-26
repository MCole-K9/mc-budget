<script lang="ts">
	import { untrack } from 'svelte';
	import { createTransaction } from '$lib/transactions.remote';
	import { scanReceipt } from '$lib/receipt.remote';
	import type { Transaction, Wallet } from '$lib/types/budget';
	import { todayYmd } from '$lib/utils/dateRange';
	import Select from './Select.svelte';
	import Input from './Input.svelte';
	import Button from './Button.svelte';
	import Alert from './Alert.svelte';
	import Icon from './Icon.svelte';
	import ExpenseIncomeToggle from './ExpenseIncomeToggle.svelte';

	interface Props {
		wallet: Wallet;
		onSuccess?: (transaction: Transaction) => void;
	}

	let { wallet, onSuccess }: Props = $props();

	let isExpense = $state(true);
	let isRecurring = $state(false);
	let recurDay = $state(1);
	let lastResultId = $state(createTransaction.result?.id ?? '');
	const todayLocal = todayYmd();

	// Pre-fillable form state
	let amount = $state<number | ''>('');
	let description = $state('');
	let date = $state(todayLocal);
	let selectedCategory = $state(untrack(() => wallet.categories[0]?.name ?? ''));

	// Receipt scan state
	let selectedFile = $state<File | null>(null);
	let scanLoading = $state(false);
	let scanError = $state('');
	let scanned = $state(false);

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
			onSuccess?.(result);
		}
	});

	function readAsBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve((reader.result as string).split(',')[1]);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	const MAX_RECEIPT_SIZE = 2 * 1024 * 1024; // 2MB

	function handleReceiptFile(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		scanned = false;
		scanError = '';
		if (file && file.size > MAX_RECEIPT_SIZE) {
			selectedFile = null;
			scanError = `Receipt is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is 2 MB.`;
			(e.currentTarget as HTMLInputElement).value = '';
			return;
		}
		selectedFile = file?.type.startsWith('image/') ? file : null;
	}

	async function handleScan() {
		if (!selectedFile) return;
		scanLoading = true;
		scanError = '';
		try {
			const base64 = await readAsBase64(selectedFile);
			const result = await scanReceipt({
				imageBase64: base64,
				mimeType: selectedFile.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
				categories: wallet.categories.map((c) => c.name)
			});
			amount = result.amount;
			description = result.description;
			date = result.date;
			if (result.suggestedCategory) selectedCategory = result.suggestedCategory;
			scanned = true;
		} catch (err) {
			scanError = err instanceof Error ? err.message : 'Failed to scan receipt';
		} finally {
			scanLoading = false;
		}
	}
</script>

<form {...createTransaction} enctype="multipart/form-data" class="space-y-4">
	<input type="hidden" name="walletId" value={wallet.id} />
	<input type="hidden" name="isExpense" value={String(isExpense)} />
	<input type="hidden" name="recurring" value={String(isRecurring)} />

	{#each createTransaction.fields.allIssues() as issue (issue.message)}
		<Alert type="error">{issue.message}</Alert>
	{/each}

	<ExpenseIncomeToggle bind:isExpense />

	<label class="flex flex-col gap-1.5">
		<span class="text-sm font-medium text-base-content/80">Amount</span>
		<span class="input input-lg w-full">
			<span class="text-base-content/40">{wallet.currency}</span>
			<input
				{...createTransaction.fields.amount.as('number')}
				placeholder="0.00"
				min="0.01"
				step="0.01"
				required
				class="text-xl font-semibold tabular-nums"
				bind:value={amount}
			/>
		</span>
	</label>

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
			label="Income source (optional)"
			placeholder="e.g. Salary, Freelance"
		/>
	{/if}

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
		<Input
			{...createTransaction.fields.description.as('text')}
			label="Description (optional)"
			placeholder="What was this for?"
			bind:value={description}
		/>

		<Input
			{...createTransaction.fields.date.as('date')}
			label="Date"
			required
			bind:value={date}
		/>
	</div>

	<!-- Receipt upload + scan -->
	<div class="rounded-box border border-dashed border-base-300 p-3">
		<div class="flex items-center justify-between gap-2">
			<span class="flex items-center gap-2 text-sm font-medium text-base-content/80">
				<Icon name="receipt" class="size-4 text-base-content/50" />
				Receipt <span class="font-normal text-base-content/45">(optional)</span>
			</span>
			{#if selectedFile}
				{#if scanLoading}
					<span class="flex items-center gap-1.5 text-xs text-base-content/55">
						<span class="loading loading-xs loading-spinner"></span> Scanning…
					</span>
				{:else if scanned}
					<span class="flex items-center gap-1 text-xs font-medium text-success">
						<Icon name="check" class="size-3.5" /> Details filled in
					</span>
				{:else}
					<button type="button" class="btn btn-soft btn-xs btn-primary" onclick={handleScan}>
						<Icon name="sparkles" class="size-3.5" />
						Scan with AI
					</button>
				{/if}
			{/if}
		</div>
		<input
			{...createTransaction.fields.receipt.as('file')}
			accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
			class="file-input mt-2 w-full file-input-sm"
			aria-label="Receipt file"
			oninput={handleReceiptFile}
		/>
		{#if scanError}
			<p class="mt-2 text-xs text-error">{scanError}</p>
		{:else if !selectedFile}
			<p class="mt-2 text-xs text-base-content/45">
				Attach a photo and AI can fill in the amount, date and category.
			</p>
		{/if}
	</div>

	<!-- Recurring -->
	<div class="rounded-box bg-base-200/60 p-3">
		<label class="flex cursor-pointer items-center justify-between gap-3">
			<span class="flex items-center gap-2 text-sm font-medium">
				<Icon name="repeat" class="size-4 text-base-content/50" />
				Repeat monthly
			</span>
			<input type="checkbox" class="toggle toggle-sm toggle-primary" bind:checked={isRecurring} />
		</label>

		{#if isRecurring}
			<div class="mt-3 flex items-center gap-2 text-sm text-base-content/70">
				<span>On day</span>
				<select
					name="n:recur_day"
					class="select w-20 select-sm"
					aria-label="Day of month"
					value={String(recurDay)}
					onchange={(e) => (recurDay = Number(e.currentTarget.value))}
				>
					{#each dayOptions as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
				<span>of each month</span>
			</div>
		{/if}
	</div>

	<Button type="submit" variant="primary" class="w-full" loading={!!createTransaction.pending}>
		Add transaction
	</Button>
</form>
