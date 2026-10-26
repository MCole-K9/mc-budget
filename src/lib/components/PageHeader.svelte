<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	interface Props {
		title: string;
		subtitle?: string;
		/** Resolved path for a back link above the title */
		backHref?: string;
		backLabel?: string;
		/** Content after the title, e.g. a badge */
		badge?: Snippet;
		actions?: Snippet;
	}

	let { title, subtitle, backHref, backLabel = 'Back', badge, actions }: Props = $props();
</script>

<header class="mb-6">
	{#if backHref}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass resolved paths -->
		<a
			href={backHref}
			class="mb-3 inline-flex items-center gap-1 text-sm font-medium text-base-content/55 transition-colors hover:text-base-content"
		>
			<Icon name="arrow-left" class="size-4" />
			{backLabel}
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{/if}
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div class="min-w-0">
			<div class="flex items-center gap-2">
				<h1 class="truncate text-2xl font-bold tracking-tight sm:text-[1.75rem]">{title}</h1>
				{@render badge?.()}
			</div>
			{#if subtitle}
				<p class="mt-1 text-sm text-base-content/55">{subtitle}</p>
			{/if}
		</div>
		{#if actions}
			<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>
		{/if}
	</div>
</header>
