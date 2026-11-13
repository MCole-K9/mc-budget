<script lang="ts">
	import { untrack } from 'svelte';
	import { confirmAlert, type AlertView } from '$lib/alerts.remote';
	import { getExchangeRates } from '$lib/settings.remote';
	import { formatCurrency } from '$lib/utils/format';
	import type { ParsedAlert } from '$lib/alerts/engine';
	import type { Wallet } from '$lib/types/budget';
	import { toYmd } from '$lib/utils/dateRange';
	import Select from '../Select.svelte';
	import Input from '../Input.svelte';
	import Button from '../Button.svelte';
	import Alert from '../Alert.svelte';
	import ExpenseIncomeToggle from '../ExpenseIncomeToggle.svelte';

	interface Props {
		alert: AlertView & { parsed: ParsedAlert };
		wallets: Wallet[];
		oncancel: () => void;
		ondone: () => void;
	}

	let { alert, wallets, oncancel, ondone }: Props = $props();

	// Prefill once from the alert; the user can change everything before confirming
	const parsed = untrack(() => alert.parsed);
	let walletId = $state(
		untrack(
			() =>
				(wallets.some((w) => w.id === alert.suggestedWallet) ? alert.suggestedWallet : '') ||
				(wallets.find((w) => w.currency === parsed.currency) ?? wallets[0])?.id ||
				''
		)
	);
	let isExpense = $state(parsed.direction === 'debit');
	/** What the user typed; null = use the suggested amount (converted when currencies differ) */
	let typedAmount = $state<number | '' | null>(null);
	let description = $state(parsed.merchant ?? '');
	let date = $state(toYmd(new Date(parsed.occurredAt)));
	let incomeSource = $state('');
	let rememberWallet = $state(untrack(() => !!parsed.accountHint && !alert.suggestedWallet));
	let saving = $state(false);
	let errorMessage = $state('');

	const wallet = $derived(wallets.find((w) => w.id === walletId));
	// Units of the wallet currency per 1 unit of the alert currency; null = no rate available
	const rate = $derived(
		!wallet || wallet.currency === parsed.currency
			? 1
			: ((await getExchangeRates(parsed.currency)).rates[wallet.currency] ?? null)
	);
	const amount = $derived(
		typedAmount ?? (rate ? Math.round(parsed.amount * rate * 100) / 100 : parsed.amount)
	);
	const walletOptions = $derived(
		wallets.map((w) => ({ value: w.id, label: `${w.name} (${w.currency})` }))
	);
	const categoryOptions = $derived(
		(wallet?.categories ?? []).map((c) => ({ value: c.name, label: c.name }))
	);
	let pickedCategory = $state('');
	// Keep the category valid when the wallet changes
	const category = $derived(
		wallet && !wallet.categories.some((c) => c.name === pickedCategory)
			? (wallet.categories[0]?.name ?? '')
			: pickedCategory
	);

	async function handleConfirm(e: SubmitEvent) {
		e.preventDefault();
		if (!walletId || amount === '' || amount <= 0) return;
		saving = true;
		errorMessage = '';
		try {
			await confirmAlert({
				id: alert.id,
				walletId,
				isExpense,
				category: isExpense ? category : incomeSource.trim(),
				amount,
				description: description.trim(),
				date,
				rememberWallet
			});
			ondone();
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Could not confirm this alert';
		} finally {
			saving = false;
		}
	}
</script>

<form class="space-y-4" onsubmit={handleConfirm}>
	{#if wallets.length === 0}
		<Alert type="warning">Create a wallet first, then confirm this alert.</Alert>
	{:else}
		<Select
			label="Wallet"
			options={walletOptions}
			bind:value={
				() => walletId,
				(v) => {
					walletId = v;
					typedAmount = null; // a typed amount was in the old wallet's currency
				}
			}
		/>
		{#if wallet && wallet.currency !== parsed.currency}
			{#if rate}
				<Alert type="info">
					Converted from {formatCurrency(parsed.amount, parsed.currency)} at 1 {parsed.currency} =
					{rate}
					{wallet.currency}. Change the amount if your bank used another rate.
				</Alert>
			{:else}
				<Alert type="warning">
					The alert is in {parsed.currency}, but {wallet.name} uses {wallet.currency}, and no
					exchange rate is available. Enter the amount in {wallet.currency}.
				</Alert>
			{/if}
		{/if}

		<ExpenseIncomeToggle bind:isExpense />

		{#if isExpense}
			<Select
				label="Category"
				options={categoryOptions}
				bind:value={() => category, (v) => (pickedCategory = v)}
			/>
		{:else}
			<Input label="Income source" placeholder="Income" bind:value={incomeSource} />
		{/if}

		<div class="grid grid-cols-2 gap-3">
			<Input
				label="Amount"
				type="number"
				min="0.01"
				step="0.01"
				required
				bind:value={() => amount, (v) => (typedAmount = v ?? '')}
			/>
			<Input label="Date" type="date" required bind:value={date} />
		</div>
		<Input label="Description" maxlength={500} bind:value={description} />

		{#if parsed.accountHint}
			<label class="flex cursor-pointer items-center gap-2 text-sm">
				<input type="checkbox" class="checkbox checkbox-sm" bind:checked={rememberWallet} />
				Always suggest this wallet for card ****{parsed.accountHint}
			</label>
		{/if}
	{/if}

	{#if errorMessage}
		<Alert type="error">{errorMessage}</Alert>
	{/if}

	<div class="flex justify-end gap-2">
		<Button type="button" variant="ghost" onclick={oncancel}>Cancel</Button>
		<Button
			type="submit"
			icon="check"
			loading={saving}
			disabled={!walletId || wallets.length === 0}
		>
			Add transaction
		</Button>
	</div>
</form>
