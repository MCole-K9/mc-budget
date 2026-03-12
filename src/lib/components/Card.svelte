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
		bordered = true,
		class: className,
		children,
		actions
	}: Props = $props();
</script>

<div
	class={['card bg-base-100 shadow-sm', bordered && 'border border-base-300', className]}
>
	<div class={['card-body', compact && 'p-4']}>
		{#if title}
			<h2 class="card-title">{title}</h2>
		{/if}
		{@render children()}
		{#if actions}
			<div class="card-actions justify-end mt-4">
				{@render actions()}
			</div>
		{/if}
	</div>
</div>
