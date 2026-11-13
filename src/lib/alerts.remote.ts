import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, command } from '$app/server';
import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';
import { env as privateEnv } from '$env/dynamic/private';
import { getPb } from '$lib/server/db';
import { newInboxToken } from '$lib/server/inboundEmail';
import {
	dedupeHash,
	findDuplicateAlert,
	loadUserTemplates,
	MAX_TEMPLATES,
	parsedFields,
	saveAlert,
	toTemplate,
	withLock
} from '$lib/server/alerts';
import {
	draftTemplateWithAi,
	readAlertWithAi,
	resolveUserAiModel,
	safeErrorCode
} from '$lib/server/alertAi';
import { getUserSetting, setUserSetting } from '$lib/server/userSettings';
import {
	TEMPLATE_FIELDS,
	applyTemplate,
	capture,
	parseAlert,
	senderMatches,
	templateProblems,
	unwrapForward,
	type AlertDirection,
	type AlertInput,
	type ParsedAlert,
	type ParserTemplate
} from '$lib/alerts/engine';
import { WalletSchema } from '$lib/schemas/budget';
import { getWallet } from '$lib/wallets.remote';
import { getTransactions } from '$lib/transactions.remote';

// Parse budget: every parse runs each enabled template (up to 8 RE2 regexes) over the text, synchronously.
// Bank alerts are short, so 20,000 chars x 20 templates x 10 parses/min keeps one user from stalling the server.
const MAX_PASTE_CHARS = 20_000;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_PARSES = 10;
const parseRateState = new Map<string, number[]>();
const RATE_LIMIT_TESTS = 30;
const testRateState = new Map<string, number[]>();
const RATE_LIMIT_AI_DRAFTS = 5;
const aiRateState = new Map<string, number[]>();

export type AlertStatus = 'pending' | 'failed' | 'confirmed' | 'ignored';

export type AlertView = {
	id: string;
	status: AlertStatus;
	receivedAt: string;
	/** Kept only while no template can read the alert */
	rawText: string;
	parsed: ParsedAlert | null;
	transaction: string;
	/** Wallet linked to this bank + card, if the user saved one */
	suggestedWallet: string;
};

export type TemplateView = {
	id: string;
	name: string;
	bankId: string;
	fromDomains: string[];
	subjectRegex: string;
	fields: ParserTemplate['fields'];
	enabled: boolean;
};

function requireUserId(): string {
	const userId = getPb().authStore.record?.id;
	if (!userId) error(401, 'Not authenticated');
	return userId;
}

/** Counts one use; false when the user already reached `max` in the last minute. */
function takeRateLimit(state: Map<string, number[]>, userId: string, max: number): boolean {
	const now = Date.now();
	const recent = (state.get(userId) ?? []).filter((ts) => ts > now - RATE_LIMIT_WINDOW_MS);
	if (recent.length >= max) return false;
	recent.push(now);
	state.set(userId, recent);
	return true;
}

function enforceRateLimit(
	state: Map<string, number[]>,
	userId: string,
	max: number,
	message: string
): void {
	if (!takeRateLimit(state, userId, max)) error(429, message);
}

/** user_settings key: 'on' lets the user's own AI read alerts that no template can read. */
const AI_FALLBACK_SETTING = 'alert_ai_fallback';

/**
 * Templates first. When none can read the alert and the user turned the AI fallback on, their own
 * AI reads it (always low confidence, so it stays Pending). Any AI failure keeps the alert unread.
 */
async function readAlert(
	userId: string,
	input: AlertInput,
	templates: ParserTemplate[]
): Promise<ParsedAlert | null> {
	const parsed = parseAlert(input, templates);
	if (parsed) return parsed;
	if ((await getUserSetting(AI_FALLBACK_SETTING)) !== 'on') return null;
	if (!takeRateLimit(aiRateState, userId, RATE_LIMIT_AI_DRAFTS)) return null;
	const ai = await resolveUserAiModel();
	if (!ai) return null;
	try {
		return await readAlertWithAi(input, ai);
	} catch (err) {
		console.error(`AI alert fallback failed (own key, code ${safeErrorCode(err)})`);
		return null;
	}
}

/** A parse runs every template over up to MAX_PASTE_CHARS, so cap how often a user can start one. */
function enforceParseRateLimit(userId: string): void {
	enforceRateLimit(
		parseRateState,
		userId,
		RATE_LIMIT_PARSES,
		'Too many alerts at once. Please wait a minute and try again.'
	);
}

const isoDate = (value: unknown) => String(value ?? '').replace(' ', 'T');

