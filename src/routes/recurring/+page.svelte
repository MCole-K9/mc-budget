<script lang="ts">
	import { getRecurringSchedules, updateRecurringSchedule, removeRecurringSchedule } from '$lib/recurring.remote';
	import AuthGuard from '$lib/components/AuthGuard.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Button from '$lib/components/Button.svelte';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { formatSignedCurrency } from '$lib/utils/format';

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
	<PageHeader
		title="Recurring"
		subtitle="Monthly schedules. Changing an amount only affects future recurrences."
	/>

	<div class="space-y-6">
		{#if error}
			<Alert type="error" dismissible ondismiss={() => (error = '')}>{error}</Alert>
		{/if}

		{#if grouped.length === 0}
			<EmptyState
				icon="repeat"
				title="No recurring transactions yet"
				description="Turn on “Repeat monthly” when adding a transaction to schedule it here."
			/>
		{:else}
			{#each grouped as group (group.walletId)}
				<section>
					<div class="mb-2 flex items-center justify-between px-1">
						<a
							href={resolve('/wallets/[id]', { id: group.walletId })}
							class="flex items-center gap-1.5 text-sm font-semibold transition-colors hover:text-primary"
						>
							<Icon name="wallet" class="size-4 text-base-content/45" />
							{group.walletName}
						</a>
						<span class="text-xs text-base-content/50">
							{group.items.length} schedule{group.items.length !== 1 ? 's' : ''}
						</span>
					</div>

					<div class="surface divide-y divide-base-300/60 overflow-hidden">
						{#each group.items as schedule (schedule.id)}
							{@const saving = savingId === schedule.id}
							{@const editingAmount = editingAmountId === schedule.id}
							{@const color =
								schedule.categoryColor ?? (schedule.amount > 0 ? 'var(--color-success)' : '#9ca3af')}
							<div
								class={[
									'flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition-opacity sm:flex-nowrap',
									!schedule.active && 'opacity-50'
								]}
							>
								<span
									class="grid size-9 shrink-0 place-items-center rounded-xl"
									style:background-color="color-mix(in oklab, {color} 16%, transparent)"
									style:color
								>
									<Icon name={schedule.active ? 'repeat' : 'pause'} class="size-4" />
								</span>

								<div class="min-w-0 flex-1">
									<p class="truncate text-sm leading-snug font-medium">
										{schedule.description || schedule.category}
									</p>
									<p class="truncate text-xs text-base-content/50">
										{schedule.category} · day {schedule.recur_day || 1} of each month{schedule.active
											? ''
											: ' · paused'}
									</p>
								</div>

								<!-- Editable amount (changes schedule only, not past transactions) -->
								{#if editingAmount}
									<input
										use:focusOnMount
										type="number"
										class="input w-28 text-right tabular-nums input-sm"
										aria-label="Future amount"
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
										class={[
											'group flex shrink-0 items-center gap-1 rounded-field px-2 py-1 text-sm font-semibold tabular-nums transition-colors hover:bg-base-200',
											schedule.amount > 0 ? 'text-success' : 'text-error'
										]}
										title="Change future amount"
										disabled={saving}
										onclick={() => {
											editingAmountId = schedule.id;
											editingAmountValue = String(Math.abs(schedule.amount));
										}}
									>
										{formatSignedCurrency(schedule.amount, group.currency)}
										<Icon
											name="pencil"
											class="size-3 text-base-content/30 group-hover:text-base-content/60"
										/>
									</button>
								{/if}

								<div class="ml-12 flex items-center gap-2 sm:ml-0">
									<!-- Day picker -->
									<select
										class="select w-24 select-sm"
										aria-label="Day of month"
										value={String(schedule.recur_day || 1)}
										disabled={saving}
										onchange={(e) => changeDay(schedule, Number(e.currentTarget.value))}
									>
										{#each dayOptions as opt (opt.value)}
											<option value={opt.value}>Day {opt.label}</option>
										{/each}
									</select>

									<!-- Active toggle -->
									<input
										type="checkbox"
										class="toggle toggle-sm toggle-success"
										checked={schedule.active}
										disabled={saving}
										aria-label={schedule.active ? 'Pause schedule' : 'Resume schedule'}
										title={schedule.active ? 'Pause schedule' : 'Resume schedule'}
										onchange={() => toggleActive(schedule)}
									/>

									<!-- Remove schedule button -->
									<button
										class="btn btn-square text-base-content/45 btn-ghost btn-sm hover:text-error"
										title="Remove recurring schedule"
										aria-label="Remove recurring schedule"
										disabled={saving}
										onclick={() => (scheduleToRemove = schedule)}
									>
										{#if saving}
											<span class="loading loading-xs loading-spinner"></span>
										{:else}
											<Icon name="trash" class="size-4" />
										{/if}
									</button>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/each}
		{/if}
	</div>

	<Modal
		open={!!scheduleToRemove}
		title="Remove recurring schedule?"
		onclose={() => (scheduleToRemove = null)}
	>
		<p class="text-sm text-base-content/70">
			<strong>{scheduleToRemove?.description || scheduleToRemove?.category}</strong> will no longer
			repeat monthly. Past transactions are not affected.
		</p>
		{#snippet actions()}
			<Button variant="ghost" onclick={() => (scheduleToRemove = null)}>Cancel</Button>
			<Button variant="error" onclick={confirmRemove}>Remove schedule</Button>
		{/snippet}
	</Modal>
</AuthGuard>
