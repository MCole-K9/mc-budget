<script lang="ts">
	import { formatCurrency, formatSignedCurrency } from '$lib/utils/format';
	import StatCard from './StatCard.svelte';

	interface Props {
		income: number;
		expense: number;
		currency: string;
		/** Added after each label, e.g. a currency code */
		labelSuffix?: string;
		/** Secondary styling, e.g. for converted totals */
		muted?: boolean;
	}

	let { income, expense, currency, labelSuffix = '', muted = false }: Props = $props();

	const net = $derived(income - expense);
	const suffix = $derived(labelSuffix ? ` · ${labelSuffix}` : '');
</script>

<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
	<StatCard
		{muted}
		label="Income{suffix}"
		value={formatCurrency(income, currency)}
		tone="success"
		icon={muted ? undefined : 'trending-up'}
	/>
	<StatCard
		{muted}
		label="Expenses{suffix}"
		value={formatCurrency(expense, currency)}
		tone="error"
		icon={muted ? undefined : 'trending-down'}
	/>
	<StatCard
		{muted}
		class="col-span-2 sm:col-span-1"
		label="Net{suffix}"
		value={formatSignedCurrency(net, currency)}
		tone={net > 0 ? 'success' : net < 0 ? 'error' : 'neutral'}
		icon={muted ? undefined : 'scale'}
	/>
</div>
