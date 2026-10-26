<script lang="ts">
	import type { ClassValue } from 'svelte/elements';

	interface Option {
		value: string;
		label: string;
		/** Text color for this option when selected (defaults to base content) */
		activeClass?: string;
	}

	interface Props {
		options: Option[];
		value: string;
		onchange: (value: string) => void;
		/** Stretch options to equal widths across the full width */
		fill?: boolean;
		/** Accessible name for the group */
		label?: string;
		class?: ClassValue;
	}

	let { options, value, onchange, fill = false, label, class: className }: Props = $props();
</script>

<div
	class={[
		'gap-1 rounded-field bg-base-200 p-1',
		fill ? 'grid auto-cols-fr grid-flow-col' : 'inline-flex',
		className
	]}
	role="radiogroup"
	aria-label={label}
>
	{#each options as option (option.value)}
		{@const selected = value === option.value}
		<button
			type="button"
			role="radio"
			aria-checked={selected}
			class={[
				'rounded-[calc(var(--radius-field)-2px)] px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
				selected
					? ['bg-base-100 shadow-sm', option.activeClass ?? 'text-base-content']
					: 'text-base-content/55 hover:text-base-content'
			]}
			onclick={() => onchange(option.value)}
		>
			{option.label}
		</button>
	{/each}
</div>
