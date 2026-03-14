<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { getWallets } from '$lib/wallets.remote';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import WalletCard from '$lib/components/WalletCard.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	const wallets = $derived(auth.isAuthenticated ? await getWallets() : []);
</script>

<div class="max-w-4xl mx-auto">
	{#if auth.isAuthenticated}
		<div class="flex justify-between items-center mb-6">
			<div>
				<h1 class="text-2xl font-bold">Welcome back, {auth.user?.name}!</h1>
				<p class="text-base-content/70 mt-1">Here's your financial overview</p>
			</div>
			<div class="flex gap-2">
				<a href={resolve('/wallets/new')}>
					<Button variant="primary">New Wallet</Button>
				</a>
				<a href={resolve('/presets')}>
					<Button variant="ghost">Presets</Button>
				</a>
			</div>
		</div>

		{#if wallets.length === 0}
			<div class="text-center py-16">
				<p class="text-base-content/70 mb-4 text-lg">No wallets yet — create one to get started</p>
				<a href={resolve('/wallets/new')}>
					<Button variant="primary" size="lg">Create Your First Wallet</Button>
				</a>
			</div>
		{:else}
			<div class="grid gap-4 md:grid-cols-2">
				{#each wallets as wallet (wallet.id)}
					<WalletCard {wallet} onclick={() => goto(resolve('/wallets/[id]', { id: wallet.id }))} />
				{/each}
			</div>
			<div class="mt-4 text-right">
				<a href={resolve('/wallets')} class="link link-primary text-sm">View all wallets &rarr;</a>
			</div>
		{/if}
	{:else}
		<div class="hero min-h-[60vh]">
			<div class="hero-content text-center">
				<div class="max-w-md">
					<h1 class="text-5xl font-bold">MC Budget</h1>
					<p class="py-6 text-lg text-base-content/70">
						Take control of your finances with smart budget management. Create wallets,
						choose from proven budget templates, and track every transaction.
					</p>
					<div class="flex gap-4 justify-center">
						<a href={resolve('/auth/register')}>
							<Button variant="primary" size="lg">Get Started</Button>
						</a>
						<a href={resolve('/auth/login')}>
							<Button variant="ghost" size="lg">Sign In</Button>
						</a>
					</div>

					<div class="mt-12 grid gap-4 text-left">
						<Card compact>
							{#snippet children()}
								<h3 class="font-semibold">50/30/20 Rule</h3>
								<p class="text-sm text-base-content/70">
									Allocate 50% to needs, 30% to wants, 20% to savings
								</p>
							{/snippet}
						</Card>
						<Card compact>
							{#snippet children()}
								<h3 class="font-semibold">Zero-Based Budget</h3>
								<p class="text-sm text-base-content/70">
									Every dollar has a purpose with detailed categories
								</p>
							{/snippet}
						</Card>
						<Card compact>
							{#snippet children()}
								<h3 class="font-semibold">Envelope System</h3>
								<p class="text-sm text-base-content/70">
									Simple three-envelope approach for easy management
								</p>
							{/snippet}
						</Card>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
