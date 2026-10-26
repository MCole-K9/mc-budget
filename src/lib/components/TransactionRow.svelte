<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Transaction } from '$lib/types/budget';
	import Icon from './Icon.svelte';
	import { formatSignedCurrency } from '$lib/utils/format';

	/** The transaction fields a row displays; list items from every query carry these */
	type RowTransaction = Pick<
		Transaction,
		'description' | 'category' | 'amount' | 'recurring' | 'transfer_id' | 'balance_adjustment'
	>;

	interface Props {
		transaction: RowTransaction;
		currency: string;
		/** Category color (hex); income rows use the success color */
		color?: string | null;
		/** Extra text after the category, e.g. the wallet name */
		meta?: Snippet;
		/** Resolved path; makes the whole row a link (don't combine with actions) */
		href?: string;
		actions?: Snippet;
	}

	let { transaction, currency, color, meta, href, actions }: Props = $props();

	const title = $derived(transaction.description || transaction.category);
	const isIncome = $derived(transaction.amount > 0);
	const isExpense = $derived(transaction.amount < 0);
	const tint = $derived(color ?? '#9ca3af');
	const rowClass = 'group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-base-200/50';
</script>

{#snippet body()}
	<span
		class="grid size-9 shrink-0 place-items-center rounded-xl text-sm font-semibold"
		style:background-color={isIncome
			? 'color-mix(in oklab, var(--color-success) 14%, transparent)'
			: `color-mix(in oklab, ${tint} 16%, transparent)`}
		style:color={isIncome ? 'var(--color-success)' : tint}
	>
		{#if transaction.transfer_id}
			<Icon name="transfer" class="size-4" label="Transfer" />
		{:else if transaction.balance_adjustment}
			<Icon name="scale" class="size-4" label="Balance adjustment" />
		{:else if isIncome}
			<Icon name="trending-up" class="size-4" />
		{:else}
			{(transaction.category || title || '?').charAt(0).toUpperCase()}
		{/if}
	</span>

	<div class="min-w-0 flex-1">
		<p class="flex items-center gap-1.5 text-sm leading-snug font-medium">
			<span class="truncate">{title}</span>
			{#if transaction.recurring}
				<span class="text-base-content/40" title="Recurring monthly">
					<Icon name="repeat" class="size-3.5" label="Recurring" />
				</span>
			{/if}
		</p>
		<p class="truncate text-xs text-base-content/50">
			{transaction.category}{#if meta}<span class="mx-1">·</span>{@render meta()}{/if}
		</p>
	</div>

	<span
		class={[
			'shrink-0 text-sm font-semibold tabular-nums',
			isIncome && 'text-success',
			isExpense && 'text-error'
		]}
	>
		{formatSignedCurrency(transaction.amount, currency)}
	</span>

	{#if actions}
		<div class="flex shrink-0 items-center gap-0.5">
			{@render actions()}
		</div>
	{/if}
{/snippet}

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass resolved paths -->
	<a {href} class={rowClass}>{@render body()}</a>
{:else}
	<div class={rowClass}>{@render body()}</div>
{/if}
