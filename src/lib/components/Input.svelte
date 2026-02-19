<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {
		label?: string;
		error?: string;
		hint?: string;
	}

	let {
		label,
		error,
		hint,
		value = $bindable(),
		class: className = '',
		...rest
	}: Props = $props();
</script>

<div class="form-control w-full">
	{#if label}
		<label class="label">
			<span class="label-text">{label}</span>
		</label>
	{/if}
	<input
		class="input input-bordered w-full {error ? 'input-error' : ''} {className}"
		bind:value
		{...rest}
	/>
	{#if error}
		<label class="label">
			<span class="label-text-alt text-error">{error}</span>
		</label>
	{:else if hint}
		<label class="label">
			<span class="label-text-alt">{hint}</span>
		</label>
	{/if}
</div>
