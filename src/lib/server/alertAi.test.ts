import { describe, it, expect } from 'vitest';
import { checkDraft, toParsedAlert, type AiRead, type Expected } from './alertAi';
import {
	SAMPLE_ALERT_TEXT,
	SAMPLE_BANK_FROM,
	SAMPLE_SUBJECT,
	SAMPLE_TEMPLATE
} from '$lib/alerts/engine/fixtures/bank';

const alert = {
	channel: 'paste' as const,
	text: SAMPLE_ALERT_TEXT,
	receivedAt: '2026-11-12T16:00:00.000Z',
	senderVerified: false
};

const expected: Expected = { amount: 1234.56, currency: 'JMD', direction: 'debit', merchant: '' };

describe('checkDraft', () => {
	it('accepts a draft that reads the alert as the AI described it', () => {
		expect(checkDraft(alert, SAMPLE_TEMPLATE, expected)).toEqual([]);
		expect(checkDraft(alert, SAMPLE_TEMPLATE, { ...expected, currency: 'jmd' })).toEqual([]);
	});

	it('names each value that differs from what the alert says', () => {
		const problems = checkDraft(alert, SAMPLE_TEMPLATE, {
			...expected,
			amount: 1234,
			currency: 'USD',
			direction: 'credit'
		});
		expect(problems).toHaveLength(3);
		expect(problems.join('\n')).toMatch(/amount[\s\S]*currency[\s\S]*type/);
	});

	it('rejects a draft that reads nothing, or that RE2 cannot run', () => {
		const blind = {
			...SAMPLE_TEMPLATE,
			fields: { ...SAMPLE_TEMPLATE.fields, amount: 'Total:\\s*(.+)' }
		};
		expect(checkDraft(alert, blind, expected)).toHaveLength(1);
		const lookahead = {
			...SAMPLE_TEMPLATE,
			fields: { ...SAMPLE_TEMPLATE.fields, amount: 'Amount:(?=\\s)(.+)' }
		};
		expect(checkDraft(alert, lookahead, expected)[0]).toMatch(/^amount:/);
	});

	it('rejects a subject regex that does not match the forwarded subject', () => {
		const forwarded = { ...alert, from: SAMPLE_BANK_FROM, subject: SAMPLE_SUBJECT };
		const wrongSubject = {
			...SAMPLE_TEMPLATE,
			match: { ...SAMPLE_TEMPLATE.match, subjectRegex: '^Statement' }
		};
		expect(checkDraft(forwarded, SAMPLE_TEMPLATE, expected)).toEqual([]);
		expect(checkDraft(forwarded, wrongSubject, expected)).toHaveLength(1);
	});
});

describe('toParsedAlert', () => {
	const read: AiRead = {
		isTransactionAlert: true,
		bankId: 'Island Trust',
		direction: 'debit',
		amount: 'JMD$1,234.56',
		currency: 'J$',
		merchant: '  SUNNY   MART ',
		accountHint: '****1234',
		occurredAt: '12-Nov-2026 10:15:32',
		reference: ''
	};
	const received = '2026-11-12T16:00:00.000Z';

	it('normalises the AI answer and always gives low confidence', () => {
		expect(toParsedAlert(read, received)).toEqual({
			bankId: 'island-trust',
			direction: 'debit',
			amount: 1234.56,
			currency: 'JMD',
			merchant: 'SUNNY MART',
			accountHint: '1234',
			occurredAt: '2026-11-12T15:15:32.000Z',
			reference: undefined,
			parser: 'ai',
			confidence: 'low'
		});
	});

	it('falls back to the received time and to the amount text for currency', () => {
		const out = toParsedAlert({ ...read, occurredAt: 'yesterday', currency: '' }, received);
		expect(out).toMatchObject({ occurredAt: received, currency: 'JMD' });
	});

	it.each([
		['not an alert', { isTransactionAlert: false }],
		['no amount', { amount: 'n/a' }],
		['zero amount', { amount: '0.00' }],
		['unknown currency (bare $)', { amount: '$12.00', currency: '$' }]
	])('returns null for %s', (_, change) => {
		expect(toParsedAlert({ ...read, ...change }, received)).toBeNull();
	});
});
