<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getWallets, getArchivedWallets } from '$lib/wallets.remote';
	import AuthGuard from '$lib/components/AuthGuard.svelte';
	import WalletCard from '$lib/components/WalletCard.svelte';
	import Button from '$lib/components/Button.svelte';

	const wallets = $derived(await getWallets());

	let showArchived = $state(false);
</script>

<svelte:head>
	<title>My Wallets - MC Budget</title>
</svelte:head>

<AuthGuard>
	{#snippet children()}
		<div class="max-w-4xl mx-auto">
			<div class="flex justify-between items-center mb-6">
				<h1 class="text-2xl font-bold">My Wallets</h1>
				<a href={resolve('/wallets/new')}>
					<Button variant="primary">Create Wallet</Button>
				</a>
			</div>

			{#if wallets.length === 0}
				<div class="text-center py-12">
					<p class="text-base-content/70 mb-4">You don't have any wallets yet</p>
					<a href={resolve('/wallets/new')}>
						<Button variant="primary">Create Your First Wallet</Button>
					</a>
				</div>
			{:else}
				<div class="grid gap-4 md:grid-cols-2">
					{#each wallets as wallet (wallet.id)}
						<WalletCard {wallet} onclick={() => goto(resolve('/wallets/[id]', { id: wallet.id }))} />
					{/each}
				</div>
			{/if}

			<!-- Archived wallets -->
			<div class="mt-8">
				<button
					class="flex items-center gap-2 text-sm text-base-content/40 hover:text-base-content/70 transition-colors"
					onclick={() => (showArchived = !showArchived)}
				>
					<span>{showArchived ? '▾' : '▸'}</span>
					<span>Archived wallets</span>
				</button>

				{#if showArchived}
					<svelte:boundary>
						{@const archived = await getArchivedWallets()}
						{#if archived.length === 0}
							<p class="text-sm text-base-content/30 mt-3 pl-4">No archived wallets.</p>
						{:else}
							<div class="grid gap-4 md:grid-cols-2 mt-3 opacity-60">
								{#each archived as wallet (wallet.id)}
									<WalletCard
										{wallet}
										onclick={() => goto(resolve('/wallets/[id]', { id: wallet.id }))}
									/>
								{/each}
							</div>
						{/if}
						{#snippet pending()}
							<span class="loading loading-spinner loading-sm mt-3 ml-4"></span>
						{/snippet}
					</svelte:boundary>
				{/if}
			</div>
		</div>
	{/snippet}
</AuthGuard>
