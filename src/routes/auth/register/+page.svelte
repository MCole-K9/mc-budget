<script lang="ts">
	import { register } from '$lib/auth.remote';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Alert from '$lib/components/Alert.svelte';

	const registerForm = register;
</script>

<svelte:head>
	<title>Sign Up - MC Budget</title>
</svelte:head>

<div class="max-w-md mx-auto">
	<Card title="Create Account">
		{#each registerForm.fields.allIssues() as issue (issue.message)}
			<Alert type="error">{issue.message}</Alert>
		{/each}

		<form {...registerForm} class="space-y-4 mt-4">
			<div class="form-control w-full">
				<div class="label">
					<span class="label-text">Name</span>
				</div>
				<input
					{...registerForm.fields.name.as('text')}
					class="input input-bordered w-full"
					placeholder="Your name"
				/>
				{#each registerForm.fields.name.issues() as issue (issue.message)}
					<div class="label">
						<span class="label-text-alt text-error">{issue.message}</span>
					</div>
				{/each}
			</div>

			<div class="form-control w-full">
				<div class="label">
					<span class="label-text">Email</span>
				</div>
				<input
					{...registerForm.fields.email.as('email')}
					class="input input-bordered w-full"
					placeholder="you@example.com"
				/>
				{#each registerForm.fields.email.issues() as issue (issue.message)}
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
					{...registerForm.fields.password.as('password')}
					class="input input-bordered w-full"
					placeholder="Create a password"
				/>
				{#each registerForm.fields.password.issues() as issue (issue.message)}
					<div class="label">
						<span class="label-text-alt text-error">{issue.message}</span>
					</div>
				{/each}
			</div>

			<div class="form-control w-full">
				<div class="label">
					<span class="label-text">Confirm Password</span>
				</div>
				<input
					{...registerForm.fields.passwordConfirm.as('password')}
					class="input input-bordered w-full"
					placeholder="Confirm your password"
				/>
				{#each registerForm.fields.passwordConfirm.issues() as issue (issue.message)}
					<div class="label">
						<span class="label-text-alt text-error">{issue.message}</span>
					</div>
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
	</Card>
</div>
