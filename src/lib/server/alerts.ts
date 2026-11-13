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
