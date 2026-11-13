import type { AlertInput, ParsedAlert, ParserTemplate } from './types';
import { normalizeAmount, normalizeCurrency, normalizeDate, normalizeDirection } from './normalize';
import { emailAddress } from './unwrap';

// ReDoS limits: cap both sides of every regex run. Caps reduce but do not prevent catastrophic
// backtracking (e.g. `(a+)+$`), so templates must be trusted (reviewed by us), not user-written.
export const MAX_INPUT_CHARS = 100_000;
const MAX_HEADER_CHARS = 1_000;
const MAX_REGEX_CHARS = 500;

/** True when any input field is too large to run regexes on. */
export function exceedsLimits(input: AlertInput): boolean {
	return (
		input.text.length > MAX_INPUT_CHARS ||
		(input.html?.length ?? 0) > MAX_INPUT_CHARS ||
		(input.from?.length ?? 0) > MAX_HEADER_CHARS ||
		(input.subject?.length ?? 0) > MAX_HEADER_CHARS
	);
}

/** High only for mail that arrived by auto-forward from a verified sender (and a sender was checked). */
function confidenceFor(input: AlertInput): ParsedAlert['confidence'] {
	return input.senderVerified && input.channel === 'auto-forward' && input.from ? 'high' : 'low';
}

function compile(source: string): RegExp | null {
	try {
		return new RegExp(source, 'im');
	} catch {
		return null;
	}
}

/** Capture group 1 (or the whole match) of the field regex, whitespace collapsed. Empty source = unused field. */
function capture(text: string, source: string): string | undefined {
	if (!source) return undefined;
	const m = compile(source)?.exec(text);
	return (m?.[1] ?? m?.[0])?.replace(/\s+/g, ' ').trim() || undefined;
}

function senderMatches(input: AlertInput, tpl: ParserTemplate): boolean {
	// Pasted or shared text has no sender: the field regexes alone decide.
	if (!input.from) return true;
	const domain = emailAddress(input.from)?.split('@')[1];
	const domainOk =
		!!domain &&
		tpl.match.fromDomains.some((d) => {
			const want = d.toLowerCase();
			return domain === want || domain.endsWith(`.${want}`);
		});
	if (!domainOk) return false;
	if (!tpl.match.subjectRegex) return true;
	return compile(tpl.match.subjectRegex)?.test(input.subject ?? '') ?? false;
}

/** Runs one parser template on an (already unwrapped) alert. Null when it does not match or misses amount, direction or currency. */
export function applyTemplate(input: AlertInput, tpl: ParserTemplate): ParsedAlert | null {
	const text = input.text;
	if (exceedsLimits(input)) return null;
	const sources = [...Object.values(tpl.fields), tpl.match.subjectRegex ?? ''];
	if (sources.some((s) => s.length > MAX_REGEX_CHARS)) return null;
	if (!senderMatches(input, tpl)) return null;

	const field = (key: keyof ParserTemplate['fields']) => capture(text, tpl.fields[key]);
	const amountRaw = field('amount');
	const amount = normalizeAmount(amountRaw);
	const direction = normalizeDirection(field('direction'));
	const currency = normalizeCurrency(field('currency')) ?? normalizeCurrency(amountRaw);
	if (amount === null || !direction || !currency) return null;

	return {
		bankId: tpl.bankId,
		direction,
		amount,
		currency,
		merchant: field('merchant'),
		accountHint: field('accountHint'),
		occurredAt: normalizeDate(field('occurredAt')) ?? input.receivedAt,
		reference: field('reference'),
		parser: tpl.id,
		confidence: confidenceFor(input)
	};
}
