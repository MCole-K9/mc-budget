import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, command } from '$app/server';
import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';
import { getPb } from '$lib/server/db';
import { dedupeHash, toTemplate } from '$lib/server/alerts';
import {
	draftTemplateWithAi,
	readAlertWithAi,
	resolveUserAiModel,
	safeErrorCode
} from '$lib/server/alertAi';
import { getUserSetting, setUserSetting } from '$lib/server/userSettings';
import {
	MAX_INPUT_CHARS,
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

const MAX_TEMPLATES = 50;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_PARSES = 30;
const parseRateState = new Map<string, number[]>();
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

/** Parses scan up to 100 KB with every template, so cap how often a user can start one. */
function enforceParseRateLimit(userId: string): void {
	enforceRateLimit(
		parseRateState,
		userId,
		RATE_LIMIT_PARSES,
		'Too many alerts at once. Please wait a minute and try again.'
	);
}

const isoDate = (value: unknown) => String(value ?? '').replace(' ', 'T');

async function loadTemplates(pb: PocketBase): Promise<ParserTemplate[]> {
	const records = await pb.collection('parser_templates').getFullList({
		filter: 'enabled = true',
		sort: 'created',
		requestKey: null
	});
	return records.map((r) => toTemplate(r as unknown as Parameters<typeof toTemplate>[0]));
}

function pasteInput(text: string): AlertInput {
	return { channel: 'paste', text, receivedAt: new Date().toISOString(), senderVerified: false };
}

function parsedFields(p: ParsedAlert) {
	return {
		bank_id: p.bankId,
		direction: p.direction,
		amount: p.amount,
		currency: p.currency,
		merchant: p.merchant ?? '',
		account_hint: p.accountHint ?? '',
		occurred_at: p.occurredAt,
		reference: p.reference ?? '',
		parser: p.parser,
		confidence: p.confidence
	};
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

async function findDuplicate(pb: PocketBase, hash: string): Promise<string | null> {
	const found = await pb.collection('alerts').getList(1, 1, {
		filter: pb.filter('dedupe_hash = {:hash}', { hash }),
		fields: 'id',
		requestKey: null
	});
	return found.items[0]?.id ?? null;
}

// ---- Alerts -------------------------------------------------------------------------------

const AlertTextSchema = z.object({
	text: z.string().trim().min(1, 'Paste the alert text').max(MAX_INPUT_CHARS, 'Alert is too long')
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

	const base = { user: userId, channel: input.channel, received_at: input.receivedAt };
	if (!parsed) {
		const record = await pb
			.collection('alerts')
			.create({ ...base, status: 'failed', raw_text: text });
		refreshAlertLists();
		return { status: 'failed' as const, id: record.id };
	}

	const hash = dedupeHash(userId, parsed);
	const duplicate = await findDuplicate(pb, hash);
	if (duplicate) return { status: 'duplicate' as const, id: duplicate };

	const record = await pb.collection('alerts').create({
		...base,
		status: 'pending',
		raw_text: '',
		dedupe_hash: hash,
		...parsedFields(parsed)
	});
	refreshAlertLists();
	return { status: 'pending' as const, id: record.id };
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

	// Claim the alert first so a double click cannot create two transactions
	await pb.collection('alerts').update(alert.id, { status: 'confirmed' });
	let transactionId: string;
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
		await pb.collection('alerts').update(alert.id, { status: 'pending' });
		throw err;
	}
	await pb.collection('alerts').update(alert.id, { transaction: transactionId, raw_text: '' });

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
	return { transactionId };
});

/** Dismisses an alert without a transaction and drops its raw text. */
export const ignoreAlert = command(z.string().min(1), async (id) => {
	requireUserId();
	const pb = getPb();
	const alert = await pb.collection('alerts').getOne(id, { requestKey: null });
	if (alert.status === 'confirmed') error(409, 'This alert is already a transaction');
	await pb.collection('alerts').update(id, { status: 'ignored', raw_text: '' });
	refreshAlertLists();
	return { success: true };
});

/** Tries the current templates on an unread ("failed") alert again, e.g. after adding a template. */
export const reparseAlert = command(z.string().min(1), async (id) => {
	const userId = requireUserId();
	enforceParseRateLimit(userId);
	const pb = getPb();
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
	if (!parsed) return { status: 'failed' as const };

	const hash = dedupeHash(userId, parsed);
	if (await findDuplicate(pb, hash)) {
		await pb.collection('alerts').update(id, { status: 'ignored', raw_text: '' });
		refreshAlertLists();
		return { status: 'duplicate' as const };
	}
	await pb.collection('alerts').update(id, {
		status: 'pending',
		raw_text: '',
		dedupe_hash: hash,
		...parsedFields(parsed)
	});
	refreshAlertLists();
	return { status: 'pending' as const };
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
			const existing = await pb
				.collection('parser_templates')
				.getList(1, 1, { fields: 'id', requestKey: null });
			if (existing.totalItems >= MAX_TEMPLATES) {
				error(400, `You can have up to ${MAX_TEMPLATES} templates`);
			}
			record = await pb.collection('parser_templates').create(data);
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
	text: z.string().min(1, 'Paste a sample alert').max(MAX_INPUT_CHARS)
});

type FieldCaptures = Record<(typeof TEMPLATE_FIELDS)[number], string | null>;

/** Runs a draft template on a sample: what each field captured, and the final result. Saves nothing. */
export const testTemplate = command(TestTemplateSchema, async ({ template, text }) => {
	const userId = requireUserId();
	enforceParseRateLimit(userId);
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
	z.object({ text: z.string().trim().min(1, 'Paste a sample alert').max(MAX_INPUT_CHARS) }),
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
