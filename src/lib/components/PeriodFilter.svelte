<script lang="ts">
	import type { Snippet } from 'svelte';
	import SegmentedControl from './SegmentedControl.svelte';

	interface Props {
		periods: { value: string; label: string }[];
		/** Selected period; a value not in `periods` leaves every tab unselected */
		value: string;
		onselect: (value: string) => void;
		startDate: string;
		endDate: string;
		ondateschange: (range: { startDate: string; endDate: string }) => void;
		/** Show the start/end date inputs (defaults to the 'custom' period) */
		showDates?: boolean;
		/** Controls beside the period tabs */
		actions?: Snippet;
		/** Content between the tabs and the date inputs */
		children?: Snippet;
	}

	let {
		periods,
		value,
		onselect,
		startDate,
		endDate,
		ondateschange,
		showDates,
		actions,
		children
	}: Props = $props();

	// Not a prop default: defaults are computed once and wouldn't follow `value`
	const datesVisible = $derived(showDates ?? value === 'custom');
</script>

<div class="space-y-3">
	<div class="flex flex-wrap items-center gap-2">
		<!-- Scrolls horizontally on narrow screens instead of wrapping onto several lines -->
		<div class="-mx-1 max-w-full overflow-x-auto px-1 [scrollbar-width:none]">
			<SegmentedControl label="Period" options={periods} {value} onchange={onselect} />
		</div>
		{@render actions?.()}
	</div>

	{@render children?.()}

	{#if datesVisible}
		<div class="max-w-xl surface p-3">
			<div class="flex items-center gap-2">
				<input
					type="date"
					class="input input-sm min-w-0 flex-1"
					aria-label="Start date"
					value={startDate}
					oninput={(e) => ondateschange({ startDate: e.currentTarget.value, endDate })}
				/>
				<span class="shrink-0 text-sm text-base-content/50">to</span>
				<input
					type="date"
					class="input input-sm min-w-0 flex-1"
					aria-label="End date"
					value={endDate}
					oninput={(e) => ondateschange({ startDate, endDate: e.currentTarget.value })}
				/>
			</div>
		</div>
	{/if}
</div>