/** The signed-in user's enabled templates (at most MAX_TEMPLATES, which bounds the work per parse). */
function loadTemplates(pb: PocketBase): Promise<ParserTemplate[]> {
	return loadUserTemplates(pb, requireUserId(), MAX_TEMPLATES);
}

function pasteInput(text: string): AlertInput {
	return { channel: 'paste', text, receivedAt: new Date().toISOString(), senderVerified: false };
}

function toAlertView(r: RecordModel, links: Map<string, string>): AlertView {
	const parsed: ParsedAlert | null = r.bank_id
		? {
				bankId: r.bank_id,
				direction: r.direction as AlertDirection,
				amount: Number(r.amount),
				currency: r.currency,
				merchant: r.merchant || undefined,
				accountHint: r.account_hint || undefined,
				occurredAt: isoDate(r.occurred_at),
				reference: r.reference || undefined,
				parser: r.parser,
				confidence: r.confidence === 'high' ? 'high' : 'low'
			}
		: null;
	return {
		id: r.id,
		status: r.status as AlertStatus,
		receivedAt: isoDate(r.received_at),
		rawText: r.raw_text ?? '',
		parsed,
		transaction: r.transaction ?? '',
		suggestedWallet: parsed ? (links.get(`${parsed.bankId}|${parsed.accountHint}`) ?? '') : ''
	};
}

// ---- Alerts -------------------------------------------------------------------------------

const AlertTextSchema = z.object({
	text: z
		.string()
		.trim()
		.min(1, 'Paste the alert text')
		.max(MAX_PASTE_CHARS, 'Alert is too long (max 20,000 characters)')
});

/** Parses pasted text without saving it. */
export const previewAlert = command(AlertTextSchema, async ({ text }) => {
	const userId = requireUserId();
	enforceParseRateLimit(userId);
	const templates = await loadTemplates(getPb());
	return { parsed: parseAlert(pasteInput(text), templates) };
});

/**
 * Saves a pasted alert. Read by a template → Pending (raw text dropped).
 * Not readable → "failed", raw text kept so the user can write a template for it.
 */
export const submitAlert = command(AlertTextSchema, async ({ text }) => {
	const userId = requireUserId();
	enforceParseRateLimit(userId);
	const pb = getPb();
	const input = pasteInput(text);
	const templates = await loadTemplates(pb);
	const parsed = await readAlert(userId, input, templates);
	const saved = await saveAlert(pb, userId, input, parsed);
	if (saved.status !== 'duplicate') refreshAlertLists();
	return saved;
});

const AlertListSchema = z.enum(['pending', 'failed', 'done']);

export const getAlerts = query(AlertListSchema, async (list) => {
	requireUserId();
	const pb = getPb();
	const filter =
		list === 'done'
			? "status = 'confirmed' || status = 'ignored'"
			: pb.filter('status = {:list}', { list });
	const [records, links] = await Promise.all([
		pb.collection('alerts').getList(1, 50, { filter, sort: '-received_at', requestKey: null }),
		pb.collection('account_links').getFullList({ requestKey: null })
	]);
	const linkMap = new Map(links.map((l) => [`${l.bank_id}|${l.account_hint}`, String(l.wallet)]));
	return records.items.map((r) => toAlertView(r, linkMap));
});

export const getPendingAlertCount = query(async () => {
	requireUserId();
	const result = await getPb().collection('alerts').getList(1, 1, {
		filter: "status = 'pending'",
		fields: 'id',
		requestKey: null
	});
	return result.totalItems;
});

function refreshAlertLists() {
	getAlerts('pending').refresh();
	getAlerts('failed').refresh();
	getAlerts('done').refresh();
	getPendingAlertCount().refresh();
}

const ConfirmAlertSchema = z.object({
	id: z.string().min(1),
	walletId: z.string().min(1, 'Choose a wallet'),
	isExpense: z.boolean(),
	category: z.string().trim().max(100),
	amount: z.number().gt(0, 'Amount must be greater than 0'),
	description: z.string().trim().max(500),
	date: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid date'),
	rememberWallet: z.boolean()
});

