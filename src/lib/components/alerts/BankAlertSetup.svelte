<script lang="ts">
	import { resolve } from '$app/paths';
	import { PROVIDERS, providerForEmail, type MailProvider } from '$lib/alerts/engine';
	import { getAlertAiStatus, setAlertAiFallback } from '$lib/alerts.remote';
	import Button from '../Button.svelte';

	interface Props {
		/** The signed-in user's email, used to pick their mail provider */
		email: string;
	}

	let { email }: Props = $props();

	const aiStatus = $derived(await getAlertAiStatus());
	let savingAi = $state(false);
	let aiError = $state('');

	async function handleAiFallback(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		savingAi = true;
		aiError = '';
		try {
			await setAlertAiFallback(input.checked);
		} catch (err) {
			input.checked = aiStatus.fallbackEnabled;
			aiError = err instanceof Error ? err.message : 'Could not change the setting';
		} finally {
			savingAi = false;
		}
	}

	const provider = $derived(providerForEmail(email));

	const STATUS: Record<
		MailProvider['autoForward'],
		{ label: string; class: string; text: string }
	> = {
		yes: {
			label: 'Auto-forward works',
			class: 'badge-success',
			text: 'Your provider can forward bank alerts automatically.'
		},
		paid: {
			label: 'Paid plan needed',
			class: 'badge-warning',
			text: 'Auto-forward needs a paid plan with this provider. Forwarding by hand or pasting always works.'
		},
		admin: {
			label: 'Admin must allow',
			class: 'badge-warning',
			text: 'Your organisation admin must allow forwarding to outside addresses.'
		},
		no: {
			label: 'No auto-forward',
			class: 'badge-ghost',
			text: 'This provider cannot auto-forward. Forward by hand or paste instead.'
		}
	};
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- provider help links are external URLs -->
<div class="space-y-4">
	<div class="rounded-box border border-base-300/70 p-4">
		{#if provider}
			{@const status = STATUS[provider.autoForward]}
			<div class="flex flex-wrap items-center justify-between gap-2">
				<p class="font-semibold">{provider.name}</p>
				<span class={['badge badge-soft badge-sm', status.class]}>{status.label}</span>
			</div>
			<p class="mt-1 text-sm text-base-content/65">{status.text}</p>
			<a
				class="mt-2 inline-block link text-sm link-primary"
				href={provider.helpUrl}
				target="_blank"
				rel="noopener noreferrer"
			>
				How to set up forwarding in {provider.name}
			</a>
		{:else}
			<p class="font-semibold">Work or custom email</p>
			<p class="mt-1 text-sm text-base-content/65">
				We could not tell your mail provider from your address. Most providers can forward mail;
				Microsoft 365 work accounts need an admin to allow it. Pasting always works.
			</p>
		{/if}
	</div>

	<ol class="list-inside list-decimal space-y-1 text-sm text-base-content/70">
		<li>Copy a bank alert from your email or SMS, or forward it to yourself.</li>
		<li>Paste it on the Bank alerts page. A template reads the amount, merchant and card.</li>
		<li>Review the Pending transaction and confirm it into a wallet.</li>
	</ol>
	<p class="text-xs text-base-content/50">
		A personal forwarding address, so alerts arrive by themselves, is not available yet.
	</p>

	<div class="rounded-box border border-base-300/70 p-4">
		<label class="flex cursor-pointer items-start justify-between gap-3">
			<span>
				<span class="block font-semibold">Let AI read alerts no template can read</span>
				<span class="mt-1 block text-sm text-base-content/65">
					{#if aiStatus.providerLabel}
						Sends those alerts to {aiStatus.providerLabel} with your own key. AI results are marked "Read
						by AI" and always wait in Pending for you to check. Off by default.
					{:else}
						Needs your own AI key (Personal API keys below). Alert text is never sent with the
						shared key.
					{/if}
				</span>
			</span>
			<input
				type="checkbox"
				class="toggle toggle-primary"
				checked={aiStatus.fallbackEnabled}
				disabled={savingAi || (!aiStatus.providerLabel && !aiStatus.fallbackEnabled)}
				onchange={handleAiFallback}
			/>
		</label>
		{#if aiError}<p class="mt-2 text-xs text-error">{aiError}</p>{/if}
	</div>

	<details class="text-sm">
		<summary class="cursor-pointer text-base-content/70">Other mail providers</summary>
		<ul class="mt-2 space-y-1">
			{#each PROVIDERS as p (p.id)}
				<li class="flex flex-wrap items-center justify-between gap-2">
					<a class="link" href={p.helpUrl} target="_blank" rel="noopener noreferrer">{p.name}</a>
					<span class={['badge badge-soft badge-xs', STATUS[p.autoForward].class]}>
						{STATUS[p.autoForward].label}
					</span>
				</li>
			{/each}
		</ul>
	</details>

	<Button href={resolve('/alerts')} size="sm" icon="inbox">Open bank alerts</Button>
</div>
