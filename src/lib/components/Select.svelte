<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLSelectAttributes } from 'svelte/elements';

	interface Props extends HTMLSelectAttributes {
		label?: string;
		error?: string;
		options?: { value: string; label: string }[];
		children?: Snippet;
	}

	let {
		label,
		error,
		options = [],
		value = $bindable(),
		class: className = '',
		children,
		...rest
	}: Props = $props();
</script>

<div class="form-control w-full">
	{#if label}
		<label class="label">
			<span class="label-text">{label}</span>
		</label>
	{/if}
	<select
		class="select select-bordered w-full {error ? 'select-error' : ''} {className}"
		bind:value
		{...rest}
	>
		{#if children}
			{@render children()}
		{:else}
			{#each options as option}
				<option value={option.value}>{option.label}</option>
			{/each}
		{/if}
	</select>
	{#if error}
		<label class="label">
			<span class="label-text-alt text-error">{error}</span>
		</label>
	{/if}
</div>
