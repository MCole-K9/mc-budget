<script lang="ts">
	import { getRecurringTransactions, updateRecurringSettings } from '$lib/transactions.remote';
	import AuthGuard from '$lib/components/AuthGuard.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Button from '$lib/components/Button.svelte';
	import { resolve } from '$app/paths';

	const recurringList = $derived(await getRecurringTransactions());

	type RecurringTx = Awaited<ReturnType<typeof getRecurringTransactions>>[number];

	const grouped = $derived(
		recurringList.reduce<{ walletId: string; walletName: string; currency: string; items: RecurringTx[] }[]>(
			(acc, tx) => {
				const last = acc[acc.length - 1];
				if (last?.walletId === tx.wallet) last.items.push(tx);
				else acc.push({ walletId: tx.wallet, walletName: tx.walletName, currency: tx.currency, items: [tx] });
				return acc;
			},
			[]
		)
	);

	const dayOptions = Array.from({ length: 28 }, (_, i) => ({
		value: String(i + 1),
		label: String(i + 1)
	}));

	function formatCurrency(amount: number, currency: string): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
	}

	let savingId = $state('');
	let error = $state('');
	let txToConfirmRemove = $state<RecurringTx | null>(null);
	let editingAmountId = $state('');
	let editingAmountValue = $state('');

	function focusOnMount(node: HTMLElement) {
		node.focus();
	}

	async function changeDay(tx: RecurringTx, day: number) {
		savingId = tx.id;
		error = '';
		try {
			await updateRecurringSettings({ id: tx.id, walletId: tx.wallet, recurring: true, recur_day: day });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update';
		} finally {
			savingId = '';
		}
	}

	async function saveAmount(tx: RecurringTx, raw: string) {
		editingAmountId = '';
		const value = parseFloat(raw);
		if (!value || value <= 0 || value === Math.abs(tx.amount)) return;
		savingId = tx.id;
		error = '';
		try {
			await updateRecurringSettings({
				id: tx.id,
				walletId: tx.wallet,
				recurring: true,
				recur_day: tx.recur_day || 1,
				amount: value
			});
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update';
		} finally {
			savingId = '';
		}
	}

	async function confirmRemoveRecurrence() {
		if (!txToConfirmRemove) return;
		const tx = txToConfirmRemove;
		txToConfirmRemove = null;
		savingId = tx.id;
		error = '';
		try {
			await updateRecurringSettings({ id: tx.id, walletId: tx.wallet, recurring: false });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update';
		} finally {
			savingId = '';
		}
	}
</script>

<svelte:head>
	<title>Recurring - MC Budget</title>
</svelte:head>

<AuthGuard>
	<div class="max-w-2xl mx-auto space-y-6">
		<div>
			<h1 class="text-2xl font-bold">Recurring Transactions</h1>
			<p class="text-sm text-base-content/50 mt-1">Transactions that repeat monthly. Click an amount to edit it.</p>
		</div>

		{#if error}
			<div class="alert alert-error py-2 text-sm">{error}</div>
		{/if}

		{#if grouped.length === 0}
			<div class="bg-base-100 rounded-2xl shadow-sm p-12 text-center">
				<p class="text-base-content/40 text-sm">No recurring transactions yet.</p>
				<p class="text-base-content/30 text-xs mt-1">Mark a transaction as "Repeat monthly" when creating or editing it.</p>
			</div>
		{:else}
			{#each grouped as group (group.walletId)}
				<div class="space-y-2">
					<div class="flex items-center gap-3 px-1">
						<a
							href={resolve('/wallets/[id]', { id: group.walletId })}
							class="text-xs font-semibold text-base-content/40 uppercase tracking-widest hover:text-base-content/70 transition-colors"
						>
							{group.walletName}
						</a>
						<div class="flex-1 h-px bg-base-200"></div>
					</div>

					<div class="bg-base-100 rounded-2xl shadow-sm overflow-hidden">
						<div class="divide-y divide-base-200">
							{#each group.items as tx (tx.id)}
								{@const saving = savingId === tx.id}
								{@const editingAmount = editingAmountId === tx.id}
								<div class="flex items-center gap-3 px-4 py-3">
									<span
										class="w-2.5 h-2.5 rounded-full shrink-0"
										style="background-color: {tx.categoryColor ?? (tx.amount > 0 ? '#22c55e' : '#9ca3af')};"
									></span>

									<div class="flex-1 min-w-0">
										<p class="font-medium text-sm leading-snug truncate">
											{tx.description || tx.category}
										</p>
										<p class="text-xs text-base-content/40 truncate">{tx.category}</p>
									</div>

									<!-- Editable amount -->
									{#if editingAmount}
										<input
											type="number"
											class="input input-bordered input-xs w-24 text-right tabular-nums"
											value={editingAmountValue}
											min="0.01"
											step="0.01"
											use:focusOnMount
											oninput={(e) => (editingAmountValue = e.currentTarget.value)}
											onblur={() => saveAmount(tx, editingAmountValue)}
											onkeydown={(e) => {
												if (e.key === 'Enter') e.currentTarget.blur();
												if (e.key === 'Escape') editingAmountId = '';
											}}
										/>
									{:else}
										<button
											class="font-semibold text-sm shrink-0 tabular-nums {tx.amount < 0 ? 'text-error' : 'text-success'} hover:opacity-60 transition-opacity"
											title="Click to edit amount"
											disabled={saving}
											onclick={() => {
												editingAmountId = tx.id;
												editingAmountValue = String(Math.abs(tx.amount));
											}}
										>
											{tx.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(tx.amount), group.currency)}
										</button>
									{/if}

									<!-- Day picker -->
									<div class="flex items-center gap-1 shrink-0">
										<span class="text-xs text-base-content/40">day</span>
										<select
											class="select select-bordered select-xs w-16"
											value={String(tx.recur_day || 1)}
											disabled={saving}
											onchange={(e) => changeDay(tx, Number(e.currentTarget.value))}
										>
											{#each dayOptions as opt (opt.value)}
												<option value={opt.value}>{opt.label}</option>
											{/each}
										</select>
									</div>

									<!-- Remove recurring button -->
									<button
										class="btn btn-ghost btn-xs text-base-content/30 hover:text-error"
										title="Remove recurrence"
										disabled={saving}
										onclick={() => (txToConfirmRemove = tx)}
									>
										{#if saving}
											<span class="loading loading-spinner loading-xs"></span>
										{:else}
											<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
												<path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
											</svg>
										{/if}
									</button>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<Modal
		open={!!txToConfirmRemove}
		title="Remove Recurrence?"
		onclose={() => (txToConfirmRemove = null)}
	>
		<p class="text-base-content/70">
			<strong>{txToConfirmRemove?.description || txToConfirmRemove?.category}</strong> will no longer
			repeat monthly. The transaction itself will not be deleted.
		</p>
		{#snippet actions()}
			<Button variant="ghost" onclick={() => (txToConfirmRemove = null)}>Cancel</Button>
			<Button variant="error" onclick={confirmRemoveRecurrence}>Remove Recurrence</Button>
		{/snippet}
	</Modal>
</AuthGuard>
