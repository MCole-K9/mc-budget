<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
</script>

<div class="max-w-4xl mx-auto">
	{#if auth.isAuthenticated}
		<div class="text-center mb-8">
			<h1 class="text-4xl font-bold mb-2">Welcome back, {auth.user?.name}!</h1>
			<p class="text-base-content/70">Manage your budgets and track your spending</p>
		</div>

		<div class="grid gap-6 md:grid-cols-2">
			<a href="/wallets">
				<Card class="h-full hover:shadow-lg transition-shadow">
					{#snippet children()}
						<h2 class="text-2xl font-semibold mb-2">My Wallets</h2>
						<p class="text-base-content/70">View and manage your wallets and transactions</p>
					{/snippet}
				</Card>
			</a>

			<a href="/wallets/new">
				<Card class="h-full hover:shadow-lg transition-shadow">
					{#snippet children()}
						<h2 class="text-2xl font-semibold mb-2">Create Wallet</h2>
						<p class="text-base-content/70">Set up a new wallet with a budget template</p>
					{/snippet}
				</Card>
			</a>

			<a href="/presets">
				<Card class="h-full hover:shadow-lg transition-shadow">
					{#snippet children()}
						<h2 class="text-2xl font-semibold mb-2">Budget Presets</h2>
						<p class="text-base-content/70">Browse budget templates like 50/30/20 and more</p>
					{/snippet}
				</Card>
			</a>
		</div>
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
						<a href="/auth/register">
							<Button variant="primary" size="lg">Get Started</Button>
						</a>
						<a href="/auth/login">
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
