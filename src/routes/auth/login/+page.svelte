<script lang="ts">
	import { login } from '$lib/auth.remote';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';

	const loginForm = login;
</script>

<svelte:head>
	<title>Sign In - MC Budget</title>
</svelte:head>

<div class="max-w-sm mx-auto mt-8">
	<div class="text-center mb-8">
		<h1 class="text-2xl font-bold">Welcome back</h1>
		<p class="text-base-content/50 text-sm mt-1">Sign in to MC Budget</p>
	</div>

	<div class="rounded-2xl bg-base-100 shadow-sm p-6 space-y-4">
		{#each loginForm.fields.allIssues() as issue (issue.message)}
			<div class="text-sm text-error bg-error/10 rounded-xl px-4 py-3">{issue.message}</div>
		{/each}

		<form {...loginForm} class="space-y-4">
			<div class="space-y-1.5">
				<label class="text-sm font-medium text-base-content/70" for="email">Email</label>
				<input
					{...loginForm.fields.email.as('email')}
					id="email"
					class="input input-bordered w-full"
					placeholder="you@example.com"
				/>
				{#each loginForm.fields.email.issues() as issue (issue.message)}
					<p class="text-xs text-error">{issue.message}</p>
				{/each}
			</div>

			<div class="space-y-1.5">
				<label class="text-sm font-medium text-base-content/70" for="password">Password</label>
				<input
					{...loginForm.fields.password.as('password')}
					id="password"
					class="input input-bordered w-full"
					placeholder="Enter your password"
				/>
				{#each loginForm.fields.password.issues() as issue (issue.message)}
					<p class="text-xs text-error">{issue.message}</p>
				{/each}
			</div>

			<Button type="submit" variant="primary" class="w-full mt-2" loading={!!loginForm.pending}>
				Sign In
			</Button>
		</form>
	</div>

	<p class="text-center mt-5 text-sm text-base-content/50">
		Don't have an account?
		<a href={resolve('/auth/register')} class="link link-primary font-medium">Sign up</a>
	</p>
</div>
