<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		getAlerts,
		getAlertAiStatus,
		ignoreAlert,
		previewAlert,
		reparseAlert,
		submitAlert,
		type AlertView
	} from '$lib/alerts.remote';
	import { getWallets } from '$lib/wallets.remote';
	import type { ParsedAlert } from '$lib/alerts/engine';
	import AuthGuard from '$lib/components/AuthGuard.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import ParsedAlertSummary from '$lib/components/alerts/ParsedAlertSummary.svelte';
	import ConfirmAlertForm from '$lib/components/alerts/ConfirmAlertForm.svelte';

	type Tab = 'pending' | 'failed' | 'done';
	let tab = $state<Tab>('pending');

	const [wallets, pending, failed, aiStatus] = $derived(
		await Promise.all([getWallets(), getAlerts('pending'), getAlerts('failed'), getAlertAiStatus()])
	);
	const done = $derived(tab === 'done' ? await getAlerts('done') : []);
	const list = $derived(tab === 'pending' ? pending : tab === 'failed' ? failed : done);

	const tabs = $derived([
		{ value: 'pending', label: `Pending (${pending.length})` },
		{ value: 'failed', label: `Unread (${failed.length})` },
		{ value: 'done', label: 'History' }
	]);

	// Paste box
	let text = $state('');
	let preview = $state<{ parsed: ParsedAlert | null } | null>(null);
	let previewing = $state(false);
	let submitting = $state(false);
	let pasteError = $state('');
	let pasteNote = $state('');

	async function handlePreview() {
		previewing = true;
		pasteError = '';
		pasteNote = '';
		try {
			preview = await previewAlert({ text });
		} catch (err) {
			pasteError = err instanceof Error ? err.message : 'Could not read this alert';
		} finally {
			previewing = false;
		}
	}

	async function handleSubmit() {
		submitting = true;
		pasteError = '';
		pasteNote = '';
		try {
			const result = await submitAlert({ text });
			pasteNote = {
				pending: 'Added to Pending. Review it below.',
				failed: 'Saved to Unread: no template can read it yet.',
				duplicate: 'You already added this alert.'
			}[result.status];
			tab = result.status === 'failed' ? 'failed' : 'pending';
			text = '';
			preview = null;
		} catch (err) {
			pasteError = err instanceof Error ? err.message : 'Could not save this alert';
		} finally {
			submitting = false;
		}
	}

	// Row actions
	let reviewing = $state<(AlertView & { parsed: ParsedAlert }) | null>(null);
	let busyId = $state<string | null>(null);
	let rowError = $state('');
	let rowNote = $state('');

	async function runRowAction(id: string, action: () => Promise<unknown>) {
		busyId = id;
		rowError = '';
		rowNote = '';
		try {
			await action();
		} catch (err) {
			rowError = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			busyId = null;
		}
	}

	async function handleRetry(id: string) {
		await runRowAction(id, async () => {
			const result = await reparseAlert(id);
			rowNote = {
				pending: 'A template read it. It is now in Pending.',
				failed: 'Still no template can read it.',
				duplicate: 'It was already in your alerts, so it was dismissed.'
			}[result.status];
		});
	}

	const fmtReceived = (iso: string) =>
		new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
</script>

<svelte:head>
	<title>Bank alerts - MC Budget</title>
</svelte:head>

