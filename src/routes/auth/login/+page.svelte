<script lang="ts">
	import { goto } from '$app/navigation';
	import { login } from '$lib/api/auth';
	import { auth } from '$lib/stores/auth.svelte';
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Alert from '$lib/components/Alert.svelte';

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;

		try {
			const user = await login({ email, password });
			auth.setUser(user);
			await goto('/wallets');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Login failed';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Login - MC Budget</title>
</svelte:head>

<div class="max-w-md mx-auto">
	<Card title="Sign In">
		{#snippet children()}
			{#if error}
				<Alert type="error" dismissible ondismiss={() => (error = '')}>
					{#snippet children()}{error}{/snippet}
				</Alert>
			{/if}

			<form onsubmit={handleSubmit} class="space-y-4 mt-4">
				<Input
					type="email"
					label="Email"
					bind:value={email}
					placeholder="you@example.com"
					required
				/>

				<Input
					type="password"
					label="Password"
					bind:value={password}
					placeholder="Enter your password"
					required
				/>

				<Button type="submit" variant="primary" class="w-full" {loading}>
					Sign In
				</Button>
			</form>

			<p class="text-center mt-4 text-sm text-base-content/70">
				Don't have an account?
				<a href="/auth/register" class="link link-primary">Sign up</a>
			</p>
		{/snippet}
	</Card>
</div>
