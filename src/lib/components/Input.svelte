<script lang="ts">
	import type { ClassValue, HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {
		label?: string;
		error?: string;
		hint?: string;
		class?: ClassValue;
	}

	let { label, error, hint, value = $bindable(), class: className, ...rest }: Props = $props();
</script>

<label class="flex w-full flex-col gap-1.5">
	{#if label}
		<span class="text-sm font-medium text-base-content/80">{label}</span>
	{/if}
	<input class={['input w-full', error && 'input-error', className]} bind:value {...rest} />
	{#if error}
		<span class="text-xs text-error">{error}</span>
	{:else if hint}
		<span class="text-xs text-base-content/50">{hint}</span>
	{/if}
</label>
