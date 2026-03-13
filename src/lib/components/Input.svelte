<script lang="ts">
	import type { ClassValue, HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {
		label?: string;
		error?: string;
		hint?: string;
		class?: ClassValue;
	}

	let {
		label,
		error,
		hint,
		value = $bindable(),
		class: className,
		...rest
	}: Props = $props();
</script>

<div class="form-control w-full">
	{#if label}
		<div class="label">
			<span class="label-text">{label}</span>
		</div>
	{/if}
	<input
		class={['input input-bordered w-full', error && 'input-error', className]}
		bind:value
		{...rest}
	/>
	{#if error}
		<div class="label">
			<span class="label-text-alt text-error">{error}</span>
		</div>
	{:else if hint}
		<div class="label">
			<span class="label-text-alt">{hint}</span>
		</div>
	{/if}
</div>
