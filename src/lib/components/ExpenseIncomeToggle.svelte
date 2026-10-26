<script lang="ts">
	import SegmentedControl from './SegmentedControl.svelte';

	interface Props {
		isExpense: boolean;
	}

	let { isExpense = $bindable() }: Props = $props();

	const options = [
		{ value: 'expense', label: 'Expense', activeClass: 'text-error' },
		{ value: 'income', label: 'Income', activeClass: 'text-success' }
	];
</script>

<SegmentedControl
	fill
	label="Transaction type"
	{options}
	value={isExpense ? 'expense' : 'income'}
	onchange={(v) => (isExpense = v === 'expense')}
	class="[&>button]:py-2"
/>
