import { describe, it, expect } from 'vitest';
import { dedupeHash, parsedFields, toTemplate, withLock } from './alerts';
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

describe('parsedFields', () => {
	const fieldsBase: ParsedAlert = {
		bankId: 'b'.repeat(80),
		direction: 'debit',
		amount: 1,
		currency: 'JMD',
		merchant: 'm'.repeat(800),
		accountHint: '1'.repeat(80),
		reference: 'r'.repeat(300),
		occurredAt: '2026-11-12T15:15:32.000Z',
		parser: 'p',
		confidence: 'low'
	};

	it('cuts text to the PocketBase column limits', () => {
		const fields = parsedFields(fieldsBase);
		expect([
			fields.bank_id.length,
			fields.merchant.length,
			fields.account_hint.length,
			fields.reference.length
		]).toEqual([50, 500, 50, 200]);
		expect(parsedFields({ ...fieldsBase, merchant: undefined }).merchant).toBe('');
	});
});

describe('withLock', () => {
	const tick = () => new Promise((r) => setTimeout(r, 5));

	it('runs work on the same key one after the other, even after a failure', async () => {
		const order: string[] = [];
		const job =
			(name: string, fail = false) =>
			async () => {
				order.push(`${name}:start`);
				await tick();
				order.push(`${name}:end`);
				if (fail) throw new Error(name);
				return name;
			};
		const results = await Promise.allSettled([
			withLock('k', job('a', true)),
			withLock('k', job('b')),
			withLock('other', job('c'))
		]);
		expect(results.map((r) => r.status)).toEqual(['rejected', 'fulfilled', 'fulfilled']);
		expect(order.indexOf('b:start')).toBeGreaterThan(order.indexOf('a:end'));
		expect(order.indexOf('c:start')).toBeLessThan(order.indexOf('a:end'));
	});
});
