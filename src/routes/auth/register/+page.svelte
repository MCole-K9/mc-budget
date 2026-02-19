<script lang="ts">
	import { goto } from '$app/navigation';
	import { register } from '$lib/api/auth';
	import { auth } from '$lib/stores/auth.svelte';
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Alert from '$lib/components/Alert.svelte';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let passwordConfirm = $state('');
	let loading = $state(false);
	let error = $state('');

	const passwordsMatch = $derived(password === passwordConfirm);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';

		if (!passwordsMatch) {
			error = 'Passwords do not match';
			return;
		}

		loading = true;

		try {
			const user = await register({ name, email, password, passwordConfirm });
			auth.setUser(user);
			await goto('/wallets');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Registration failed';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Sign Up - MC Budget</title>
</svelte:head>

<div class="max-w-md mx-auto">
	<Card title="Create Account">
		{#snippet children()}
			{#if error}
				<Alert type="error" dismissible ondismiss={() => (error = '')}>
					{#snippet children()}{error}{/snippet}
				</Alert>
			{/if}

			<form onsubmit={handleSubmit} class="space-y-4 mt-4">
				<Input
					type="text"
					label="Name"
					bind:value={name}
					placeholder="Your name"
					required
				/>

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
					placeholder="Create a password"
					required
				/>

				<Input
					type="password"
					label="Confirm Password"
					bind:value={passwordConfirm}
					placeholder="Confirm your password"
					error={passwordConfirm && !passwordsMatch ? 'Passwords do not match' : ''}
					required
				/>

				<Button type="submit" variant="primary" class="w-full" {loading}>
					Create Account
				</Button>
			</form>

			<p class="text-center mt-4 text-sm text-base-content/70">
				Already have an account?
				<a href="/auth/login" class="link link-primary">Sign in</a>
			</p>
		{/snippet}
	</Card>
</div>
