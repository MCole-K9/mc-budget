<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getWallet, getWallets, deleteWallet, archiveWallet, unarchiveWallet, recalculateBalance, updateWalletPrefs, updateCategoryColor } from '$lib/wallets.remote';
	import {
		getTransactions,
		getTransactionsPaged,
		getTransactionSummary,
		resetWalletBalance,
		deleteTransaction as removeTransaction
	} from '$lib/transactions.remote';
	import type { Transaction, SavedPeriod } from '$lib/types/budget';
	import AuthGuard from '$lib/components/AuthGuard.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import TransactionList from '$lib/components/TransactionList.svelte';
	import TransactionForm from '$lib/components/TransactionForm.svelte';
	import EditTransactionForm from '$lib/components/EditTransactionForm.svelte';
	import TransferForm from '$lib/components/TransferForm.svelte';
	import CoverOverageForm from '$lib/components/CoverOverageForm.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import PeriodFilter from '$lib/components/PeriodFilter.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { formatCurrency } from '$lib/utils/format';
	import { getCategoryBudgetsForDate, removeBudgetCover } from '$lib/budgetCovers.remote';
	import { getStandardPeriodRange, getPayCycleRange, getPayCycleOffsetForDate, todayYmd, formatShortDate, isDateInRange } from '$lib/utils/dateRange';
	import { getEffectiveIncome, getCategoryBudgets, OVERAGE_EPSILON, type CategoryBudget } from '$lib/utils/budget';

	const BUILTIN_PERIODS: { value: string; label: string }[] = [
		{ value: 'this-month', label: 'This Month' },
		{ value: 'last-month', label: 'Last Month' },
		{ value: 'last-3-months', label: '3 Months' },
		{ value: 'this-year', label: 'This Year' },
		{ value: 'all-time', label: 'All Time' },
		{ value: 'pay-cycle', label: 'Pay Cycle' },
		{ value: 'custom', label: 'Custom' }
	];

	const RESERVED_PERIOD_VALUES = new Set(BUILTIN_PERIODS.map((p) => p.value));

	let showAddTransaction = $state(false);
	let showTransfer = $state(false);
	let showDeleteConfirm = $state(false);
	let showResetBalanceConfirm = $state(false);
	let deleteConfirmName = $state('');
	let transactionToDelete = $state<Transaction | null>(null);
	let transactionToEdit = $state<Transaction | null>(null);
	let reconciling = $state(false);
	let resettingBalance = $state(false);
	let archiving = $state(false);
	let error = $state('');

	const walletId = page.params.id!;

	// Eagerly fetch wallet to bootstrap period prefs before any state is declared
	const walletForPrefs = await getWallet(walletId);

	function resolveInitialPeriod(w: typeof walletForPrefs) {
		const stored = w.default_period;
		if (!stored) return { period: 'this-month', startDate: '', endDate: '' };
		if (RESERVED_PERIOD_VALUES.has(stored)) return { period: stored, startDate: '', endDate: '' };
		const savedMatch = w.saved_periods.find((s) => s.name === stored);
		if (savedMatch) return { period: stored, startDate: savedMatch.startDate, endDate: savedMatch.endDate };
		return { period: 'this-month', startDate: '', endDate: '' };
	}

	const initial = resolveInitialPeriod(walletForPrefs);
	let selectedPeriod = $state(initial.period);
	let customStartDate = $state(initial.startDate);
	let customEndDate = $state(initial.endDate);
	let cycleStartDay = $state(walletForPrefs.cycle_start_day || 1);
	let cycleStartDayInput = $state(walletForPrefs.cycle_start_day || 1);
	let cycleOffset = $state(0);
	let currentPage = $state(1);
	const PER_PAGE = 15;

	// Save range UI
	let saveRangeName = $state('');
	let showSaveRangeInput = $state(false);
	let savingPrefs = $state(false);

	// Whether to show date picker inputs (custom period or named saved period)
	const showDateInputs = $derived(!['this-month', 'last-month', 'last-3-months', 'this-year', 'all-time', 'pay-cycle'].includes(selectedPeriod));

	// getDateRange must NOT reference `wallet` to avoid a circular $derived dependency.
	// When selecting a saved period, setPeriod() copies its dates into customStartDate/customEndDate.
	function getDateRange(period: string): { startDate?: string; endDate?: string } {
		const now = new Date();

		const standardRange = getStandardPeriodRange(period, now);
		if (standardRange) return standardRange;
		if (period === 'pay-cycle') {
			return getPayCycleRange(cycleStartDay, cycleOffset, now);
		}
		// 'custom' or any saved period name — dates are in customStartDate/customEndDate
		return {
			startDate: customStartDate || undefined,
			endDate: customEndDate || undefined
		};
	}

	const dateRange = $derived(getDateRange(selectedPeriod));

	// All three fetched in parallel to avoid waterfalls
	const [wallet, summary, pagedResult] = $derived(
		await Promise.all([
			getWallet(walletId),
			getTransactionSummary({ walletId, ...dateRange }),
			getTransactionsPaged({ walletId, page: currentPage, perPage: PER_PAGE, ...dateRange })
		])
	);

	function refreshPagedQuery() {
		getTransactionsPaged({ walletId, page: currentPage, perPage: PER_PAGE, ...dateRange }).refresh();
		getTransactionSummary({ walletId, ...dateRange }).refresh();
	}

	function setPeriod(p: string) {
		selectedPeriod = p;
		currentPage = 1;
		cycleOffset = 0;
		showSaveRangeInput = false;
		saveRangeName = '';
		// If selecting a named saved period, copy its dates so getDateRange can read them
		const saved =
			wallet?.saved_periods.find((s) => s.name === p) ??
			walletForPrefs.saved_periods.find((s) => s.name === p);
		if (saved) {
			customStartDate = saved.startDate;
			customEndDate = saved.endDate;
		}
	}

	// CSV fetches transactions on demand (lazy) and exports the current date range
	async function exportCsv() {
		const allTx = await getTransactions(walletId);
		const filtered = allTx.filter((t) => {
			if (dateRange.startDate && t.date < dateRange.startDate) return false;
			if (dateRange.endDate && t.date > dateRange.endDate) return false;
			return true;
		});
		const rows = [
			['Date', 'Category', 'Description', 'Amount', 'Currency'],
			...filtered.map((t) => [
				t.date,
				t.category,
				t.description || '',
				t.amount.toFixed(2),
				wallet.currency
			])
		];
		const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		const suffix = dateRange.startDate ? dateRange.startDate : 'all';
		a.download = `${wallet.name}-${suffix}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function persistWalletPrefs(patch: { default_period?: string; saved_periods?: SavedPeriod[]; cycle_start_day?: number }) {
		savingPrefs = true;
		try {
			await updateWalletPrefs({ id: walletId, ...patch });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save period preference';
		} finally {
			savingPrefs = false;
		}
	}

	async function walletPref(patch: { carry_forward?: boolean }) {
		try {
			await updateWalletPrefs({ id: walletId, ...patch });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save wallet preference';
		}
	}

	async function handleSaveRange() {
		const name = saveRangeName.trim();
		if (!name || !customStartDate || !customEndDate) return;
		if (RESERVED_PERIOD_VALUES.has(name)) {
			error = `"${name}" is reserved. Choose a different name.`;
			return;
		}
		const existing = wallet.saved_periods.filter((s) => s.name !== name);
		const updated: SavedPeriod[] = [...existing, { name, startDate: customStartDate, endDate: customEndDate }];
		await persistWalletPrefs({ saved_periods: updated });
		saveRangeName = '';
		showSaveRangeInput = false;
		selectedPeriod = name; // highlight the newly saved period
	}

	async function handleDeleteSavedPeriod(sp: SavedPeriod) {
		const updated = wallet.saved_periods.filter((s) => s.name !== sp.name);
		const patch: { saved_periods: SavedPeriod[]; default_period?: string } = { saved_periods: updated };
		if (wallet.default_period === sp.name) patch.default_period = '';
		await persistWalletPrefs(patch);
		if (selectedPeriod === sp.name) setPeriod('this-month');
	}

	function jumpToCycleForDate(dateStr: string) {
		if (!dateStr) return;
		cycleOffset = getPayCycleOffsetForDate(new Date(dateStr + 'T00:00:00'), cycleStartDay);
		currentPage = 1;
	}

	async function handleSaveCycleDay() {
		const day = Math.max(1, Math.min(28, Math.round(cycleStartDayInput)));
		cycleStartDay = day;
		cycleStartDayInput = day;
		await persistWalletPrefs({ cycle_start_day: day });
	}

	function handleDeleteTransaction(transaction: Transaction) {
		transactionToDelete = transaction;
	}

	function handleEditTransaction(transaction: Transaction) {
		transactionToEdit = transaction;
	}

	async function confirmDeleteTransaction() {
		if (!transactionToDelete) return;
		try {
			await removeTransaction({ id: transactionToDelete.id, walletId: transactionToDelete.wallet });
			transactionToDelete = null;
			refreshPagedQuery();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete transaction';
			transactionToDelete = null;
		}
	}

	async function handleArchiveWallet() {
		archiving = true;
		try {
			await archiveWallet(wallet.id);
			await goto(resolve('/wallets'));
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to archive wallet';
		} finally {
			archiving = false;
		}
	}

	async function handleUnarchiveWallet() {
		archiving = true;
		try {
			await unarchiveWallet(wallet.id);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to unarchive wallet';
		} finally {
			archiving = false;
		}
	}

	async function handleDeleteWallet() {
		try {
			await deleteWallet(wallet.id);
			await goto(resolve('/wallets'));
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete wallet';
		}
	}

	async function handleRecalculate() {
		reconciling = true;
		try {
			await recalculateBalance(walletId);
			refreshPagedQuery();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to recalculate balance';
		} finally {
			reconciling = false;
		}
	}

	async function handleResetBalance() {
		resettingBalance = true;
		try {
			await resetWalletBalance({ walletId, date: todayYmd() });
			refreshPagedQuery();
			showResetBalanceConfirm = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to reset wallet balance';
			showResetBalanceConfirm = false;
		} finally {
			resettingBalance = false;
		}
	}

	const periodLabel = $derived(
		BUILTIN_PERIODS.find((p) => p.value === selectedPeriod)?.label ?? selectedPeriod
	);

	// Income available for allocation in the selected period (see getEffectiveIncome)
	const effectivePeriodIncome = $derived(getEffectiveIncome(wallet, summary, dateRange));

	// Allocated / spent / remaining per category, in wallet.categories order, including covers
	const categoryBudgets = $derived(getCategoryBudgets(wallet, summary, effectivePeriodIncome));
	const totalSpent = $derived(categoryBudgets.reduce((s, b) => s + b.spent, 0));
	const totalAllocated = $derived(categoryBudgets.reduce((s, b) => s + b.allocated, 0));

	// Width of each category in the allocation bar; fixed wallets use their share of the total limit
	const allocationShares = $derived.by(() => {
		if (wallet.budget_type !== 'fixed') return wallet.categories.map((c) => c.percentage);
		const total = wallet.categories.reduce((s, c) => s + (c.fixedAmount ?? 0), 0);
		return wallet.categories.map((c) => (total > 0 ? ((c.fixedAmount ?? 0) / total) * 100 : 0));
	});

	// The period this wallet opens on, after falling back from a stale or deleted default
	const effectiveDefaultPeriod = $derived(resolveInitialPeriod(wallet).period);
	const isDefaultPeriod = $derived(effectiveDefaultPeriod === selectedPeriod);

	// A complete custom range can be saved under a name
	const canSaveRange = $derived(showDateInputs && !!customStartDate && !!customEndDate);

	// Saved ranges are chosen from their own chips, so no built-in tab is selected for them
	const builtinSelection = $derived(
		RESERVED_PERIOD_VALUES.has(selectedPeriod) ? selectedPeriod : ''
	);

	type CoverRequest = {
		category: string;
		overage: number;
		date: string;
		periodText: string;
		budgets: CategoryBudget[];
	};
	let coverRequest = $state<CoverRequest | null>(null);

	function describeRange(range: { startDate?: string; endDate?: string }): string {
		if (!range.startDate && !range.endDate) return 'all time';
		if (!range.startDate) return `up to ${formatShortDate(range.endDate!)}`;
		if (!range.endDate) return `since ${formatShortDate(range.startDate)}`;
		return `${formatShortDate(range.startDate)} – ${formatShortDate(range.endDate)}`;
	}

	type PeriodBudgets = Awaited<ReturnType<typeof getCategoryBudgetsForDate>>;

	function findBudget(budgets: CategoryBudget[], name: string) {
		return budgets.find((b) => b.name.toLowerCase() === name.toLowerCase());
	}

	function openCoverPrompt(budget: CategoryBudget, date: string, period: PeriodBudgets) {
		coverRequest = {
			category: budget.name,
			overage: -budget.remaining,
			date,
			periodText: describeRange(period),
			budgets: period.categories
		};
	}

	// After saving an expense, offer to cover its category if this save pushed it over (or further
	// over) in the default period containing the expense. `previous` is the expense before an edit.
	async function promptCoverIfOver(tx: Transaction, previous?: Transaction) {
		if (wallet.budget_type !== 'percentage' || tx.amount >= 0 || tx.transfer_id || tx.balance_adjustment) return;
		try {
			const period = await getCategoryBudgetsForDate({ walletId, date: tx.date, today: todayYmd() });
			const budget = findBudget(period.categories, tx.category);
			if (!budget || budget.remaining > -OVERAGE_EPSILON) return;
			// Spending the previous version already put in this category and period
			const alreadyCounted =
				previous &&
				previous.amount < 0 &&
				previous.category.toLowerCase() === tx.category.toLowerCase() &&
				isDateInRange(period, previous.date)
					? Math.abs(previous.amount)
					: 0;
			if (Math.abs(tx.amount) - alreadyCounted <= OVERAGE_EPSILON) return;
			openCoverPrompt(budget, tx.date, period);
		} catch {
			// The expense is saved either way; the prompt is only a convenience
		}
	}

	// Cover button: covers are recorded in the default period, so check the one containing today,
	// moved inside the period being viewed (e.g. its last day when viewing last month)
	async function coverFromSelectedPeriod(categoryName: string) {
		let date = todayYmd();
		if (dateRange.endDate && date > dateRange.endDate) date = dateRange.endDate;
		if (dateRange.startDate && date < dateRange.startDate) date = dateRange.startDate;
		try {
			const period = await getCategoryBudgetsForDate({ walletId, date, today: todayYmd() });
			const budget = findBudget(period.categories, categoryName);
			if (!budget || budget.remaining > -OVERAGE_EPSILON) {
				error = `${categoryName} isn't over budget for ${describeRange(period)}, the budget period covers apply to.`;
				return;
			}
			openCoverPrompt(budget, date, period);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to check the budget';
		}
	}

	async function handleRemoveCover(id: string) {
		try {
			await removeBudgetCover({ id });
			refreshPagedQuery();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to remove cover';
		}
	}
