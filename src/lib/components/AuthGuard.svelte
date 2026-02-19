<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth.svelte';

	interface Props {
		children: Snippet;
		fallback?: Snippet;
		redirectTo?: string;
	}

	let { children, fallback, redirectTo = '/auth/login' }: Props = $props();

	$effect(() => {
		if (!auth.isLoading && !auth.isAuthenticated) {
			goto(redirectTo);
		}
	});
</script>

{#if auth.isLoading}
	<div class="flex justify-center items-center min-h-[200px]">
		<span class="loading loading-spinner loading-lg"></span>
	</div>
{:else if auth.isAuthenticated}
	{@render children()}
{:else if fallback}
	{@render fallback()}
{/if}
