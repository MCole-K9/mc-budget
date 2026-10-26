<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';
	import Icon, { type IconName } from './Icon.svelte';

	interface Props {
		type?: 'info' | 'success' | 'warning' | 'error';
		dismissible?: boolean;
		class?: ClassValue;
		children: Snippet;
		ondismiss?: () => void;
	}

	let {
		type = 'info',
		dismissible = false,
		class: className,
		children,
		ondismiss
	}: Props = $props();

	let visible = $state(true);

	const alertClasses = {
		info: 'alert-info',
		success: 'alert-success',
		warning: 'alert-warning',
		error: 'alert-error'
	} as const;

	const icons: Record<string, IconName> = {
		info: 'info',
		success: 'circle-check',
		warning: 'alert',
		error: 'circle-x'
	};

	function handleDismiss() {
		visible = false;
		ondismiss?.();
	}
</script>

{#if visible}
	<div class={['alert alert-soft text-sm', alertClasses[type], className]} role="alert">
		<Icon name={icons[type]} class="size-5" />
		<span class="flex-1">{@render children()}</span>
		{#if dismissible}
			<button class="btn btn-circle btn-ghost btn-xs" onclick={handleDismiss} aria-label="Dismiss">
				<Icon name="x" class="size-4" />
			</button>
		{/if}
	</div>
{/if}
