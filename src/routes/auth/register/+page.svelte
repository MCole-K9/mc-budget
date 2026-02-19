<script lang="ts">
	import { goto } from '$app/navigation';
	import { register } from '$lib/auth.remote';
	import { auth } from '$lib/stores/auth.svelte';
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Alert from '$lib/components/Alert.svelte';

	// Remote form returns attributes to spread on form element
	const registerForm = register;

	// Track form state
	let error = $state('');

	// Check for successful registration result
	$effect(() => {
		if (registerForm.result?.user) {
			auth.setUser(registerForm.result.user);
			goto('/wallets');
		}
	});
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

			{#each registerForm.fields.allIssues() as issue}
				<Alert type="error">
					{#snippet children()}{issue.message}{/snippet}
				</Alert>
			{/each}

			<form {...registerForm} class="space-y-4 mt-4">
				<div class="form-control w-full">
					<label class="label">
						<span class="label-text">Name</span>
					</label>
					<input
						{...registerForm.fields.name.as('text')}
						class="input input-bordered w-full"
						placeholder="Your name"
					/>
					{#each registerForm.fields.name.issues() as issue}
						<label class="label">
							<span class="label-text-alt text-error">{issue.message}</span>
						</label>
					{/each}
				</div>

				<div class="form-control w-full">
					<label class="label">
						<span class="label-text">Email</span>
					</label>
					<input
						{...registerForm.fields.email.as('email')}
						class="input input-bordered w-full"
						placeholder="you@example.com"
					/>
					{#each registerForm.fields.email.issues() as issue}
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
						{...registerForm.fields.password.as('password')}
						class="input input-bordered w-full"
						placeholder="Create a password"
					/>
					{#each registerForm.fields.password.issues() as issue}
						<label class="label">
							<span class="label-text-alt text-error">{issue.message}</span>
						</label>
					{/each}
				</div>

				<div class="form-control w-full">
					<label class="label">
						<span class="label-text">Confirm Password</span>
					</label>
					<input
						{...registerForm.fields.passwordConfirm.as('password')}
						class="input input-bordered w-full"
						placeholder="Confirm your password"
					/>
					{#each registerForm.fields.passwordConfirm.issues() as issue}
						<label class="label">
							<span class="label-text-alt text-error">{issue.message}</span>
						</label>
					{/each}
				</div>

				<Button type="submit" variant="primary" class="w-full" loading={!!registerForm.pending}>
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
