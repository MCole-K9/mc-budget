<script lang="ts">
	import { resolve } from '$app/paths';
	import { getWallets, getArchivedWallets } from '$lib/wallets.remote';
	import AuthGuard from '$lib/components/AuthGuard.svelte';
	import WalletCard from '$lib/components/WalletCard.svelte';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Icon from '$lib/components/Icon.svelte';

	const wallets = $derived(await getWallets());

	let showArchived = $state(false);
</script>

<svelte:head>
	<title>Wallets - MC Budget</title>
</svelte:head>

<AuthGuard>
	<PageHeader title="Wallets" subtitle="Each wallet has its own balance and budget split.">
		{#snippet actions()}
			<Button href={resolve('/wallets/new')} icon="plus" size="sm">New wallet</Button>
		{/snippet}
	</PageHeader>

	{#if wallets.length === 0}
		<EmptyState
			icon="wallet"
			title="No wallets yet"
			description="Create a wallet to start tracking a balance against a budget."
		>
			{#snippet action()}
				<Button href={resolve('/wallets/new')} icon="plus">Create your first wallet</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each wallets as wallet (wallet.id)}
				<WalletCard {wallet} />
			{/each}
			<a
				href={resolve('/wallets/new')}
				class="flex min-h-48 flex-col items-center justify-center gap-2 rounded-box border-2 border-dashed border-base-300 text-sm font-medium text-base-content/50 transition-colors hover:border-primary/40 hover:text-primary"
			>
				<Icon name="plus" class="size-6" />
				New wallet
			</a>
		</div>
	{/if}

	<!-- Archived wallets -->
	<div class="mt-10">
		<button
			class="flex items-center gap-2 text-sm font-medium text-base-content/55 transition-colors hover:text-base-content"
			onclick={() => (showArchived = !showArchived)}
			aria-expanded={showArchived}
		>
			<Icon
				name="chevron-right"
				class={['size-4 transition-transform', showArchived && 'rotate-90']}
			/>
			<Icon name="archive" class="size-4" />
			Archived wallets
		</button>

		{#if showArchived}
			<svelte:boundary>
				{@const archived = await getArchivedWallets()}
				{#if archived.length === 0}
					<p class="mt-3 pl-6 text-sm text-base-content/45">No archived wallets.</p>
				{:else}
					<div class="mt-4 grid grid-cols-1 gap-4 opacity-70 sm:grid-cols-2 lg:grid-cols-3">
						{#each archived as wallet (wallet.id)}
							<WalletCard {wallet} />
						{/each}
					</div>
				{/if}
				{#snippet pending()}
					<span class="loading mt-3 ml-6 loading-sm loading-spinner"></span>
				{/snippet}
			</svelte:boundary>
		{/if}
	</div>
</AuthGuard>
