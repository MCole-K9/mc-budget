<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	interface Props {
		title?: string;
		/** Small text under the title */
		subtitle?: string;
		compact?: boolean;
		bordered?: boolean;
		class?: ClassValue;
		children: Snippet;
		/** Controls shown at the right of the title row */
		header?: Snippet;
		actions?: Snippet;
	}

	let {
		title,
		subtitle,
		compact = false,
		bordered = false,
		class: className,
		children,
		header,
		actions
	}: Props = $props();
</script>

<div class={['overflow-hidden surface', bordered && 'ring-1 ring-base-300', className]}>
	<div class={compact ? 'p-4' : 'p-5 sm:p-6'}>
		{#if title || header}
			<div class="mb-4 flex items-start justify-between gap-3">
				<div class="min-w-0">
					{#if title}
						<h2 class="text-base font-semibold">{title}</h2>
					{/if}
					{#if subtitle}
						<p class="mt-0.5 text-sm text-base-content/55">{subtitle}</p>
					{/if}
				</div>
				{#if header}
					<div class="flex shrink-0 items-center gap-1">{@render header()}</div>
				{/if}
			</div>
		{/if}
		{@render children()}
		{#if actions}
			<div class="mt-5 flex justify-end gap-2">
				{@render actions()}
			</div>
		{/if}
	</div>
</div>
