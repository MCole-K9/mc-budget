<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/stores/auth.svelte';

	interface Props {
		children: Snippet;
		fallback?: Snippet;
		redirectTo?: string;
	}

	let { children, fallback, redirectTo = resolve('/auth/login') }: Props = $props();

	$effect(() => {
		if (!auth.isLoading && !auth.isAuthenticated) {
			goto(redirectTo);
		}
	});
</script>

{#if auth.isLoading}
	<div class="grid min-h-[50vh] place-items-center" role="status" aria-label="Loading">
		<span class="loading loading-lg loading-spinner text-primary"></span>
	</div>
{:else if auth.isAuthenticated}
	{@render children()}
{:else if fallback}
	{@render fallback()}
{/if}