/** Turns a Pending alert into a normal transaction (source "alert") after the user reviews it. */
export const confirmAlert = command(ConfirmAlertSchema, async (input) => {
	const userId = requireUserId();
	const pb = getPb();

	// Same alert twice (two tabs, a retry) or two alerts into one wallet at once: run one after the
	// other, and read the alert status and wallet balance only inside the locks.
	const { alert, wallet } = await withLock(`alert:${input.id}`, () =>
		withLock(`wallet:${input.walletId}`, async () => {
			// Owner-only rules: another user's alert or wallet id gives 404 here
			const alert = await pb.collection('alerts').getOne(input.id, { requestKey: null });
			if (alert.status !== 'pending') error(409, 'This alert was already handled');
			if (alert.direction === 'declined') {
				error(400, 'A declined payment moved no money. Ignore it instead.');
			}
			const wallet = WalletSchema.parse(
				await pb.collection('wallets').getOne(input.walletId, { requestKey: null })
			);

			const category = input.isExpense ? input.category : input.category || 'Income';
			const known = wallet.categories.some((c) => c.name.toLowerCase() === category.toLowerCase());
			if (input.isExpense && !known) {
				error(400, `Category "${category}" does not exist in ${wallet.name}`);
			}
			const amount = input.isExpense ? -input.amount : input.amount;

			await pb.collection('alerts').update(alert.id, { status: 'confirmed' });
			let transactionId = '';
			try {
				const tx = await pb.collection('transactions').create({
					wallet: wallet.id,
					category,
					amount,
					description: input.description,
					date: input.date,
					source: 'alert'
				});
				transactionId = tx.id;
				await pb.collection('wallets').update(wallet.id, {
					balance: wallet.balance + amount,
					...(amount > 0 && { total_funded: wallet.total_funded + amount })
				});
			} catch (err) {
				// Undo, so a retry cannot leave two transactions behind. If the transaction cannot be
				// removed, keep the alert confirmed and linked to it, so a retry is impossible.
				const removed =
					!transactionId ||
					(await pb
						.collection('transactions')
						.delete(transactionId)
						.then(() => true)
						.catch(() => false));
				if (!removed) {
					await pb
						.collection('alerts')
						.update(alert.id, { transaction: transactionId, raw_text: '' });
					error(
						500,
						`The transaction was added, but ${wallet.name}'s balance was not updated. Use "Recalculate balance" on the wallet.`
					);
				}
				await pb.collection('alerts').update(alert.id, { status: 'pending' });
				throw err;
			}
			await pb.collection('alerts').update(alert.id, { transaction: transactionId, raw_text: '' });
			return { alert, wallet };
		})
	);

	if (input.rememberWallet && alert.bank_id && alert.account_hint) {
		const existing = await pb.collection('account_links').getList(1, 1, {
			filter: pb.filter('bank_id = {:bank} && account_hint = {:hint}', {
				bank: alert.bank_id,
				hint: alert.account_hint
			}),
			requestKey: null
		});
		const link = {
			user: userId,
			bank_id: alert.bank_id,
			account_hint: alert.account_hint,
			wallet: wallet.id
		};
		if (existing.items[0]) await pb.collection('account_links').update(existing.items[0].id, link);
		else await pb.collection('account_links').create(link);
	}

	refreshAlertLists();
	getTransactions(wallet.id).refresh();
	getWallet(wallet.id).refresh();
	return { success: true };
});

/** Dismisses an alert without a transaction and drops its raw text. */
export const ignoreAlert = command(z.string().min(1), async (id) => {
	requireUserId();
	const pb = getPb();
	// Same lock as confirmAlert, so an ignore cannot overwrite a confirm that is running
	await withLock(`alert:${id}`, async () => {
		const alert = await pb.collection('alerts').getOne(id, { requestKey: null });
		if (alert.status === 'confirmed') error(409, 'This alert is already a transaction');
		await pb.collection('alerts').update(id, { status: 'ignored', raw_text: '' });
	});
	refreshAlertLists();
	return { success: true };
});

/** Tries the current templates on an unread ("failed") alert again, e.g. after adding a template. */
export const reparseAlert = command(z.string().min(1), async (id) => {
	const userId = requireUserId();
	enforceParseRateLimit(userId);
	const pb = getPb();
	const status = await withLock(`alert:${id}`, async () => {
		const alert = await pb.collection('alerts').getOne(id, { requestKey: null });
		if (alert.status !== 'failed' || !alert.raw_text) {
			error(409, 'Only unread alerts can be tried again');
		}

		const templates = await loadTemplates(pb);
		const input: AlertInput = {
			channel: alert.channel,
			text: alert.raw_text,
			receivedAt: isoDate(alert.received_at),
			senderVerified: false
		};
		const parsed = await readAlert(userId, input, templates);
		if (!parsed) return 'failed' as const;

		const hash = dedupeHash(userId, parsed);
		if (await findDuplicateAlert(pb, userId, hash)) {
			await pb.collection('alerts').update(id, { status: 'ignored', raw_text: '' });
			return 'duplicate' as const;
		}
		await pb.collection('alerts').update(id, {
			status: 'pending',
			raw_text: '',
			dedupe_hash: hash,
			...parsedFields(parsed)
		});
		return 'pending' as const;
	});
	refreshAlertLists();
	return { status };
});

