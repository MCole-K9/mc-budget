<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		title?: string;
		class?: string;
		children: Snippet;
		actions?: Snippet;
		onclose?: () => void;
	}

	let { open = $bindable(), title, class: className = '', children, actions, onclose }: Props = $props();

	function handleClose() {
		open = false;
		onclose?.();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			handleClose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="modal modal-open" onclick={handleBackdropClick}>
		<div class="modal-box {className}">
			{#if title}
				<h3 class="font-bold text-lg">{title}</h3>
			{/if}
			<button
				class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
				onclick={handleClose}
			>
				✕
			</button>
			<div class="py-4">
				{@render children()}
			</div>
			{#if actions}
				<div class="modal-action">
					{@render actions()}
				</div>
			{/if}
		</div>
	</div>
{/if}
