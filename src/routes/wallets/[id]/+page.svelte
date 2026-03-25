<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getWallet, deleteWallet, recalculateBalance, updatePeriodPrefs } from '$lib/wallets.remote';
	import {
		getTransactions,
		getTransactionsPaged,
		getTransactionSummary,
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
	let showDeleteConfirm = $state(false);
	let deleteConfirmName = $state('');
	let transactionToDelete = $state<Transaction | null>(null);
	let transactionToEdit = $state<Transaction | null>(null);
	let reconciling = $state(false);
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
		const pad = (n: number) => String(n).padStart(2, '0');
		const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

		if (period === 'this-month') {
			return { startDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, endDate: today };
		}
		if (period === 'last-month') {
			const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
			const m = now.getMonth() === 0 ? 12 : now.getMonth();
			const lastDay = new Date(y, m, 0).getDate();
			return { startDate: `${y}-${pad(m)}-01`, endDate: `${y}-${pad(m)}-${pad(lastDay)}` };
		}
		if (period === 'last-3-months') {
			const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
			return { startDate: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`, endDate: today };
		}
		if (period === 'this-year') {
			return { startDate: `${now.getFullYear()}-01-01`, endDate: today };
		}
		if (period === 'all-time') {
			return {};
		}
		if (period === 'pay-cycle') {
			const day = Math.min(cycleStartDay, 28);
			const startDate = new Date(now.getFullYear(), now.getMonth() - 1 + cycleOffset, day);
			const endDate = new Date(now.getFullYear(), now.getMonth() + cycleOffset, day);
			return {
				startDate: `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`,
				endDate: `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`
			};
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

	async function persistPeriodPrefs(patch: { default_period?: string; saved_periods?: SavedPeriod[]; cycle_start_day?: number }) {
		savingPrefs = true;
		try {
			await updatePeriodPrefs({ id: walletId, ...patch });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save period preference';
		} finally {
			savingPrefs = false;
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
		await persistPeriodPrefs({ saved_periods: updated });
		saveRangeName = '';
		showSaveRangeInput = false;
		selectedPeriod = name; // highlight the newly saved period
	}

	async function handleDeleteSavedPeriod(sp: SavedPeriod) {
		const updated = wallet.saved_periods.filter((s) => s.name !== sp.name);
		const patch: { saved_periods: SavedPeriod[]; default_period?: string } = { saved_periods: updated };
		if (wallet.default_period === sp.name) patch.default_period = '';
		await persistPeriodPrefs(patch);
		if (selectedPeriod === sp.name) setPeriod('this-month');
	}

	function jumpToCycleForDate(dateStr: string) {
		if (!dateStr) return;
		const d = new Date(dateStr + 'T00:00:00');
		const now = new Date();
		const day = Math.min(cycleStartDay, 28);
		// Cycle ends in d's month if d.date < day, otherwise in d's month + 1
		let endMonth = d.getMonth();
		let endYear = d.getFullYear();
		if (d.getDate() >= day) {
			endMonth++;
			if (endMonth > 11) { endMonth = 0; endYear++; }
		}
		cycleOffset = (endYear - now.getFullYear()) * 12 + (endMonth - now.getMonth());
		currentPage = 1;
	}

	async function handleSaveCycleDay() {
		const day = Math.max(1, Math.min(28, Math.round(cycleStartDayInput)));
		cycleStartDay = day;
		cycleStartDayInput = day;
		await persistPeriodPrefs({ cycle_start_day: day });
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

	function formatCurrency(amount: number, currency: string): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
	}

	function getCategoryAmount(category: typeof wallet.categories[number]): number {
		if (wallet.budget_type === "fixed") {
			return category.fixedAmount ?? 0;
		}
		return (periodIncome * category.percentage) / 100;
	}

	function inDateRange(date: string): boolean {
		if (dateRange.startDate && date < dateRange.startDate) return false;
		if (dateRange.endDate && date > dateRange.endDate) return false;
		return true;
	}

	const periodLabel = $derived(
		BUILTIN_PERIODS.find((p) => p.value === selectedPeriod)?.label ?? selectedPeriod
	);

	// Income received in the selected period.
	// For 'all-time' use total_funded (which includes initial_balance + all income).
	// For other periods: server-aggregated income + initial_balance if wallet was created in range.
	const periodIncome = $derived(
		selectedPeriod === 'all-time'
			? wallet.total_funded
			: summary.income + (inDateRange(wallet.created.split('T')[0]) ? wallet.initial_balance : 0)
	);

	// Spending per category for the selected period — from server-aggregated summary
	function getCategorySpent(categoryName: string): number {
		return summary.spendingByCategory[categoryName.toLowerCase()] ?? 0;
	}
</script>

<svelte:head>
	<title>{wallet.name} - MC Budget</title>
</svelte:head>

<AuthGuard>
	{#snippet children()}
		<div class="max-w-4xl mx-auto space-y-6">
			{#if error}
				<Alert type="error" dismissible ondismiss={() => (error = '')}>
					{#snippet children()}{error}{/snippet}
				</Alert>
			{/if}

			<!-- Header -->
			<div>
				<a href={resolve('/wallets')} class="btn btn-ghost btn-sm mb-3 -ml-3">&larr; Wallets</a>
				<div class="flex justify-between items-end">
					<div>
						<h1 class="text-2xl font-bold">{wallet.name}</h1>
						<div class="flex items-baseline gap-2 mt-1">
							<p class="text-3xl font-bold text-primary tabular-nums">
								{formatCurrency(wallet.balance, wallet.currency)}
							</p>
							<button
								class="text-base text-base-content/30 hover:text-base-content/60 transition-colors"
								onclick={handleRecalculate}
								disabled={reconciling}
								title="Recalculate balance from transaction history"
							>
								{reconciling ? '…' : '↺'}
							</button>
						</div>
					</div>
					<div class="flex gap-2">
						<Button variant="primary" size="sm" onclick={() => (showAddTransaction = true)}>
							+ Add
						</Button>
						<Button variant="ghost" size="sm" outline onclick={() => (showDeleteConfirm = true)}>
							Delete
						</Button>
					</div>
				</div>
			</div>

			<!-- Budget Allocation -->
			<Card title="Budget Allocation">
				{#snippet children()}
					<!-- Period income summary (percentage wallets only) -->
					{#if wallet.budget_type !== 'fixed'}
						<div class="flex justify-between items-center mb-5 pb-4 border-b border-base-200">
							<span class="text-xs font-medium text-base-content/40 uppercase tracking-wider">Income · {periodLabel}</span>
							<span class="text-sm font-semibold">{formatCurrency(periodIncome, wallet.currency)}</span>
						</div>
						{#if periodIncome === 0 && selectedPeriod !== 'all-time'}
							<div class="text-xs text-base-content/40 text-center py-2">
								No income this period. Switch to All Time to see full allocation.
							</div>
						{/if}
					{:else}
						<p class="text-xs font-medium text-base-content/40 uppercase tracking-wider mb-5 pb-4 border-b border-base-200">Fixed monthly limits</p>
					{/if}
					<div class="space-y-4">
						{#each wallet.categories as category (category.name)}
							{@const allocated = getCategoryAmount(category)}
							{@const spent = getCategorySpent(category.name)}
							{@const remaining = allocated - spent}
							{@const spentPct = allocated > 0 ? Math.min(100, (spent / allocated) * 100) : 0}
							{@const overBudget = remaining < 0}
							<div class="space-y-1">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<span
											class="w-4 h-4 rounded"
											style="background-color: {category.color};"
										></span>
										<span class="font-medium">{category.name}</span>
										{#if wallet.budget_type !== "fixed"}<span class="text-base-content/60">{category.percentage}%</span>{/if}
										{#if overBudget}
											<span class="badge badge-error badge-sm">Over budget</span>
										{/if}
									</div>
									<span class={['font-semibold', overBudget && 'text-error']}>
										{formatCurrency(Math.abs(remaining), wallet.currency)}
										{overBudget ? 'over' : 'left'}
									</span>
								</div>
								<div class="flex items-center gap-2 pl-6">
									<div class="flex-1 h-1.5 rounded-full bg-base-200 overflow-hidden">
										<div
											class="h-full rounded-full transition-all"
											style="width: {spentPct}%; background-color: {overBudget ? 'var(--color-error)' : category.color}; opacity: 0.7;"
										></div>
									</div>
									{#if wallet.budget_type === 'fixed'}
										<span class="text-xs text-base-content/40 shrink-0">of {formatCurrency(allocated, wallet.currency)}</span>
									{/if}
									<span class="text-xs text-base-content/60 shrink-0">
										{formatCurrency(spent, wallet.currency)} spent
									</span>
								</div>
							</div>
						{/each}
					</div>

					<!-- Visual bar -->
					{@const totalFixed = wallet.categories.reduce((s, c) => s + (c.fixedAmount ?? 0), 0)}
					<div class="flex h-2 rounded-full overflow-hidden bg-base-200 mt-5">
						{#each wallet.categories as category (category.name)}
							{@const barPct = wallet.budget_type === "fixed"
								? (totalFixed > 0 ? ((category.fixedAmount ?? 0) / totalFixed) * 100 : 0)
								: category.percentage}
							<div
								class="h-full"
								style="width: {barPct}%; background-color: {category.color};"
								title="{category.name}: {wallet.budget_type === 'fixed' ? (category.fixedAmount ?? 0) : category.percentage + '%'}"
							></div>
						{/each}
					</div>
				{/snippet}
			</Card>

			<!-- Transactions -->
			<Card title="Transactions">
				{#snippet children()}
					<!-- Period selector -->
					<div class="space-y-2 mb-4">
						<!-- Built-in periods -->
						<div class="flex flex-wrap items-center gap-1">
							{#each BUILTIN_PERIODS as p (p.value)}
								<div class="flex items-center">
									<button
										class={['btn btn-sm', selectedPeriod === p.value ? 'btn-primary' : 'btn-ghost']}
										onclick={() => setPeriod(p.value)}
									>
										{p.label}
									</button>
									<button
										class="btn btn-ghost btn-xs px-1 opacity-50 hover:opacity-100"
										onclick={() => persistPeriodPrefs({ default_period: p.value })}
										disabled={savingPrefs}
										title="{wallet.default_period === p.value ? 'Default period' : 'Set as default'}"
									>
										{wallet.default_period === p.value ? '★' : '☆'}
									</button>
								</div>
							{/each}
							{#if pagedResult.totalItems > 0}
								<button class="btn btn-ghost btn-sm ml-auto" onclick={exportCsv} title="Export as CSV">
									↓ CSV
								</button>
							{/if}
						</div>

						<!-- Saved periods -->
						{#if wallet.saved_periods.length > 0}
							<div class="flex flex-wrap gap-1">
								{#each wallet.saved_periods as sp (sp.name)}
									<div class="flex items-center border border-base-300 rounded-lg overflow-hidden">
										<button
											class={['btn btn-sm btn-ghost rounded-none border-0', selectedPeriod === sp.name && 'btn-active']}
											onclick={() => setPeriod(sp.name)}
										>
											{sp.name}
											<span class="text-xs text-base-content/40 ml-1">{sp.startDate}–{sp.endDate}</span>
										</button>
										<button
											class="btn btn-ghost btn-xs px-1 opacity-50 hover:opacity-100 rounded-none border-0"
											onclick={() => persistPeriodPrefs({ default_period: sp.name })}
											disabled={savingPrefs}
											title="{wallet.default_period === sp.name ? 'Default period' : 'Set as default'}"
										>
											{wallet.default_period === sp.name ? '★' : '☆'}
										</button>
										<button
											class="btn btn-ghost btn-xs px-1 text-error opacity-50 hover:opacity-100 rounded-none border-0"
											onclick={() => handleDeleteSavedPeriod(sp)}
											disabled={savingPrefs}
											title="Remove saved range"
										>
											×
										</button>
									</div>
								{/each}
							</div>
						{/if}

						<!-- Pay cycle day config -->
						{#if selectedPeriod === 'pay-cycle'}
							<div class="flex items-center gap-2 flex-wrap">
								<button
									class="btn btn-ghost btn-sm"
									onclick={() => { cycleOffset--; currentPage = 1; }}
								>&larr;</button>
								<span class="text-sm text-base-content/70 min-w-40 text-center">
									{dateRange.startDate} – {dateRange.endDate}
								</span>
								<button
									class="btn btn-ghost btn-sm"
									onclick={() => { cycleOffset++; currentPage = 1; }}
								>&rarr;</button>
								{#if cycleOffset !== 0}
									<button
										class="btn btn-ghost btn-xs text-base-content/50"
										onclick={() => { cycleOffset = 0; currentPage = 1; }}
									>today</button>
								{/if}
								<input
									type="date"
									class="input input-bordered input-xs w-32 text-xs ml-auto"
									title="Jump to cycle containing this date"
									onchange={(e) => jumpToCycleForDate(e.currentTarget.value)}
								/>
							</div>
							<div class="flex items-center gap-2 text-sm">
								<span class="text-base-content/60 shrink-0">Cycle starts on day</span>
								<input
									type="number"
									class="input input-bordered input-sm w-20"
									min="1"
									max="28"
									value={cycleStartDayInput}
									oninput={(e) => (cycleStartDayInput = Number(e.currentTarget.value))}
									onkeydown={(e) => e.key === 'Enter' && handleSaveCycleDay()}
								/>
								<span class="text-base-content/60 shrink-0">of the month</span>
								{#if cycleStartDayInput !== cycleStartDay}
									<Button variant="primary" onclick={handleSaveCycleDay} disabled={savingPrefs}>
										{savingPrefs ? '…' : 'Save'}
									</Button>
								{/if}
							</div>
						{/if}

						<!-- Date inputs (custom period or named saved period) -->
						{#if showDateInputs}
							<div class="flex items-center gap-2">
								<input
									type="date"
									class="input input-bordered input-sm flex-1"
									value={customStartDate}
									oninput={(e) => { customStartDate = e.currentTarget.value; currentPage = 1; }}
								/>
								<span class="text-base-content/60 text-sm shrink-0">to</span>
								<input
									type="date"
									class="input input-bordered input-sm flex-1"
									value={customEndDate}
									oninput={(e) => { customEndDate = e.currentTarget.value; currentPage = 1; }}
								/>
							</div>

							<!-- Save this range -->
							{#if customStartDate && customEndDate}
								{#if !showSaveRangeInput}
									<button
										class="btn btn-ghost btn-xs"
										onclick={() => (showSaveRangeInput = true)}
									>
										+ Save this range…
									</button>
								{:else}
									<div class="flex items-center gap-2">
										<input
											type="text"
											class="input input-bordered input-sm flex-1"
											placeholder="Range name (e.g. Q1 2026)"
											bind:value={saveRangeName}
											maxlength="100"
										/>
										<Button
											variant="primary"
											onclick={handleSaveRange}
											disabled={!saveRangeName.trim() || savingPrefs}
										>
											{savingPrefs ? '…' : 'Save'}
										</Button>
										<Button
											variant="ghost"
											onclick={() => { showSaveRangeInput = false; saveRangeName = ''; }}
										>
											Cancel
										</Button>
									</div>
								{/if}
							{/if}
						{/if}
					</div>

					<TransactionList
						transactions={pagedResult.items}
						{wallet}
						ondelete={handleDeleteTransaction}
						onedit={handleEditTransaction}
					/>

					<!-- Pagination -->
					{#if pagedResult.totalPages > 1}
						<div class="flex items-center justify-between mt-4 pt-4">
							<span class="text-sm text-base-content/40">{pagedResult.totalItems} transactions</span>
							<div class="join">
								<button class="join-item btn btn-sm" disabled={currentPage === 1} onclick={() => currentPage--}>&larr;</button>
								<button class="join-item btn btn-sm btn-disabled">{currentPage} / {pagedResult.totalPages}</button>
								<button class="join-item btn btn-sm" disabled={currentPage === pagedResult.totalPages} onclick={() => currentPage++}>&rarr;</button>
							</div>
						</div>
					{/if}
				{/snippet}
			</Card>
		</div>

		<!-- Add Transaction Modal -->
		<Modal bind:open={showAddTransaction} title="Add Transaction">
			{#snippet children()}
				<TransactionForm
					{wallet}
					onSuccess={() => {
						showAddTransaction = false;
						refreshPagedQuery();
					}}
				/>
			{/snippet}
		</Modal>

		<!-- Delete Wallet Confirmation Modal -->
		<Modal
			bind:open={showDeleteConfirm}
			title="Delete Wallet?"
			onclose={() => (deleteConfirmName = '')}
		>
			{#snippet children()}
				<p class="text-base-content/70 mb-4">
					This will permanently delete <strong>{wallet.name}</strong> and all its transactions.
					This cannot be undone.
				</p>
				<label class="form-control w-full">
					<div class="label">
						<span class="label-text text-sm">Type <strong>{wallet.name}</strong> to confirm</span>
					</div>
					<input
						type="text"
						class="input input-bordered w-full"
						placeholder={wallet.name}
						bind:value={deleteConfirmName}
					/>
				</label>
			{/snippet}
			{#snippet actions()}
				<Button variant="ghost" onclick={() => { showDeleteConfirm = false; deleteConfirmName = ''; }}>
					Cancel
				</Button>
				<Button variant="error" onclick={handleDeleteWallet} disabled={deleteConfirmName !== wallet.name}>
					Delete Wallet
				</Button>
			{/snippet}
		</Modal>

		<!-- Delete Transaction Confirmation Modal -->
		<Modal
			open={!!transactionToDelete}
			title="Delete Transaction?"
			onclose={() => (transactionToDelete = null)}
		>
			{#snippet children()}
				<p class="text-base-content/70">
					Are you sure you want to delete this transaction? This will reverse its effect on your
					wallet balance.
				</p>
			{/snippet}
			{#snippet actions()}
				<Button variant="ghost" onclick={() => (transactionToDelete = null)}>Cancel</Button>
				<Button variant="error" onclick={confirmDeleteTransaction}>Delete Transaction</Button>
			{/snippet}
		</Modal>
		<!-- Edit Transaction Modal -->
		<Modal
			open={!!transactionToEdit}
			title="Edit Transaction"
			onclose={() => (transactionToEdit = null)}
		>
			{#snippet children()}
				{#if transactionToEdit}
					<EditTransactionForm
						transaction={transactionToEdit}
						{wallet}
						onSuccess={() => {
							transactionToEdit = null;
							refreshPagedQuery();
						}}
						onCancel={() => (transactionToEdit = null)}
					/>
				{/if}
			{/snippet}
		</Modal>
	{/snippet}
</AuthGuard>
