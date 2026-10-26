<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';
	import Icon from './Icon.svelte';

	interface Props {
		open: boolean;
		title?: string;
		/** Small text under the title */
		description?: string;
		class?: ClassValue;
		children: Snippet;
		actions?: Snippet;
		onclose?: () => void;
	}

	let {
		open = $bindable(),
		title,
		description,
		class: className,
		children,
		actions,
		onclose
	}: Props = $props();

	const uid = $props.id();
	const titleId = `modal-title-${uid}`;

	function handleClose() {
		open = false;
		onclose?.();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') {
			handleClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div class="modal-open modal modal-bottom sm:modal-middle" role="presentation">
		<div
			class={['modal-box max-h-[90dvh] sm:max-w-lg', className]}
			role="dialog"
			aria-modal="true"
			aria-labelledby={title ? titleId : undefined}
		>
			<div class="mb-4 flex items-start justify-between gap-4">
				<div>
					{#if title}
						<h3 id={titleId} class="text-lg font-semibold">{title}</h3>
					{/if}
					{#if description}
						<p class="mt-0.5 text-sm text-base-content/55">{description}</p>
					{/if}
				</div>
				<button
					class="btn -mt-1 -mr-2 btn-circle btn-ghost btn-sm"
					onclick={handleClose}
					aria-label="Close"
				>
					<Icon name="x" class="size-4" />
				</button>
			</div>
			<div>
				{@render children()}
			</div>
			{#if actions}
				<div class="modal-action">
					{@render actions()}
				</div>
			{/if}
		</div>
		<button class="modal-backdrop" aria-label="Close dialog" tabindex="-1" onclick={handleClose}
			>Close</button
		>
	</div>
{/if}
