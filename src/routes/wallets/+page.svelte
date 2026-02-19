<script lang="ts">
	import { goto } from '$app/navigation';
	import { getWallets } from '$lib/wallets.remote';
	import AuthGuard from '$lib/components/AuthGuard.svelte';
	import WalletCard from '$lib/components/WalletCard.svelte';
	import Button from '$lib/components/Button.svelte';
	import Alert from '$lib/components/Alert.svelte';

	// Using experimental async - data loads automatically
	const walletsPromise = getWallets();
</script>

<svelte:head>
	<title>My Wallets - MC Budget</title>
</svelte:head>

<AuthGuard>
	{#snippet children()}
		<div class="max-w-4xl mx-auto">
			<div class="flex justify-between items-center mb-6">
				<h1 class="text-3xl font-bold">My Wallets</h1>
				<a href="/wallets/new">
					<Button variant="primary">Create Wallet</Button>
				</a>
			</div>

			{#await walletsPromise}
				<div class="flex justify-center py-12">
					<span class="loading loading-spinner loading-lg"></span>
				</div>
			{:then wallets}
				{#if wallets.length === 0}
					<div class="text-center py-12">
						<p class="text-base-content/70 mb-4">You don't have any wallets yet</p>
						<a href="/wallets/new">
							<Button variant="primary">Create Your First Wallet</Button>
						</a>
					</div>
				{:else}
					<div class="grid gap-4 md:grid-cols-2">
						{#each wallets as wallet}
							<WalletCard {wallet} onclick={() => goto(`/wallets/${wallet.id}`)} />
						{/each}
					</div>
				{/if}
			{:catch error}
				<Alert type="error">
					{#snippet children()}{error.message}{/snippet}
				</Alert>
			{/await}
		</div>
	{/snippet}
</AuthGuard>
