<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';
	import Icon, { type IconName } from './Icon.svelte';

	interface Props {
		icon?: IconName;
		title: string;
		description?: string;
		/** Render without the card surface (e.g. inside an existing card) */
		plain?: boolean;
		class?: ClassValue;
		action?: Snippet;
	}

	let {
		icon = 'inbox',
		title,
		description,
		plain = false,
		class: className,
		action
	}: Props = $props();
</script>

<div class={['flex flex-col items-center px-6 py-12 text-center', !plain && 'surface', className]}>
	<span class="mb-3 grid size-12 place-items-center rounded-2xl bg-base-200 text-base-content/45">
		<Icon name={icon} class="size-6" />
	</span>
	<p class="font-medium">{title}</p>
	{#if description}
		<p class="mt-1 max-w-sm text-sm text-base-content/55">{description}</p>
	{/if}
	{#if action}
		<div class="mt-5">{@render action()}</div>
	{/if}
</div>
