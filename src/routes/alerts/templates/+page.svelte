<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		deleteTemplate,
		draftTemplateAi,
		getAlertAiStatus,
		getAlerts,
		getTemplates,
		saveTemplate,
		testTemplate,
		type TemplateView
	} from '$lib/alerts.remote';
	import { regexProblem, TEMPLATE_FIELDS, type ParsedAlert } from '$lib/alerts/engine';
	import { SAMPLE_ALERT_TEXT, SAMPLE_TEMPLATE } from '$lib/alerts/engine/fixtures/bank';
	import AuthGuard from '$lib/components/AuthGuard.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Button from '$lib/components/Button.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import Input from '$lib/components/Input.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ParsedAlertSummary from '$lib/components/alerts/ParsedAlertSummary.svelte';

	type Field = (typeof TEMPLATE_FIELDS)[number];

	const FIELD_INFO: Record<Field, { label: string; hint: string }> = {
		amount: { label: 'Amount (required)', hint: 'e.g. Amount:\\s*(.+)' },
		direction: {
			label: 'Type (required)',
			hint: 'Captures words like Purchase, Deposit, Declined or Refund'
		},
		currency: { label: 'Currency', hint: 'Optional: read from the amount text when empty' },
		merchant: { label: 'Merchant', hint: 'e.g. Merchant:\\s*(.+)' },
		accountHint: { label: 'Card / account digits', hint: 'e.g. Card:\\s*\\**(\\d{4})' },
		occurredAt: { label: 'Date and time', hint: 'Empty: the time the alert was received' },
		reference: { label: 'Reference', hint: 'Used to spot the same alert twice' }
	};

	type Draft = {
		id?: string;
		name: string;
		bankId: string;
		domains: string;
		subjectRegex: string;
		fields: Record<Field, string>;
		enabled: boolean;
	};

	const emptyFields = () =>
		Object.fromEntries(TEMPLATE_FIELDS.map((k) => [k, ''])) as Record<Field, string>;

	const [templates, failed, aiStatus] = $derived(
		await Promise.all([getTemplates(), getAlerts('failed'), getAlertAiStatus()])
	);

	let draft = $state<Draft | null>(null);
	let sample = $state('');
	let saving = $state(false);
	let deleting = $state(false);
	let confirmDelete = $state(false);
	let testing = $state(false);
	let formError = $state('');
	let savedNote = $state('');
	let test = $state<Awaited<ReturnType<typeof testTemplate>> | null>(null);
	let drafting = $state(false);
	let aiNote = $state<{ ok: boolean; text: string } | null>(null);
	/** Bumped when the user opens another template, so a late AI answer for the old one is dropped */
	let draftSession = 0;

	/** Fills the form with an AI draft for the sample. The user reviews, tests and saves it. */
	async function handleAiDraft() {
		if (!sample.trim() || !draft) return;
		const session = draftSession;
		drafting = true;
		formError = '';
		aiNote = null;
		test = null;
		try {
			const out = await draftTemplateAi({ text: sample });
			if (session !== draftSession || !draft) return; // user opened another template or closed it
			draft = {
				id: draft.id, // same session, so this is still the same template (a save may have given it an id)
				name: out.template.name,
				bankId: out.template.bankId,
				domains: out.template.fromDomains.join(', '),
				subjectRegex: out.template.subjectRegex,
				fields: { ...out.template.fields },
				enabled: draft.enabled
			};
			aiNote = out.problems.length
				? {
						ok: false,
						text: `${out.providerLabel} drafted a template, but it does not read the sample correctly yet: ${out.problems.join('; ')}. Fix the fields, then Test.`
					}
				: {
						ok: true,
						text: `${out.providerLabel} drafted a template and it reads the sample correctly. Review each field, press Test, then save.`
					};
		} catch (err) {
			if (session === draftSession) {
				formError = err instanceof Error ? err.message : 'Could not draft a template';
			}
		} finally {
			if (session === draftSession) drafting = false;
		}
	}

	// "Write a template" from an unread alert: start a new template with that alert as the sample.
	// A one-time prefill, so the initial list is enough.
	const sampleId = page.url.searchParams.get('sample');
	if (sampleId) {
		const source = untrack(() => failed).find((a) => a.id === sampleId);
		if (source) {
			sample = source.rawText;
			startNew();
		}
	}

	function startNew() {
		draft = {
			name: '',
			bankId: '',
			domains: '',
			subjectRegex: '',
			fields: emptyFields(),
			enabled: true
		};
		resetMessages();
	}

	function startFromExample() {
		draft = {
			name: 'Example: Island Trust Bank card',
			bankId: SAMPLE_TEMPLATE.bankId,
			domains: SAMPLE_TEMPLATE.match.fromDomains.join(', '),
			subjectRegex: SAMPLE_TEMPLATE.match.subjectRegex ?? '',
			fields: { ...SAMPLE_TEMPLATE.fields },
			enabled: true
		};
		sample = SAMPLE_ALERT_TEXT;
		resetMessages();
	}

	function edit(tpl: TemplateView) {
		draft = {
			id: tpl.id,
			name: tpl.name,
			bankId: tpl.bankId,
			domains: tpl.fromDomains.join(', '),
			subjectRegex: tpl.subjectRegex,
			fields: { ...tpl.fields },
			enabled: tpl.enabled
		};
		resetMessages();
	}

	function resetMessages() {
		draftSession++; // drops a running AI draft for the previous template
		drafting = false;
		formError = '';
		savedNote = '';
		confirmDelete = false;
		test = null;
		aiNote = null;
	}

	function toInput(d: Draft) {
		return {
			name: d.name.trim(),
			bankId: d.bankId.trim(),
			fromDomains: d.domains
				.split(/[\s,]+/)
				.map((s) => s.trim().toLowerCase())
				.filter(Boolean),
			subjectRegex: d.subjectRegex,
			fields: d.fields,
			enabled: d.enabled
		};
	}

	// Live check with the same static guard the server uses
	const problems = $derived(
		draft
			? Object.fromEntries(
					[...TEMPLATE_FIELDS, 'subjectRegex' as const].map((k) => {
						const source = k === 'subjectRegex' ? draft!.subjectRegex : draft!.fields[k];
						return [k, source ? regexProblem(source) : null];
					})
				)
			: {}
	);
	const hasProblems = $derived(Object.values(problems).some(Boolean));
	const canSave = $derived(
		!!draft &&
			!!draft.name.trim() &&
			!!draft.bankId.trim() &&
			!!draft.fields.amount &&
			!!draft.fields.direction &&
			!hasProblems
	);

	async function handleTest() {
		if (!draft || !sample.trim()) return;
		testing = true;
		formError = '';
		try {
			test = await testTemplate({ template: toInput(draft), text: sample });
		} catch (err) {
			formError = err instanceof Error ? err.message : 'Could not test the template';
		} finally {
			testing = false;
		}
	}

	async function handleSave() {
		if (!draft || !canSave) return;
		saving = true;
		formError = '';
		savedNote = '';
		try {
			const saved = await saveTemplate({ ...toInput(draft), id: draft.id });
			draft.id = saved.id;
			savedNote = 'Template saved. Use "Try again" on unread alerts to read them with it.';
		} catch (err) {
			formError = err instanceof Error ? err.message : 'Could not save the template';
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		if (!draft?.id) return;
		deleting = true;
		formError = '';
		try {
			await deleteTemplate(draft.id);
			draft = null;
		} catch (err) {
			formError = err instanceof Error ? err.message : 'Could not delete the template';
		} finally {
			deleting = false;
			confirmDelete = false;
		}
	}
</script>

<svelte:head>
	<title>Alert templates - MC Budget</title>
</svelte:head>

{#snippet testResult(result: ParsedAlert | null)}
	<div class="rounded-box border border-base-300/70 p-4">
		{#if result}
			<ParsedAlertSummary alert={result} />
		{:else}
			<p class="text-sm text-base-content/70">
				No result: amount, type and currency must all be found.
			</p>
		{/if}
	</div>
{/snippet}

<AuthGuard>
	<PageHeader
		title="Alert templates"
		subtitle="A template tells the app where each detail is in your bank's alerts. Each detail is a regular expression; group 1 is the value."
		backHref={resolve('/alerts')}
		backLabel="Bank alerts"
	>
		{#snippet actions()}
			<Button variant="soft" size="sm" onclick={startFromExample}>Start from example</Button>
			<Button size="sm" icon="plus" onclick={startNew}>New template</Button>
		{/snippet}
	</PageHeader>

	<div class="grid gap-6 lg:grid-cols-[16rem_1fr]">
		<aside>
			{#if templates.length === 0}
				<EmptyState
					icon="layers"
					title="No templates yet"
					description="Start from the example, or write one for your bank."
				/>
			{:else}
				<ul class="menu w-full rounded-box border border-base-300/70 bg-base-100 p-1.5">
					{#each templates as tpl (tpl.id)}
						<li>
							<button class={[draft?.id === tpl.id && 'menu-active']} onclick={() => edit(tpl)}>
								<span class="min-w-0 flex-1 truncate">{tpl.name}</span>
								{#if !tpl.enabled}<span class="badge badge-ghost badge-xs">Off</span>{/if}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</aside>

		{#if draft}
			<section class="min-w-0 space-y-5 surface p-5 sm:p-6">
				<div class="grid gap-3 sm:grid-cols-2">
					<Input label="Name" maxlength={100} required bind:value={draft.name} />
					<Input
						label="Bank id"
						maxlength={50}
						required
						hint="Short name, e.g. ncb (letters, digits, -)"
						bind:value={draft.bankId}
					/>
					<Input
						label="Sender domains"
						hint="Comma separated, e.g. ncb.com.jm. Pasted text has no sender, so this only checks emails."
						bind:value={draft.domains}
					/>
					<Input
						label="Subject (optional)"
						class="font-mono"
						error={problems.subjectRegex ?? undefined}
						bind:value={draft.subjectRegex}
					/>
				</div>

				<div class="grid gap-3 sm:grid-cols-2">
					{#each TEMPLATE_FIELDS as key (key)}
						<div class="min-w-0">
							<Input
								label={FIELD_INFO[key].label}
								class="font-mono"
								maxlength={500}
								hint={problems[key] ? undefined : FIELD_INFO[key].hint}
								error={problems[key] ?? undefined}
								bind:value={draft.fields[key]}
							/>
							{#if test?.captures}
								<p class="mt-1 truncate text-xs">
									{#if test.captures[key] !== null}
										<span class="text-success">Found:</span>
										<code>{test.captures[key]}</code>
									{:else if draft.fields[key]}
										<span class="text-warning">Not found</span>
									{/if}
								</p>
							{/if}
						</div>
					{/each}
				</div>

				<label class="flex cursor-pointer items-center gap-2 text-sm">
					<input type="checkbox" class="toggle toggle-sm" bind:checked={draft.enabled} />
					Use this template for new alerts
				</label>

				<div class="space-y-2">
					<label for="sample" class="text-sm font-semibold">Sample alert</label>
					<textarea
						id="sample"
						class="textarea block min-h-32 w-full font-mono text-xs"
						placeholder="Paste a real alert from your bank to test the template"
						maxlength={20000}
						bind:value={sample}
					></textarea>
					<div class="flex flex-wrap items-center gap-2">
						<Button
							variant="soft"
							size="sm"
							icon="check"
							loading={testing}
							disabled={!sample.trim() || hasProblems}
							onclick={handleTest}
						>
							Test
						</Button>
						<Button
							variant="soft"
							size="sm"
							icon="sparkles"
							loading={drafting}
							disabled={!sample.trim() || !aiStatus.providerLabel}
							onclick={handleAiDraft}
						>
							Draft with AI
						</Button>
					</div>
					<p class="text-xs text-base-content/55">
						{#if aiStatus.providerLabel}
							"Draft with AI" sends this sample to {aiStatus.providerLabel} with your own key. You review
							the draft before saving; later alerts are read by the template, not by AI.
						{:else}
							To draft with AI, add your own AI key in
							<a class="link" href={resolve('/settings')}>Settings</a>. Alert text is never sent
							with the shared key.
						{/if}
					</p>
				</div>

				{#if aiNote}
					<Alert type={aiNote.ok ? 'success' : 'warning'}>{aiNote.text}</Alert>
				{/if}
				{#if test}
					{#if test.problems.length}
						<Alert type="error">{test.problems.join('; ')}</Alert>
					{:else}
						{@render testResult(test.result)}
					{/if}
				{/if}
				{#if formError}<Alert type="error">{formError}</Alert>{/if}
				{#if savedNote}<Alert type="success">{savedNote}</Alert>{/if}

				<div class="flex flex-wrap justify-between gap-2 border-t border-base-300/70 pt-4">
					<div>
						{#if draft.id}
							{#if confirmDelete}
								<Button variant="error" size="sm" loading={deleting} onclick={handleDelete}>
									Delete for good
								</Button>
								<Button variant="ghost" size="sm" onclick={() => (confirmDelete = false)}>
									Keep
								</Button>
							{:else}
								<Button
									variant="ghost"
									size="sm"
									icon="trash"
									onclick={() => (confirmDelete = true)}
								>
									Delete
								</Button>
							{/if}
						{/if}
					</div>
					<div class="flex gap-2">
						<Button variant="ghost" onclick={() => (draft = null)}>Close</Button>
						<Button icon="check" loading={saving} disabled={!canSave} onclick={handleSave}>
							Save template
						</Button>
					</div>
				</div>
			</section>
		{:else}
			<EmptyState
				icon="pencil"
				title="Pick a template"
				description="Choose a template on the left, or start a new one."
			/>
		{/if}
	</div>
</AuthGuard>