// ---- Parser templates ---------------------------------------------------------------------

const RegexText = z.string().max(500).default('');

const TemplateInputSchema = z.object({
	name: z.string().trim().min(1, 'Name is required').max(100),
	bankId: z
		.string()
		.trim()
		.min(1, 'Bank id is required')
		.max(50)
		.regex(/^[a-z0-9-]+$/i, 'Bank id: letters, digits and "-" only'),
	fromDomains: z.array(z.string().trim().toLowerCase().min(1).max(253)).max(20),
	subjectRegex: RegexText,
	fields: z.object({
		amount: RegexText,
		currency: RegexText,
		direction: RegexText,
		merchant: RegexText,
		accountHint: RegexText,
		occurredAt: RegexText,
		reference: RegexText
	}),
	enabled: z.boolean().default(true)
});

type TemplateInput = z.infer<typeof TemplateInputSchema>;

function draftTemplate(input: TemplateInput): ParserTemplate {
	return {
		id: 'draft',
		bankId: input.bankId,
		match: { fromDomains: input.fromDomains, subjectRegex: input.subjectRegex || undefined },
		fields: input.fields
	};
}

function toTemplateView(r: RecordModel): TemplateView {
	const tpl = toTemplate(r as unknown as Parameters<typeof toTemplate>[0]);
	return {
		id: r.id,
		name: r.name,
		bankId: tpl.bankId,
		fromDomains: tpl.match.fromDomains,
		subjectRegex: tpl.match.subjectRegex ?? '',
		fields: tpl.fields,
		enabled: r.enabled === true
	};
}

export const getTemplates = query(async () => {
	requireUserId();
	const records = await getPb()
		.collection('parser_templates')
		.getFullList({ sort: 'created', requestKey: null });
	return records.map(toTemplateView);
});

/** Creates or updates a template. Unsafe or broken regexes are refused (see engine/validate.ts). */
export const saveTemplate = command(
	TemplateInputSchema.extend({ id: z.string().optional() }),
	async ({ id, ...input }) => {
		const userId = requireUserId();
		const problems = templateProblems(draftTemplate(input));
		if (problems.length) error(400, problems.join('; '));

		const pb = getPb();
		const data = {
			user: userId,
			name: input.name,
			bank_id: input.bankId,
			from_domains: input.fromDomains,
			subject_regex: input.subjectRegex,
			fields: input.fields,
			enabled: input.enabled
		};
		let record: RecordModel;
		if (id) {
			record = await pb.collection('parser_templates').update(id, data);
		} else {
			// Count and create under one lock, so parallel saves cannot pass the limit together
			record = await withLock(`templates:${userId}`, async () => {
				const existing = await pb
					.collection('parser_templates')
					.getList(1, 1, { fields: 'id', requestKey: null });
				if (existing.totalItems >= MAX_TEMPLATES) {
					error(400, `You can have up to ${MAX_TEMPLATES} templates`);
				}
				return pb.collection('parser_templates').create(data);
			});
		}
		getTemplates().refresh();
		return toTemplateView(record);
	}
);

export const deleteTemplate = command(z.string().min(1), async (id) => {
	requireUserId();
	await getPb().collection('parser_templates').delete(id);
	getTemplates().refresh();
	return { success: true };
});

const TestTemplateSchema = z.object({
	template: TemplateInputSchema,
	text: z.string().min(1, 'Paste a sample alert').max(MAX_PASTE_CHARS)
});

type FieldCaptures = Record<(typeof TEMPLATE_FIELDS)[number], string | null>;

/** Runs a draft template on a sample: what each field captured, and the final result. Saves nothing. */
export const testTemplate = command(TestTemplateSchema, async ({ template, text }) => {
	const userId = requireUserId();
	// One template per test (not all of them), so editing gets a looser budget than parsing
	enforceRateLimit(
		testRateState,
		userId,
		RATE_LIMIT_TESTS,
		'Too many tests at once. Please wait a minute and try again.'
	);
	const tpl = draftTemplate(template);
	const problems = templateProblems(tpl);
	if (problems.length) {
		return { problems, senderOk: false, captures: null, result: null };
	}

	const alert = unwrapForward(pasteInput(text));
	const captures = Object.fromEntries(
		TEMPLATE_FIELDS.map((k) => [k, capture(alert.text, tpl.fields[k]) ?? null])
	) as FieldCaptures;
	return {
		problems,
		senderOk: senderMatches(alert, tpl),
		captures: captures as FieldCaptures | null,
		result: applyTemplate(alert, tpl)
	};
});