<AuthGuard>
	<PageHeader
		title="Bank alerts"
		subtitle="Paste a bank alert to turn it into a transaction. Nothing changes your wallets until you confirm it."
	>
		{#snippet actions()}
			<Button href={resolve('/alerts/templates')} variant="soft" size="sm" icon="layers">
				Templates
			</Button>
		{/snippet}
	</PageHeader>

	<div class="space-y-6">
		<section class="space-y-3 surface p-5 sm:p-6">
			<label for="alert-text" class="font-semibold">Paste an alert</label>
			<textarea
				id="alert-text"
				class="textarea block min-h-36 w-full font-mono text-sm"
				placeholder="Paste the text of a bank email or SMS (a forwarded email is fine)"
				maxlength={100000}
				bind:value={text}
				oninput={() => (preview = null)}
			></textarea>
			<div class="flex flex-wrap gap-2">
				<Button
					variant="soft"
					icon="sparkles"
					loading={previewing}
					disabled={!text.trim()}
					onclick={handlePreview}
				>
					Preview
				</Button>
				<Button icon="inbox" loading={submitting} disabled={!text.trim()} onclick={handleSubmit}>
					Save to inbox
				</Button>
			</div>

			{#if preview}
				<div class="rounded-box border border-base-300/70 p-4">
					{#if preview.parsed}
						<ParsedAlertSummary alert={preview.parsed} />
					{:else}
						<p class="text-sm text-base-content/70">
							None of your templates can read this alert.
							{#if aiStatus.fallbackEnabled}
								When you save it, {aiStatus.providerLabel ?? 'your AI'} will try to read it; check the
								result in Pending.
							{:else}
								Save it, then write a template for it from the Unread tab.
							{/if}
						</p>
					{/if}
				</div>
			{/if}
			{#if pasteError}<Alert type="error">{pasteError}</Alert>{/if}
			{#if pasteNote}<Alert type="success">{pasteNote}</Alert>{/if}
		</section>

		<SegmentedControl
			options={tabs}
			value={tab}
			onchange={(v) => (tab = v as Tab)}
			label="Alert list"
		/>
		{#if rowError}<Alert type="error" dismissible>{rowError}</Alert>{/if}
		{#if rowNote}<Alert type="info" dismissible>{rowNote}</Alert>{/if}

		{#if list.length === 0}
			<EmptyState
				icon="inbox"
				title={{
					pending: 'No pending transactions',
					failed: 'No unread alerts',
					done: 'No history yet'
				}[tab]}
				description={{
					pending: 'Alerts that a template can read wait here until you confirm them.',
					failed: 'Alerts that no template can read wait here, so you can write a template.',
					done: 'Confirmed and ignored alerts show here.'
				}[tab]}
			/>
		{:else}
			<ul class="space-y-3">
				{#each list as alert (alert.id)}
					<li class="space-y-3 surface p-4">
						{#if alert.parsed}
							<ParsedAlertSummary alert={alert.parsed} />
						{:else}
							<p class="text-xs text-base-content/55">Received {fmtReceived(alert.receivedAt)}</p>
							{#if alert.rawText}
								<pre
									class="max-h-40 overflow-auto rounded-field bg-base-200 p-3 text-xs whitespace-pre-wrap">{alert.rawText}</pre>
							{/if}
						{/if}

						{#if alert.status === 'pending'}
							<div class="flex flex-wrap justify-end gap-2">
								<Button
									variant="ghost"
									size="sm"
									loading={busyId === alert.id}
									onclick={() => runRowAction(alert.id, () => ignoreAlert(alert.id))}
								>
									{alert.parsed?.direction === 'declined' ? 'Dismiss' : 'Ignore'}
								</Button>
								{#if alert.parsed && alert.parsed.direction !== 'declined'}
									<Button
										size="sm"
										icon="check"
										onclick={() => (reviewing = alert as AlertView & { parsed: ParsedAlert })}
									>
										Review
									</Button>
								{/if}
							</div>
						{:else if alert.status === 'failed'}
							<div class="flex flex-wrap justify-end gap-2">
								<Button
									variant="ghost"
									size="sm"
									disabled={busyId === alert.id}
									onclick={() => runRowAction(alert.id, () => ignoreAlert(alert.id))}
								>
									Ignore
								</Button>
								<Button
									variant="soft"
									size="sm"
									icon="pencil"
									href={`${resolve('/alerts/templates')}?sample=${alert.id}`}
								>
									Write a template
								</Button>
								<Button
									size="sm"
									icon="refresh"
									loading={busyId === alert.id}
									onclick={() => handleRetry(alert.id)}
								>
									Try again
								</Button>
							</div>
						{:else}
							<p class="text-right text-xs text-base-content/55">
								{alert.status === 'confirmed' ? 'Added as a transaction' : 'Ignored'}
							</p>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<Modal
		open={reviewing !== null}
		title="Review transaction"
		description="Check the details, then add it to a wallet."
		onclose={() => (reviewing = null)}
	>
		{#if reviewing}
			<ConfirmAlertForm
				alert={reviewing}
				{wallets}
				oncancel={() => (reviewing = null)}
				ondone={() => {
					reviewing = null;
					rowNote = 'Transaction added.';
				}}
			/>
		{/if}
	</Modal>
</AuthGuard>
