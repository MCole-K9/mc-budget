<script lang="ts">
	import { goto } from '$app/navigation';
	import { login } from '$lib/auth.remote';
	import { auth } from '$lib/stores/auth.svelte';
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Alert from '$lib/components/Alert.svelte';

	// Remote form returns attributes to spread on form element
	const loginForm = login;

	// Track form state
	let loading = $state(false);
	let error = $state('');

	// Check for successful login result
	$effect(() => {
		if (loginForm.result?.user) {
			auth.setUser(loginForm.result.user);
			goto('/wallets');
		}
	});
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

			{#each loginForm.fields.allIssues() as issue}
				<Alert type="error">
					{#snippet children()}{issue.message}{/snippet}
				</Alert>
			{/each}

			<form {...loginForm} class="space-y-4 mt-4">
				<div class="form-control w-full">
					<label class="label">
						<span class="label-text">Email</span>
					</label>
					<input
						{...loginForm.fields.email.as('email')}
						class="input input-bordered w-full"
						placeholder="you@example.com"
					/>
					{#each loginForm.fields.email.issues() as issue}
						<label class="label">
							<span class="label-text-alt text-error">{issue.message}</span>
						</label>
					{/each}
				</div>

				<div class="form-control w-full">
					<label class="label">
						<span class="label-text">Password</span>
					</label>
					<input
						{...loginForm.fields.password.as('password')}
						class="input input-bordered w-full"
						placeholder="Enter your password"
					/>
					{#each loginForm.fields.password.issues() as issue}
						<label class="label">
							<span class="label-text-alt text-error">{issue.message}</span>
						</label>
					{/each}
				</div>

				<Button type="submit" variant="primary" class="w-full" loading={!!loginForm.pending}>
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