// ---- AI template drafts (opt-in, the user's own key only) --------------------------------

/** Which AI would draft templates: only the user's own key counts. */
export const getAlertAiStatus = query(async () => {
	requireUserId();
	const [ai, fallback] = await Promise.all([
		resolveUserAiModel(),
		getUserSetting(AI_FALLBACK_SETTING)
	]);
	return { providerLabel: ai?.label ?? null, fallbackEnabled: fallback === 'on' };
});

/** Turns the AI fallback for unread alerts on or off (off by default). Needs the user's own key. */
export const setAlertAiFallback = command(z.boolean(), async (enabled) => {
	requireUserId();
	if (enabled && !(await resolveUserAiModel())) {
		error(
			400,
			'Add your own AI key in Settings first. Alert text is never sent with the shared key.'
		);
	}
	await setUserSetting(AI_FALLBACK_SETTING, enabled ? 'on' : 'off');
	getAlertAiStatus().refresh();
	return { enabled };
});

/**
 * Sends one alert to the user's own AI provider to draft a template, checked by re-parsing the
 * alert. Saves nothing: the editor shows the draft for review.
 */
export const draftTemplateAi = command(
	z.object({ text: z.string().trim().min(1, 'Paste a sample alert').max(MAX_PASTE_CHARS) }),
	async ({ text }) => {
		const userId = requireUserId();
		enforceRateLimit(
			aiRateState,
			userId,
			RATE_LIMIT_AI_DRAFTS,
			'Too many AI drafts. Please wait a minute and try again.'
		);
		const ai = await resolveUserAiModel();
		if (!ai) {
			error(
				400,
				'Add your own AI key in Settings first. Alert text is never sent with the shared key.'
			);
		}
		try {
			return await draftTemplateWithAi(text, ai);
		} catch (err) {
			console.error(`AI template draft failed (own key, code ${safeErrorCode(err)})`);
			error(502, `${ai.label} could not draft a template. Check your key, or try again.`);
		}
	}
);

// ---- Forward address (email in) -----------------------------------------------------------

export type AlertInboxView = {
	/** False when this server has no INBOUND_EMAIL_DOMAIN / INBOUND_EMAIL_SECRET */
	available: boolean;
	address: string | null;
	enabled: boolean;
	confirmLink: string;
	confirmText: string;
	confirmAt: string;
};

async function findInbox(pb: PocketBase, userId: string) {
	const found = await pb.collection('alert_inboxes').getList(1, 1, {
		filter: pb.filter('user = {:user}', { user: userId }),
		requestKey: null
	});
	return found.items[0] ?? null;
}

const inboundDomain = () =>
	privateEnv.INBOUND_EMAIL_SECRET ? (privateEnv.INBOUND_EMAIL_DOMAIN ?? '').toLowerCase() : '';

export const getAlertInbox = query(async (): Promise<AlertInboxView> => {
	const userId = requireUserId();
	const domain = inboundDomain();
	const inbox = domain ? await findInbox(getPb(), userId) : null;
	return {
		available: !!domain,
		address: inbox ? `${inbox.token}@${domain}` : null,
		enabled: inbox?.enabled === true,
		confirmLink: inbox?.confirm_link ?? '',
		confirmText: inbox?.confirm_text ?? '',
		confirmAt: inbox?.confirm_at ? isoDate(inbox.confirm_at) : ''
	};
});

/** Creates the user's forward address, or replaces it with a new one (the old one stops working). */
export const newAlertInboxAddress = command(async () => {
	const userId = requireUserId();
	if (!inboundDomain()) error(400, 'Email forwarding is not set up on this server');
	const pb = getPb();
	await withLock(`inbox:${userId}`, async () => {
		const inbox = await findInbox(pb, userId);
		const fresh = { token: newInboxToken(), enabled: true, confirm_text: '', confirm_link: '' };
		if (inbox) await pb.collection('alert_inboxes').update(inbox.id, fresh);
		else await pb.collection('alert_inboxes').create({ user: userId, ...fresh });
	});
	getAlertInbox().refresh();
	return { success: true };
});

export const setAlertInboxEnabled = command(z.boolean(), async (enabled) => {
	const userId = requireUserId();
	const pb = getPb();
	const inbox = await findInbox(pb, userId);
	if (!inbox) error(404, 'Create a forward address first');
	await pb.collection('alert_inboxes').update(inbox.id, { enabled });
	getAlertInbox().refresh();
	return { enabled };
});
