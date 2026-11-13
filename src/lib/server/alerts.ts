import { createHash } from 'node:crypto';
import type { ParsedAlert, ParserTemplate } from '$lib/alerts/engine';

type TemplateRecord = {
	id: string;
	bank_id: string;
	from_domains: unknown;
	subject_regex?: string;
	fields: unknown;
};

/** PocketBase `parser_templates` record → engine template. Missing fields become "not used". */
export function toTemplate(record: TemplateRecord): ParserTemplate {
	const raw = (record.fields ?? {}) as Partial<Record<string, unknown>>;
	const field = (key: string) => (typeof raw[key] === 'string' ? (raw[key] as string) : '');
	return {
		id: record.id,
		bankId: record.bank_id,
		match: {
			fromDomains: Array.isArray(record.from_domains)
				? record.from_domains.filter((d): d is string => typeof d === 'string')
				: [],
			subjectRegex: record.subject_regex || undefined
		},
		fields: {
			amount: field('amount'),
			currency: field('currency'),
			direction: field('direction'),
			merchant: field('merchant'),
			accountHint: field('accountHint'),
			occurredAt: field('occurredAt'),
			reference: field('reference')
		}
	};
}

/** Same transaction alert twice (e.g. forwarded and pasted) → same hash. */
export function dedupeHash(userId: string, p: ParsedAlert): string {
	const key = [
		userId,
		p.bankId,
		p.accountHint ?? '',
		p.direction,
		p.amount.toFixed(2),
		p.currency,
		p.occurredAt.slice(0, 16), // to the minute
		p.reference ?? ''
	].join('|');
	return createHash('sha256').update(key).digest('hex');
}

/** Column limits from pb_migrations/13_bank_alerts.js. A longer value would make PocketBase reject the record. */
const ALERT_LIMITS = { bank_id: 50, merchant: 500, account_hint: 50, reference: 200, parser: 50 };

const cut = (value: string | undefined, max: number) => (value ?? '').slice(0, max);

/** ParsedAlert → `alerts` record fields, with text cut to the column limits. */
export function parsedFields(p: ParsedAlert) {
	return {
		bank_id: cut(p.bankId, ALERT_LIMITS.bank_id),
		direction: p.direction,
		amount: p.amount,
		currency: p.currency,
		merchant: cut(p.merchant, ALERT_LIMITS.merchant),
		account_hint: cut(p.accountHint, ALERT_LIMITS.account_hint),
		occurred_at: p.occurredAt,
		reference: cut(p.reference, ALERT_LIMITS.reference),
		parser: cut(p.parser, ALERT_LIMITS.parser),
		confidence: p.confidence
	};
}

const locks = new Map<string, Promise<unknown>>();

/**
 * Runs `fn` after earlier work holding the same key has finished. In-process only: the app runs as
 * one Node server (adapter-node), and PocketBase has no conditional update to do this in the database.
 */
export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
	const run = (locks.get(key) ?? Promise.resolve()).catch(() => {}).then(fn);
	const tail = run.catch(() => {});
	locks.set(key, tail);
	try {
		return await run;
	} finally {
		if (locks.get(key) === tail) locks.delete(key);
	}
}
