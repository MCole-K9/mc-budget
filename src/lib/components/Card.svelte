<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	interface Props {
		title?: string;
		compact?: boolean;
		bordered?: boolean;
		class?: ClassValue;
		children: Snippet;
		actions?: Snippet;
	}

	let {
		title,
		compact = false,
		bordered = false,
		class: className,
		children,
		actions
	}: Props = $props();
</script>

<div class={['rounded-2xl bg-base-100 shadow-sm overflow-hidden', bordered && 'ring-1 ring-base-200', className]}>
	<div class={compact ? 'p-4' : 'p-6'}>
		{#if title}
			<p class="text-xs font-semibold text-base-content/40 uppercase tracking-wider mb-4">{title}</p>
		{/if}
		{@render children()}
		{#if actions}
			<div class="flex justify-end gap-2 mt-4">
				{@render actions()}
			</div>
		{/if}
	</div>
</div>
