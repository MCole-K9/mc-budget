<script lang="ts">
	import { getRecurringSchedules, updateRecurringSchedule, removeRecurringSchedule } from '$lib/recurring.remote';
	import AuthGuard from '$lib/components/AuthGuard.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Button from '$lib/components/Button.svelte';
	import { resolve } from '$app/paths';

	const scheduleList = $derived(await getRecurringSchedules());

	type Schedule = Awaited<ReturnType<typeof getRecurringSchedules>>[number];

	const grouped = $derived(
		scheduleList.reduce<{ walletId: string; walletName: string; currency: string; items: Schedule[] }[]>(
			(acc, s) => {
				const last = acc[acc.length - 1];
				if (last?.walletId === s.wallet) last.items.push(s);
				else acc.push({ walletId: s.wallet, walletName: s.walletName, currency: s.currency, items: [s] });
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
	let scheduleToRemove = $state<Schedule | null>(null);
	let editingAmountId = $state('');
	let editingAmountValue = $state('');

	function focusOnMount(node: HTMLElement) {
		node.focus();
	}

	async function toggleActive(schedule: Schedule) {
		savingId = schedule.id;
		error = '';
		try {
			await updateRecurringSchedule({ id: schedule.id, active: !schedule.active });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update';
		} finally {
			savingId = '';
		}
	}

	async function changeDay(schedule: Schedule, day: number) {
		savingId = schedule.id;
		error = '';
		try {
			await updateRecurringSchedule({ id: schedule.id, recur_day: day });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update';
		} finally {
			savingId = '';
		}
	}

	async function saveAmount(schedule: Schedule, raw: string) {
		editingAmountId = '';
		const value = parseFloat(raw);
		if (!value || value <= 0 || value === Math.abs(schedule.amount)) return;
		savingId = schedule.id;
		error = '';
		try {
			await updateRecurringSchedule({ id: schedule.id, amount: value });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update';
		} finally {
			savingId = '';
		}
	}

	async function confirmRemove() {
		if (!scheduleToRemove) return;
		const s = scheduleToRemove;
		scheduleToRemove = null;
		savingId = s.id;
		error = '';
		try {
			await removeRecurringSchedule({ id: s.id });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to remove';
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
			<p class="text-sm text-base-content/50 mt-1">Monthly schedules. Click an amount to change what future recurrences will use.</p>
		</div>

		{#if error}
			<div class="alert alert-error py-2 text-sm">{error}</div>
		{/if}

		{#if grouped.length === 0}
			<div class="bg-base-100 rounded-2xl shadow-sm p-12 text-center">
				<p class="text-base-content/40 text-sm">No recurring transactions yet.</p>
				<p class="text-base-content/30 text-xs mt-1">Mark a transaction as "Repeat monthly" when creating it.</p>
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
							{#each group.items as schedule (schedule.id)}
								{@const saving = savingId === schedule.id}
								{@const editingAmount = editingAmountId === schedule.id}
								<div class="flex items-center gap-3 px-4 py-3 {!schedule.active ? 'opacity-40' : ''}">
									<span
										class="w-2.5 h-2.5 rounded-full shrink-0"
										style="background-color: {schedule.categoryColor ?? (schedule.amount > 0 ? '#22c55e' : '#9ca3af')};"
									></span>

									<div class="flex-1 min-w-0">
										<p class="font-medium text-sm leading-snug truncate">
											{schedule.description || schedule.category}
										</p>
										<p class="text-xs text-base-content/40 truncate">{schedule.category}</p>
									</div>

									<!-- Editable amount (changes schedule only, not past transactions) -->
									{#if editingAmount}
										<input
											use:focusOnMount
											type="number"
											class="input input-bordered input-xs w-24 text-right tabular-nums"
											value={editingAmountValue}
											min="0.01"
											step="0.01"
											oninput={(e) => (editingAmountValue = e.currentTarget.value)}
											onblur={() => saveAmount(schedule, editingAmountValue)}
											onkeydown={(e) => {
												if (e.key === 'Enter') e.currentTarget.blur();
												if (e.key === 'Escape') editingAmountId = '';
											}}
										/>
									{:else}
										<button
											class="font-semibold text-sm shrink-0 tabular-nums {schedule.amount < 0 ? 'text-error' : 'text-success'} hover:opacity-60 transition-opacity"
											title="Click to change future amount"
											disabled={saving}
											onclick={() => {
												editingAmountId = schedule.id;
												editingAmountValue = String(Math.abs(schedule.amount));
											}}
										>
											{schedule.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(schedule.amount), group.currency)}
										</button>
									{/if}

									<!-- Day picker -->
									<div class="flex items-center gap-1 shrink-0">
										<span class="text-xs text-base-content/40">day</span>
										<select
											class="select select-bordered select-xs w-16"
											value={String(schedule.recur_day || 1)}
											disabled={saving}
											onchange={(e) => changeDay(schedule, Number(e.currentTarget.value))}
										>
											{#each dayOptions as opt (opt.value)}
												<option value={opt.value}>{opt.label}</option>
											{/each}
										</select>
									</div>

									<!-- Active toggle -->
									<input
										type="checkbox"
										class="toggle toggle-xs toggle-success"
										checked={schedule.active}
										disabled={saving}
										title={schedule.active ? 'Pause schedule' : 'Resume schedule'}
										onchange={() => toggleActive(schedule)}
									/>

									<!-- Remove schedule button -->
									<button
										class="btn btn-ghost btn-xs text-base-content/30 hover:text-error"
										title="Remove recurring schedule"
										disabled={saving}
										onclick={() => (scheduleToRemove = schedule)}
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
		open={!!scheduleToRemove}
		title="Remove Recurring Schedule?"
		onclose={() => (scheduleToRemove = null)}
	>
		<p class="text-base-content/70">
			<strong>{scheduleToRemove?.description || scheduleToRemove?.category}</strong> will no longer
			repeat monthly. Past transactions are not affected.
		</p>
		{#snippet actions()}
			<Button variant="ghost" onclick={() => (scheduleToRemove = null)}>Cancel</Button>
			<Button variant="error" onclick={confirmRemove}>Remove Schedule</Button>
		{/snippet}
	</Modal>
</AuthGuard>
