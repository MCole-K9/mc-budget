<script lang="ts">
	import { login } from '$lib/auth.remote';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Alert from '$lib/components/Alert.svelte';

	const loginForm = login;
</script>

<svelte:head>
	<title>Login - MC Budget</title>
</svelte:head>

<div class="max-w-md mx-auto">
	<Card title="Sign In">
		{#each loginForm.fields.allIssues() as issue (issue.message)}
			<Alert type="error">{issue.message}</Alert>
		{/each}

		<form {...loginForm} class="space-y-4 mt-4">
			<div class="form-control w-full">
				<div class="label">
					<span class="label-text">Email</span>
				</div>
				<input
					{...loginForm.fields.email.as('email')}
					class="input input-bordered w-full"
					placeholder="you@example.com"
				/>
				{#each loginForm.fields.email.issues() as issue (issue.message)}
					<div class="label">
						<span class="label-text-alt text-error">{issue.message}</span>
					</div>
				{/each}
			</div>

			<div class="form-control w-full">
				<div class="label">
					<span class="label-text">Password</span>
				</div>
				<input
					{...loginForm.fields.password.as('password')}
					class="input input-bordered w-full"
					placeholder="Enter your password"
				/>
				{#each loginForm.fields.password.issues() as issue (issue.message)}
					<div class="label">
						<span class="label-text-alt text-error">{issue.message}</span>
					</div>
				{/each}
			</div>

			<Button type="submit" variant="primary" class="w-full" loading={!!loginForm.pending}>
				Sign In
			</Button>
		</form>

		<p class="text-center mt-4 text-sm text-base-content/70">
			Don't have an account?
			<a href={resolve('/auth/register')} class="link link-primary">Sign up</a>
		</p>
	</Card>
</div>