</script>

<svelte:head>
	<title>{wallet.name} - MC Budget</title>
</svelte:head>

<AuthGuard>
	<div class="space-y-6">
		{#if error}
			<Alert type="error" dismissible ondismiss={() => (error = '')}>{error}</Alert>
		{/if}

		<!-- Header -->
		<div>
			<PageHeader title={wallet.name} backHref={resolve('/wallets')} backLabel="Wallets">
				{#snippet badge()}
					{#if wallet.archived}
						<span class="badge badge-ghost badge-sm">
							<Icon name="archive" class="size-3" /> Archived
						</span>
					{/if}
				{/snippet}
				{#snippet actions()}
					<Button size="sm" icon="plus" onclick={() => (showAddTransaction = true)}>
						Add transaction
					</Button>
					<Button size="sm" variant="soft" icon="transfer" onclick={() => (showTransfer = true)}>
						Transfer
					</Button>
					<div class="dropdown dropdown-end">
						<button
							tabindex="0"
							class="btn btn-square btn-ghost btn-sm"
							title="Wallet options"
							aria-label="Wallet options"
						>
							<Icon name="more" class="size-5" />
						</button>
						<ul
							class="dropdown-content menu z-20 mt-1 w-56 rounded-box border border-base-300/70 bg-base-100 p-1.5 shadow-xl"
						>
							<li>
								<button
									onclick={() => (showResetBalanceConfirm = true)}
									disabled={wallet.balance === 0}
								>
									<Icon name="scale" class="size-4" />
									Reset balance to {formatCurrency(0, wallet.currency)}
								</button>
							</li>
							{#if pagedResult.totalItems > 0}
								<li>
									<button onclick={exportCsv}>
										<Icon name="download" class="size-4" />
										Export period as CSV
									</button>
								</li>
							{/if}
							{#if wallet.archived}
								<li>
									<button onclick={handleUnarchiveWallet} disabled={archiving}>
										<Icon name="archive" class="size-4" />
										{archiving ? 'Unarchiving…' : 'Unarchive wallet'}
									</button>
								</li>
							{:else}
								<li>
									<button onclick={handleArchiveWallet} disabled={archiving}>
										<Icon name="archive" class="size-4" />
										{archiving ? 'Archiving…' : 'Archive wallet'}
									</button>
								</li>
							{/if}
							<li class="mt-1 border-t border-base-300/70 pt-1">
								<button class="text-error" onclick={() => (showDeleteConfirm = true)}>
									<Icon name="trash" class="size-4" />
									Delete wallet
								</button>
							</li>
						</ul>
					</div>
				{/snippet}
			</PageHeader>

			<!-- Balance and period totals -->
			<div class="-mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
				<div class="surface col-span-2 p-5 sm:col-span-1">
					<div class="flex items-center justify-between">
						<p class="eyebrow">Balance</p>
						<button
							class="btn btn-square text-base-content/45 btn-ghost btn-xs hover:text-base-content"
							onclick={handleRecalculate}
							disabled={reconciling}
							title="Recalculate balance from transaction history"
							aria-label="Recalculate balance"
						>
							<Icon name="refresh" class={['size-3.5', reconciling && 'animate-spin']} />
						</button>
					</div>
					<p class="mt-1 text-3xl font-bold tracking-tight tabular-nums">
						{formatCurrency(wallet.balance, wallet.currency)}
					</p>
					<p class="mt-1 text-xs text-base-content/50">
						{wallet.currency} · {wallet.budget_type === 'fixed' ? 'Fixed limits' : '% of income'}
					</p>
				</div>
				{#if wallet.budget_type !== 'fixed'}
					<div class="surface p-4 sm:p-5">
						<p class="eyebrow">Income · {periodLabel}</p>
						<p class="mt-1 text-xl font-semibold tracking-tight text-success tabular-nums sm:text-2xl">
							{formatCurrency(effectivePeriodIncome, wallet.currency)}
						</p>
						<p class="mt-1 text-xs text-base-content/50">Available to allocate</p>
					</div>
				{/if}
				<div class={['surface p-4 sm:p-5', wallet.budget_type === 'fixed' && 'col-span-2']}>
					<p class="eyebrow">Spent · {periodLabel}</p>
					<p
						class={[
							'mt-1 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl',
							totalSpent > 0 && 'text-error'
						]}
					>
						{formatCurrency(totalSpent, wallet.currency)}
					</p>
					<p class="mt-1 text-xs text-base-content/50">
						of {formatCurrency(totalAllocated, wallet.currency)} budgeted
					</p>
				</div>
			</div>
		</div>

		<!-- Period selector: drives both the budget and the transaction list -->
		<PeriodFilter
			periods={BUILTIN_PERIODS}
			value={builtinSelection}
			onselect={setPeriod}
			startDate={customStartDate}
			endDate={customEndDate}
			showDates={showDateInputs}
			ondateschange={(r) => {
				customStartDate = r.startDate;
				customEndDate = r.endDate;
				currentPage = 1;
			}}
		>
			{#snippet actions()}
				<button
					class={[
						'btn gap-1.5 btn-ghost btn-sm',
						isDefaultPeriod ? 'text-warning' : 'text-base-content/50'
					]}
					onclick={() => persistWalletPrefs({ default_period: selectedPeriod })}
					disabled={savingPrefs || isDefaultPeriod}
					title={isDefaultPeriod ? 'This is the default period' : 'Open this wallet on this period'}
				>
					<Icon name="star" filled={isDefaultPeriod} class="size-4" />
					<span class="text-xs">{isDefaultPeriod ? 'Default' : 'Make default'}</span>
				</button>
			{/snippet}

			<!-- Saved periods -->
			{#if wallet.saved_periods.length > 0}
				<div class="flex flex-wrap items-center gap-1.5">
					<span class="mr-1 text-xs text-base-content/50">Saved:</span>
					{#each wallet.saved_periods as sp (sp.name)}
						{@const active = selectedPeriod === sp.name}
						{@const isDefault = effectiveDefaultPeriod === sp.name}
						<div
							class={[
								'flex items-center rounded-full border text-sm transition-colors',
								active
									? 'border-primary/40 bg-primary/10 text-primary'
									: 'border-base-300 bg-base-100 hover:border-base-content/20'
							]}
						>
							<button
								class={[
									'grid size-7 place-items-center rounded-full',
									isDefault ? 'text-warning' : 'text-base-content/35 hover:text-warning'
								]}
								onclick={() => persistWalletPrefs({ default_period: sp.name })}
								disabled={savingPrefs || isDefault}
								title={isDefault ? 'Default period' : 'Set as default'}
								aria-label={isDefault
									? `${sp.name} is the default period`
									: `Make ${sp.name} the default period`}
							>
								<Icon name="star" filled={isDefault} class="size-3.5" />
							</button>
							<button class="py-1 pr-1 font-medium" onclick={() => setPeriod(sp.name)}>
								{sp.name}
								<span class="ml-1 text-xs font-normal text-base-content/50">
									{formatShortDate(sp.startDate)} – {formatShortDate(sp.endDate)}
								</span>
							</button>
							<button
								class="grid size-7 place-items-center rounded-full text-base-content/40 hover:text-error"
								onclick={() => handleDeleteSavedPeriod(sp)}
								disabled={savingPrefs}
								title="Remove saved range"
								aria-label="Remove saved range {sp.name}"
							>
								<Icon name="x" class="size-3" />
							</button>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Pay cycle controls -->
			{#if selectedPeriod === 'pay-cycle'}
				<div class="surface flex flex-wrap items-center gap-x-4 gap-y-3 p-3">
					<div class="flex items-center gap-1">
						<button
							class="btn btn-square btn-ghost btn-sm"
							onclick={() => {
								cycleOffset--;
								currentPage = 1;
							}}
							aria-label="Previous cycle"
						>
							<Icon name="chevron-left" class="size-4" />
						</button>
						<span class="min-w-44 text-center text-sm font-medium tabular-nums">
							{describeRange(dateRange)}
						</span>
						<button
							class="btn btn-square btn-ghost btn-sm"
							onclick={() => {
								cycleOffset++;
								currentPage = 1;
							}}
							aria-label="Next cycle"
						>
							<Icon name="chevron-right" class="size-4" />
						</button>
						{#if cycleOffset !== 0}
							<button
								class="btn btn-ghost btn-xs"
								onclick={() => {
									cycleOffset = 0;
									currentPage = 1;
								}}>Today</button
							>
						{/if}
					</div>
					<label class="flex items-center gap-2 text-sm text-base-content/60">
						Jump to
						<input
							type="date"
							class="input input-sm w-36"
							title="Jump to cycle containing this date"
							onchange={(e) => jumpToCycleForDate(e.currentTarget.value)}
						/>
					</label>
					<div class="flex items-center gap-2 text-sm text-base-content/60 sm:ml-auto">
						<span>Starts on day</span>
						<input
							type="number"
							class="input input-sm w-16"
							min="1"
							max="28"
							aria-label="Cycle start day"
							value={cycleStartDayInput}
							oninput={(e) => (cycleStartDayInput = Number(e.currentTarget.value))}
							onkeydown={(e) => e.key === 'Enter' && handleSaveCycleDay()}
						/>
						{#if cycleStartDayInput !== cycleStartDay}
							<Button size="sm" onclick={handleSaveCycleDay} loading={savingPrefs}>Save</Button>
						{/if}
					</div>
				</div>
			{/if}
		</PeriodFilter>

		<!-- Save this range (custom period or named saved period) -->
		{#if canSaveRange}
			{#if !showSaveRangeInput}
				<button class="btn -mt-3 btn-ghost btn-xs" onclick={() => (showSaveRangeInput = true)}>
					<Icon name="plus" class="size-3.5" />
					Save this range
				</button>
			{:else}
				<div class="-mt-3 flex max-w-xl items-center gap-2">
					<input
						type="text"
						class="input input-sm min-w-0 flex-1"
						placeholder="Range name (e.g. Q1 2026)"
						aria-label="Range name"
						bind:value={saveRangeName}
						maxlength="100"
					/>
					<Button
						size="sm"
						onclick={handleSaveRange}
						disabled={!saveRangeName.trim()}
						loading={savingPrefs}
					>
						Save
					</Button>
					<Button
						size="sm"
						variant="ghost"
						onclick={() => {
							showSaveRangeInput = false;
							saveRangeName = '';
						}}
					>
						Cancel
					</Button>
				</div>
			{/if}
		{/if}

		<!-- Budget Allocation -->
		<Card
			title="Budget"
			subtitle={wallet.budget_type === 'fixed'
				? 'Fixed monthly limits'
				: `Income split for ${describeRange(dateRange)}`}
		>
			{#snippet header()}
				{#if wallet.budget_type !== 'fixed'}
					<label
						class="flex cursor-pointer items-center gap-2 text-xs text-base-content/60"
						title="Roll unspent budget into the next period"
					>
						Carry forward
						<input
							type="checkbox"
							class="toggle toggle-xs toggle-primary"
							checked={wallet.carry_forward}
							onchange={(e) => walletPref({ carry_forward: e.currentTarget.checked })}
						/>
					</label>
				{/if}
			{/snippet}

			{#if wallet.budget_type !== 'fixed' && effectivePeriodIncome === 0 && selectedPeriod !== 'all-time'}
				<div
					class="mb-4 flex items-center gap-2 rounded-field bg-base-200/70 px-3 py-2 text-xs text-base-content/60"
				>
					<Icon name="info" class="size-4" />
					No income this period, so nothing is allocated yet. Switch to All Time to see the full allocation.
				</div>
			{/if}

			<!-- Allocation bar -->
			<div class="mb-5 flex h-2 gap-0.5 overflow-hidden rounded-full">
				{#each wallet.categories as category, i (category.name)}
					<div
						class="h-full"
						style:width="{allocationShares[i]}%"
						style:background-color={category.color}
						title="{category.name}: {wallet.budget_type === 'fixed'
							? formatCurrency(category.fixedAmount ?? 0, wallet.currency)
							: category.percentage + '%'}"
					></div>
				{/each}
			</div>

			<div class="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
				{#each wallet.categories as category, i (category.name)}
					{@const budget = categoryBudgets[i]}
					{@const allocated = budget.allocated}
					{@const spent = budget.spent}
					{@const remaining = budget.remaining}
					{@const covers = summary.covers.filter(
						(c) => c.category.toLowerCase() === category.name.toLowerCase()
					)}
					{@const spentPct = allocated > 0 ? Math.min(100, (spent / allocated) * 100) : 0}
					{@const overBudget = remaining < 0}
					<div>
						<div class="flex items-center justify-between gap-2">
							<div class="flex min-w-0 items-center gap-2">
								<label
									class="relative size-3.5 shrink-0 cursor-pointer rounded ring-1 ring-black/5 ring-inset"
									style:background-color={category.color}
									title="Change color"
								>
									<input
										type="color"
										value={category.color}
										class="absolute inset-0 cursor-pointer opacity-0"
										aria-label="Change {category.name} color"
										onchange={(e) =>
											updateCategoryColor({
												id: wallet.id,
												categoryName: category.name,
												color: e.currentTarget.value
											})}
									/>
								</label>
								<span class="truncate font-medium">{category.name}</span>
								{#if wallet.budget_type !== 'fixed'}
									<span class="text-xs text-base-content/45 tabular-nums">{category.percentage}%</span>
								{/if}
							</div>
							<span
								class={[
									'shrink-0 text-sm font-semibold tabular-nums',
									overBudget ? 'text-error' : 'text-base-content'
								]}
							>
								{formatCurrency(Math.abs(remaining), wallet.currency)}
								<span class="font-normal text-base-content/50">{overBudget ? 'over' : 'left'}</span>
							</span>
						</div>
						<div class="mt-2 h-2 overflow-hidden rounded-full bg-base-200">
							<div
								class="h-full rounded-full transition-all"
								style:width="{overBudget ? 100 : spentPct}%"
								style:background-color={overBudget ? 'var(--color-error)' : category.color}
							></div>
						</div>
						<div class="mt-1.5 flex items-center justify-between gap-2 text-xs text-base-content/50">
							<span class="tabular-nums">
								<span class={[spent > 0 && 'font-medium text-error']}
									>{formatCurrency(spent, wallet.currency)}</span
								>
								of {formatCurrency(allocated, wallet.currency)}
							</span>
							{#if overBudget && wallet.budget_type === 'percentage'}
								<button
									class="btn btn-soft btn-xs btn-error"
									onclick={() => coverFromSelectedPeriod(category.name)}
									title="Choose a category or wallet to cover the overage"
								>
									Cover overage
								</button>
							{:else if overBudget}
								<span class="badge badge-soft badge-xs badge-error">Over budget</span>
							{/if}
						</div>
						{#each covers as cover (cover.id + cover.direction)}
							<div class="mt-1 flex items-center gap-1 text-xs text-base-content/55">
								<Icon
									name="transfer"
									class={[
										'size-3',
										cover.direction === 'in' ? 'text-success' : 'text-base-content/40'
									]}
								/>
								<span>
									{cover.direction === 'in' ? '+' : '−'}{formatCurrency(
										cover.amount,
										wallet.currency
									)}
									{cover.direction === 'in' ? 'covered by' : 'covering'}
									{cover.counterpartCategory}{cover.counterpartWalletName
										? ` (${cover.counterpartWalletName})`
										: ''}
								</span>
								<button
									class="btn btn-square text-base-content/40 btn-ghost btn-xs hover:text-error"
									onclick={() => handleRemoveCover(cover.id)}
									title="Undo this cover"
									aria-label="Undo this cover"
								>
									<Icon name="x" class="size-3" />
								</button>
							</div>
						{/each}
					</div>
				{/each}
			</div>
		</Card>

		<!-- Transactions -->
		<Card title="Transactions" subtitle={describeRange(dateRange)}>
			{#snippet header()}
				{#if pagedResult.totalItems > 0}
					<button class="btn btn-ghost btn-sm" onclick={exportCsv} title="Export as CSV">
						<Icon name="download" class="size-4" />
						<span class="hidden sm:inline">CSV</span>
					</button>
				{/if}
				<Button size="sm" variant="soft" icon="plus" onclick={() => (showAddTransaction = true)}>
					Add
				</Button>
			{/snippet}

			<TransactionList
				transactions={pagedResult.items}
				{wallet}
				ondelete={handleDeleteTransaction}
				onedit={handleEditTransaction}
			/>

			{#if pagedResult.totalItems > 0}
				<div class="mt-5">
					<Pagination
						page={currentPage}
						totalPages={pagedResult.totalPages}
						totalItems={pagedResult.totalItems}
						onchange={(p) => (currentPage = p)}
					/>
				</div>
			{/if}
		</Card>
	</div>

	<!-- Add Transaction Modal -->
	<Modal bind:open={showAddTransaction} title="Add transaction" description={wallet.name}>
		<TransactionForm
			{wallet}
			onSuccess={(tx) => {
				showAddTransaction = false;
				refreshPagedQuery();
				promptCoverIfOver(tx);
			}}
		/>
	</Modal>

	<!-- Reset Balance Confirmation Modal -->
	<Modal bind:open={showResetBalanceConfirm} title="Reset balance?">
		<p class="text-sm text-base-content/70">
			Set <strong>{wallet.name}</strong>'s balance from
			<strong>{formatCurrency(wallet.balance, wallet.currency)}</strong> to
			<strong>{formatCurrency(0, wallet.currency)}</strong>? A dated balance adjustment will preserve
			your transaction history and can be deleted later to undo the reset.
		</p>
		{#snippet actions()}
			<Button
				variant="ghost"
				onclick={() => (showResetBalanceConfirm = false)}
				disabled={resettingBalance}
			>
				Cancel
			</Button>
			<Button variant="error" onclick={handleResetBalance} loading={resettingBalance}>
				Reset to {formatCurrency(0, wallet.currency)}
			</Button>
		{/snippet}
	</Modal>

	<!-- Delete Wallet Confirmation Modal -->
	<Modal
		bind:open={showDeleteConfirm}
		title="Delete wallet?"
		onclose={() => (deleteConfirmName = '')}
	>
		<p class="mb-4 text-sm text-base-content/70">
			This will permanently delete <strong>{wallet.name}</strong> and all its transactions. This cannot
			be undone.
		</p>
		<label class="flex w-full flex-col gap-1.5">
			<span class="text-sm">Type <strong>{wallet.name}</strong> to confirm</span>
			<input type="text" class="input w-full" placeholder={wallet.name} bind:value={deleteConfirmName} />
		</label>
		{#snippet actions()}
			<Button
				variant="ghost"
				onclick={() => {
					showDeleteConfirm = false;
					deleteConfirmName = '';
				}}
			>
				Cancel
			</Button>
			<Button
				variant="error"
				onclick={handleDeleteWallet}
				disabled={deleteConfirmName !== wallet.name}
			>
				Delete wallet
			</Button>
		{/snippet}
	</Modal>

	<!-- Delete Transaction Confirmation Modal -->
	<Modal
		open={!!transactionToDelete}
		title="Delete transaction?"
		onclose={() => (transactionToDelete = null)}
	>
		{#if transactionToDelete?.transfer_id}
			<p class="text-sm text-base-content/70">
				This is a <strong>transfer</strong>. Deleting it will also delete the linked transaction in
				the other wallet and reverse the balance changes on both sides.
			</p>
		{:else}
			<p class="text-sm text-base-content/70">
				Are you sure you want to delete this transaction? This will reverse its effect on your wallet
				balance.
			</p>
		{/if}
		{#snippet actions()}
			<Button variant="ghost" onclick={() => (transactionToDelete = null)}>Cancel</Button>
			<Button variant="error" onclick={confirmDeleteTransaction}>Delete transaction</Button>
		{/snippet}
	</Modal>

	<!-- Transfer Modal -->
	<Modal bind:open={showTransfer} title="Transfer between wallets">
		<svelte:boundary>
			{@const allWallets = await getWallets()}
			<TransferForm
				sourceWallet={wallet}
				wallets={allWallets}
				onSuccess={() => {
					showTransfer = false;
					refreshPagedQuery();
				}}
				onCancel={() => (showTransfer = false)}
			/>
			{#snippet pending()}
				<div class="grid place-items-center py-8">
					<span class="loading loading-spinner"></span>
				</div>
			{/snippet}
		</svelte:boundary>
	</Modal>

	<!-- Edit Transaction Modal -->
	<Modal
		open={!!transactionToEdit}
		title="Edit transaction"
		onclose={() => (transactionToEdit = null)}
	>
		{#if transactionToEdit}
			<EditTransactionForm
				transaction={transactionToEdit}
				{wallet}
				onSuccess={(tx) => {
					const previous = transactionToEdit ?? undefined;
					transactionToEdit = null;
					refreshPagedQuery();
					promptCoverIfOver(tx, previous);
				}}
				onCancel={() => (transactionToEdit = null)}
			/>
		{/if}
	</Modal>

	<!-- Cover Overage Modal -->
	<Modal open={!!coverRequest} title="Cover overage" onclose={() => (coverRequest = null)}>
		{#if coverRequest}
			<svelte:boundary>
				{@const allWallets = await getWallets()}
				<CoverOverageForm
					{wallet}
					{...coverRequest}
					wallets={allWallets}
					onCovered={() => {
						coverRequest = null;
						refreshPagedQuery();
					}}
					onSkip={() => (coverRequest = null)}
				/>
				{#snippet pending()}
					<div class="grid place-items-center py-8">
						<span class="loading loading-spinner"></span>
					</div>
				{/snippet}
			</svelte:boundary>
		{/if}
	</Modal>
</AuthGuard>
