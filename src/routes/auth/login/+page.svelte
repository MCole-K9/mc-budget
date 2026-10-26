<script lang="ts">
	import { login } from '$lib/auth.remote';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Button from '$lib/components/Button.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import Icon from '$lib/components/Icon.svelte';

	const loginForm = login;
	const approvalPending = $derived(page.url.searchParams.get('approval') === 'pending');
	const approvalRequired = $derived(page.url.searchParams.get('approval') === 'required');
</script>

<svelte:head>
	<title>Sign In - MC Budget</title>
</svelte:head>

<div class="mx-auto max-w-sm pt-4 sm:pt-12">
	<div class="mb-8 text-center">
		<span
			class="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-primary text-primary-content shadow-lg shadow-primary/25"
		>
			<Icon name="wallet" class="size-6" />
		</span>
		<h1 class="text-2xl font-bold tracking-tight">Welcome back</h1>
		<p class="mt-1 text-sm text-base-content/55">Sign in to keep your budget on track</p>
	</div>

	<div class="space-y-4 surface p-6 shadow-xl shadow-base-content/5">
		{#if approvalPending}
			<Alert type="success">
				Account created. An administrator must approve it before you can sign in.
			</Alert>
		{:else if approvalRequired}
			<Alert type="warning">
				Your account must be approved by an administrator before you can use MC Budget.
			</Alert>
		{/if}

		{#each loginForm.fields.allIssues() as issue (issue.message)}
			<Alert type="error">{issue.message}</Alert>
		{/each}

		<form {...loginForm} class="space-y-4">
			<div class="space-y-1.5">
				<label class="text-sm font-medium text-base-content/80" for="email">Email</label>
				<input
					{...loginForm.fields.email.as('email')}
					id="email"
					autocomplete="email"
					class="input w-full"
					placeholder="you@example.com"
				/>
				{#each loginForm.fields.email.issues() as issue (issue.message)}
					<p class="text-xs text-error">{issue.message}</p>
				{/each}
			</div>

			<div class="space-y-1.5">
				<label class="text-sm font-medium text-base-content/80" for="password">Password</label>
				<input
					{...loginForm.fields._password.as('password')}
					id="password"
					autocomplete="current-password"
					class="input w-full"
					placeholder="Enter your password"
				/>
				{#each loginForm.fields._password.issues() as issue (issue.message)}
					<p class="text-xs text-error">{issue.message}</p>
				{/each}
			</div>

			<Button type="submit" variant="primary" class="mt-2 w-full" loading={!!loginForm.pending}>
				Sign in
			</Button>
		</form>
	</div>

	<p class="mt-6 text-center text-sm text-base-content/55">
		Don't have an account?
		<a href={resolve('/auth/register')} class="font-medium text-primary hover:underline">Sign up</a>
	</p>
</div>
