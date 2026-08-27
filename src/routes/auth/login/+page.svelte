<script lang="ts">
	import { login } from '$lib/auth.remote';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Button from '$lib/components/Button.svelte';

	const loginForm = login;
	const approvalPending = $derived(page.url.searchParams.get('approval') === 'pending');
	const approvalRequired = $derived(page.url.searchParams.get('approval') === 'required');
</script>

<svelte:head>
	<title>Sign In - MC Budget</title>
</svelte:head>

<div class="mx-auto mt-8 max-w-sm">
	<div class="mb-8 text-center">
		<h1 class="text-2xl font-bold">Welcome back</h1>
		<p class="mt-1 text-sm text-base-content/50">Sign in to MC Budget</p>
	</div>

	<div class="space-y-4 rounded-2xl bg-base-100 p-6 shadow-sm">
		{#if approvalPending}
			<div class="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
				Account created. An administrator must approve it before you can sign in.
			</div>
		{:else if approvalRequired}
			<div class="rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
				Your account must be approved by an administrator before you can use MC Budget.
			</div>
		{/if}

		{#each loginForm.fields.allIssues() as issue (issue.message)}
			<div class="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{issue.message}</div>
		{/each}

		<form {...loginForm} class="space-y-4">
			<div class="space-y-1.5">
				<label class="text-sm font-medium text-base-content/70" for="email">Email</label>
				<input
					{...loginForm.fields.email.as('email')}
					id="email"
					class="input-bordered input w-full"
					placeholder="you@example.com"
				/>
				{#each loginForm.fields.email.issues() as issue (issue.message)}
					<p class="text-xs text-error">{issue.message}</p>
				{/each}
			</div>

			<div class="space-y-1.5">
				<label class="text-sm font-medium text-base-content/70" for="password">Password</label>
				<input
					{...loginForm.fields._password.as('password')}
					id="password"
					class="input-bordered input w-full"
					placeholder="Enter your password"
				/>
				{#each loginForm.fields._password.issues() as issue (issue.message)}
					<p class="text-xs text-error">{issue.message}</p>
				{/each}
			</div>

			<Button type="submit" variant="primary" class="mt-2 w-full" loading={!!loginForm.pending}>
				Sign In
			</Button>
		</form>
	</div>

	<p class="mt-5 text-center text-sm text-base-content/50">
		Don't have an account?
		<a href={resolve('/auth/register')} class="link font-medium link-primary">Sign up</a>
	</p>
</div>
