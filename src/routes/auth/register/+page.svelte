<script lang="ts">
	import { register } from '$lib/auth.remote';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';

	const registerForm = register;
</script>

<svelte:head>
	<title>Sign Up - MC Budget</title>
</svelte:head>

<div class="max-w-sm mx-auto mt-8">
	<div class="text-center mb-8">
		<h1 class="text-2xl font-bold">Create account</h1>
		<p class="text-base-content/50 text-sm mt-1">Start managing your budget</p>
	</div>

	<div class="rounded-2xl bg-base-100 shadow-sm p-6 space-y-4">
		{#each registerForm.fields.allIssues() as issue (issue.message)}
			<div class="text-sm text-error bg-error/10 rounded-xl px-4 py-3">{issue.message}</div>
		{/each}

		<form {...registerForm} class="space-y-4">
			<div class="space-y-1.5">
				<label class="text-sm font-medium text-base-content/70" for="name">Name</label>
				<input
					{...registerForm.fields.name.as('text')}
					id="name"
					class="input input-bordered w-full"
					placeholder="Your name"
				/>
				{#each registerForm.fields.name.issues() as issue (issue.message)}
					<p class="text-xs text-error">{issue.message}</p>
				{/each}
			</div>

			<div class="space-y-1.5">
				<label class="text-sm font-medium text-base-content/70" for="email">Email</label>
				<input
					{...registerForm.fields.email.as('email')}
					id="email"
					class="input input-bordered w-full"
					placeholder="you@example.com"
				/>
				{#each registerForm.fields.email.issues() as issue (issue.message)}
					<p class="text-xs text-error">{issue.message}</p>
				{/each}
			</div>

			<div class="space-y-1.5">
				<label class="text-sm font-medium text-base-content/70" for="password">Password</label>
				<input
					{...registerForm.fields._password.as('password')}
					id="password"
					class="input input-bordered w-full"
					placeholder="Create a password"
				/>
				{#each registerForm.fields._password.issues() as issue (issue.message)}
					<p class="text-xs text-error">{issue.message}</p>
				{/each}
			</div>

			<div class="space-y-1.5">
				<label class="text-sm font-medium text-base-content/70" for="passwordConfirm">Confirm Password</label>
				<input
					{...registerForm.fields._passwordConfirm.as('password')}
					id="passwordConfirm"
					class="input input-bordered w-full"
					placeholder="Confirm your password"
				/>
				{#each registerForm.fields._passwordConfirm.issues() as issue (issue.message)}
					<p class="text-xs text-error">{issue.message}</p>
				{/each}
			</div>

			<Button type="submit" variant="primary" class="w-full mt-2" loading={!!registerForm.pending}>
				Create Account
			</Button>
		</form>
	</div>

	<p class="text-center mt-5 text-sm text-base-content/50">
		Already have an account?
		<a href={resolve('/auth/login')} class="link link-primary font-medium">Sign in</a>
	</p>
</div>
