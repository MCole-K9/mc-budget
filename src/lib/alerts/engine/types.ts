// Public contract of the alert engine. Other worktrees depend on these names: do not rename.

export type AlertChannel = 'auto-forward' | 'manual-forward' | 'paste' | 'share';

export interface AlertInput {
	channel: AlertChannel;
	from?: string;
	subject?: string;
	text: string;
	html?: string;
	receivedAt: string;
	senderVerified: boolean;
}

export type AlertDirection = 'debit' | 'credit' | 'declined' | 'reversal';

export interface ParsedAlert {
	bankId: string;
	direction: AlertDirection;
	amount: number;
	currency: string;
	merchant?: string;
	accountHint?: string;
	occurredAt: string;
	reference?: string;
	parser: string;
	confidence: 'high' | 'low';
}

/**
 * Each field is an RE2 regex source, run case-insensitive and multiline; capture group 1 is the value.
 * An empty string means "not used". RE2 matches in linear time, so users can write templates safely;
 * it has no backreferences or lookaheads (see validate.ts).
 * Currency must appear in the alert (field or amount text); a bank that prints only a bare `$` cannot be
 * parsed yet. Supporting it needs a contract change (e.g. a `defaultCurrency` field), not a smarter regex.
 */
export interface ParserTemplate {
	id: string;
	bankId: string;
	match: { fromDomains: string[]; subjectRegex?: string };
	fields: Record<
		'amount' | 'currency' | 'merchant' | 'accountHint' | 'occurredAt' | 'reference' | 'direction',
		string
	>;
}
