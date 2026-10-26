<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue, HTMLSelectAttributes } from 'svelte/elements';

	interface Props extends HTMLSelectAttributes {
		label?: string;
		error?: string;
		options?: readonly { value: string; label: string }[];
		children?: Snippet;
		class?: ClassValue;
	}

	let {
		label,
		error,
		options = [],
		value = $bindable(),
		class: className,
		children,
		...rest
	}: Props = $props();
</script>

<label class="flex w-full flex-col gap-1.5">
	{#if label}
		<span class="text-sm font-medium text-base-content/80">{label}</span>
	{/if}
	<select class={['select w-full', error && 'select-error', className]} bind:value {...rest}>
		{#if children}
			{@render children()}
		{:else}
			{#each options as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		{/if}
	</select>
	{#if error}
		<span class="text-xs text-error">{error}</span>
	{/if}
</label>
