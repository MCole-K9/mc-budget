<script lang="ts">
	import { register } from '$lib/auth.remote';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import Icon from '$lib/components/Icon.svelte';

	const registerForm = register;
</script>

<svelte:head>
	<title>Sign Up - MC Budget</title>
</svelte:head>

<div class="mx-auto max-w-sm pt-4 sm:pt-12">
	<div class="mb-8 text-center">
		<span
			class="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-primary text-primary-content shadow-lg shadow-primary/25"
		>
			<Icon name="wallet" class="size-6" />
		</span>
		<h1 class="text-2xl font-bold tracking-tight">Create your account</h1>
		<p class="mt-1 text-sm text-base-content/55">Start budgeting in under a minute</p>
	</div>

	<div class="space-y-4 surface p-6 shadow-xl shadow-base-content/5">
		{#each registerForm.fields.allIssues() as issue (issue.message)}
			<Alert type="error">{issue.message}</Alert>
		{/each}

		<form {...registerForm} class="space-y-4">
			<div class="space-y-1.5">
				<label class="text-sm font-medium text-base-content/80" for="name">Name</label>
				<input
					{...registerForm.fields.name.as('text')}
					id="name"
					autocomplete="name"
					class="input w-full"
					placeholder="Your name"
				/>
				{#each registerForm.fields.name.issues() as issue (issue.message)}
					<p class="text-xs text-error">{issue.message}</p>
				{/each}
			</div>

			<div class="space-y-1.5">
				<label class="text-sm font-medium text-base-content/80" for="email">Email</label>
				<input
					{...registerForm.fields.email.as('email')}
					id="email"
					autocomplete="email"
					class="input w-full"
					placeholder="you@example.com"
				/>
				{#each registerForm.fields.email.issues() as issue (issue.message)}
					<p class="text-xs text-error">{issue.message}</p>
				{/each}
			</div>

			<div class="space-y-1.5">
				<label class="text-sm font-medium text-base-content/80" for="password">Password</label>
				<input
					{...registerForm.fields._password.as('password')}
					id="password"
					autocomplete="new-password"
					class="input w-full"
					placeholder="Create a password"
				/>
				{#each registerForm.fields._password.issues() as issue (issue.message)}
					<p class="text-xs text-error">{issue.message}</p>
				{/each}
			</div>

			<div class="space-y-1.5">
				<label class="text-sm font-medium text-base-content/80" for="passwordConfirm"
					>Confirm password</label
				>
				<input
					{...registerForm.fields._passwordConfirm.as('password')}
					id="passwordConfirm"
					autocomplete="new-password"
					class="input w-full"
					placeholder="Confirm your password"
				/>
				{#each registerForm.fields._passwordConfirm.issues() as issue (issue.message)}
					<p class="text-xs text-error">{issue.message}</p>
				{/each}
			</div>

			<Button type="submit" variant="primary" class="mt-2 w-full" loading={!!registerForm.pending}>
				Create account
			</Button>
		</form>
	</div>

	<p class="mt-6 text-center text-sm text-base-content/55">
		Already have an account?
		<a href={resolve('/auth/login')} class="font-medium text-primary hover:underline">Sign in</a>
	</p>
</div>
