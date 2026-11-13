<script lang="ts">
	import { getAlertInbox, newAlertInboxAddress, setAlertInboxEnabled } from '$lib/alerts.remote';
	import Button from '../Button.svelte';

	const inbox = $derived(await getAlertInbox());
	let busy = $state(false);
	let confirmNew = $state(false);
	let copied = $state(false);
	let errorMessage = $state('');

	async function run(action: () => Promise<unknown>) {
		busy = true;
		errorMessage = '';
		try {
			await action();
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			busy = false;
			confirmNew = false;
		}
	}

	async function copy(address: string) {
		await navigator.clipboard.writeText(address);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- the confirmation link is an external provider URL (allowlisted on the server) -->
<div class="rounded-box border border-base-300/70 p-4">
	<p class="font-semibold">Your forwarding address</p>
	{#if !inbox.available}
		<p class="mt-1 text-sm text-base-content/65">
			Email forwarding is not set up on this server yet. Paste alerts on the Bank alerts page.
		</p>
	{:else if !inbox.address}
		<p class="mt-1 text-sm text-base-content/65">
			Get a private address, then set your mail (or just your bank's alerts) to forward to it.
			Alerts land in Pending; nothing reaches a wallet until you confirm it.
		</p>
		<Button class="mt-3" size="sm" loading={busy} onclick={() => run(() => newAlertInboxAddress())}>
			Get my address
		</Button>
	{:else}
		<p class="mt-1 text-sm text-base-content/65">
			Forward your bank's alerts here. Keep it private: anyone with this address can add Pending
			alerts to your account.
		</p>
		<div class="mt-3 flex flex-wrap items-center gap-2">
			<code
				class={[
					'min-w-0 rounded-field bg-base-200 px-3 py-2 text-sm break-all',
					!inbox.enabled && 'line-through opacity-50'
				]}>{inbox.address}</code
			>
			<Button size="sm" variant="soft" onclick={() => copy(inbox.address!)}>
				{copied ? 'Copied' : 'Copy'}
			</Button>
		</div>

		<div class="mt-3 flex flex-wrap items-center gap-3 text-sm">
			<label class="flex cursor-pointer items-center gap-2">
				<input
					type="checkbox"
					class="toggle toggle-primary toggle-sm"
					checked={inbox.enabled}
					disabled={busy}
					onchange={(e) => {
						const on = e.currentTarget.checked;
						run(() => setAlertInboxEnabled(on));
					}}
				/>
				Receiving
			</label>
			{#if confirmNew}
				<Button
					size="sm"
					variant="error"
					loading={busy}
					onclick={() => run(() => newAlertInboxAddress())}
				>
					Replace it (old address stops)
				</Button>
				<Button size="sm" variant="ghost" onclick={() => (confirmNew = false)}>Keep</Button>
			{:else}
				<Button size="sm" variant="ghost" icon="refresh" onclick={() => (confirmNew = true)}>
					New address
				</Button>
			{/if}
		</div>

		{#if inbox.confirmAt}
			<div class="mt-4 rounded-field border border-warning/40 bg-warning/5 p-3 text-sm">
				<p class="font-semibold">Your mail provider asks you to confirm forwarding</p>
				<p class="mt-1 text-xs text-base-content/55">
					Received {new Date(inbox.confirmAt).toLocaleString()}
				</p>
				{#if inbox.confirmLink}
					<a
						class="mt-2 inline-block link link-primary"
						href={inbox.confirmLink}
						target="_blank"
						rel="noopener noreferrer">Open the confirmation link</a
					>
				{/if}
				<details class="mt-2">
					<summary class="cursor-pointer text-xs text-base-content/60">
						Show the message (it may contain a code)
					</summary>
					<pre
						class="mt-2 max-h-48 overflow-auto text-xs whitespace-pre-wrap">{inbox.confirmText}</pre>
				</details>
			</div>
		{/if}
	{/if}
	{#if errorMessage}<p class="mt-2 text-xs text-error">{errorMessage}</p>{/if}
</div>
