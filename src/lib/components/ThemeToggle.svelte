<script lang="ts">
	import type { ClassValue } from 'svelte/elements';
	import { theme } from '$lib/stores/theme.svelte';
	import Icon from './Icon.svelte';

	let { class: className }: { class?: ClassValue } = $props();
</script>

<!-- The icon is switched in CSS from <html data-theme>, which is set before hydration;
     the server can't know the theme, so rendering it from state would mismatch -->
<button
	type="button"
	class={['btn btn-circle btn-ghost btn-sm', className]}
	onclick={() => theme.toggle()}
	aria-label="Toggle dark theme"
	title="Toggle dark theme"
>
	<Icon name="moon" class="size-[18px] in-data-[theme=dark]:hidden" />
	<Icon name="sun" class="hidden size-[18px] in-data-[theme=dark]:block" />
</button>
