import { describe, it, expect } from 'vitest';
import { dedupeHash, toTemplate } from './alerts';
import type { ParsedAlert } from '$lib/alerts/engine';

describe('toTemplate', () => {
	it('maps a record and treats bad shapes as unused', () => {
		const tpl = toTemplate({
			id: 'r1',
			bank_id: 'islandtrust',
			from_domains: ['islandtrust.example', 3],
			subject_regex: '',
			fields: { amount: 'Amount:\\s*(.+)', direction: 7 }
		});
		expect(tpl).toEqual({
			id: 'r1',
			bankId: 'islandtrust',
			match: { fromDomains: ['islandtrust.example'], subjectRegex: undefined },
			fields: {
				amount: 'Amount:\\s*(.+)',
				currency: '',
				direction: '',
				merchant: '',
				accountHint: '',
				occurredAt: '',
				reference: ''
			}
		});
	});
});

describe('dedupeHash', () => {
	const base: ParsedAlert = {
		bankId: 'b',
		direction: 'debit',
		amount: 10,
		currency: 'JMD',
		occurredAt: '2026-11-12T15:15:32.000Z',
		parser: 'p',
		confidence: 'low'
	};

	it('is stable to the minute and per user', () => {
		const later = { ...base, occurredAt: '2026-11-12T15:15:59.000Z', parser: 'other' };
		expect(dedupeHash('u1', later)).toBe(dedupeHash('u1', base));
		expect(dedupeHash('u2', base)).not.toBe(dedupeHash('u1', base));
		expect(dedupeHash('u1', { ...base, amount: 10.01 })).not.toBe(dedupeHash('u1', base));
	});
});
