import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import {
	parseAlert,
	applyTemplate,
	unwrapForward,
	providerForEmail,
	MAX_INPUT_CHARS,
	type AlertInput,
	type ParserTemplate
} from './index';
import { normalizeAmount, normalizeCurrency, normalizeDate, normalizeDirection } from './normalize';
import {
	SAMPLE_ALERT_HTML,
	SAMPLE_ALERT_TEXT,
	SAMPLE_BANK_FROM,
	SAMPLE_SUBJECT,
	SAMPLE_TEMPLATE
} from './fixtures/bank';
import { FORWARDS } from './fixtures/forwards';

const RECEIVED = '2026-11-12T16:00:00.000Z';

const input = (over: Partial<AlertInput> = {}): AlertInput => ({
	channel: 'auto-forward',
	from: SAMPLE_BANK_FROM,
	subject: SAMPLE_SUBJECT,
	text: SAMPLE_ALERT_TEXT,
	receivedAt: RECEIVED,
	senderVerified: true,
	...over
});

const withFields = (fields: Partial<ParserTemplate['fields']>): ParserTemplate => ({
	...SAMPLE_TEMPLATE,
	fields: { ...SAMPLE_TEMPLATE.fields, ...fields }
});

describe('unwrapForward', () => {
	it.each(Object.keys(FORWARDS))('recovers the original alert from a %s forward', (provider) => {
		const out = unwrapForward(
			input({
				channel: 'manual-forward',
				from: 'someone@example.com',
				subject: 'Fwd: x',
				text: FORWARDS[provider]
			})
		);
		expect(out.from).toBe('noreply@alerts.islandtrust.example');
		expect(out.subject).toBe(SAMPLE_SUBJECT);
		expect(out.receivedAt).toBe('2026-11-12T15:16:00.000Z');
		expect(out.text).toBe(SAMPLE_ALERT_TEXT);
		expect(out.senderVerified).toBe(false);
	});

	it('unwraps a forward of a forward to the innermost original', () => {
		const nested = `---------- Forwarded message ---------
From: Friend <friend@example.com>
Date: Fri, Nov 13, 2026 at 9:00 AM
Subject: Fwd: Transaction Alert

${FORWARDS.outlook}`;
		const out = unwrapForward(input({ text: nested }));
		expect(out.from).toBe('noreply@alerts.islandtrust.example');
		expect(out.text).toBe(SAMPLE_ALERT_TEXT);
	});

	it('leaves a direct alert unchanged', () => {
		const out = unwrapForward(input());
		expect(out).toEqual(input());
	});

	it('does not treat a lone "From:" line as an Outlook forward', () => {
		const text = 'From: savings account\nTo: chequing account\n\nAmount: JMD 500.00';
		expect(unwrapForward(input({ text })).text).toBe(text);
	});

	it('does not treat a "____" divider in a direct alert as an Outlook forward', () => {
		const text =
			'Transaction Type: Transfer\nDate: 12-Nov-2026 10:15:32\n______________________________\nFrom: Savings ****1234\nTo: Chequing ****5678\nAmount: JMD 5,000.00';
		const out = unwrapForward(input({ text }));
		expect(out).toMatchObject({ text, from: SAMPLE_BANK_FROM, senderVerified: true });
	});

	it('does not treat a direct transfer alert with From/Sent lines as an Outlook forward', () => {
		const text =
			'Transaction Type: Transfer\nFrom: Savings ****1234\nTo: Chequing ****5678\nSent: 12 Nov 2026 10:15\nAmount: JMD 500.00';
		const out = unwrapForward(input({ text }));
		expect(out).toMatchObject({ text, from: SAMPLE_BANK_FROM, senderVerified: true });
	});

	it('unwraps a forward that is quoted line by line, blank lines included', () => {
		const quoted = FORWARDS.apple
			.split('\n')
			.map((l) => `> ${l}`.trimEnd())
			.join('\n');
		const out = unwrapForward(input({ from: 'someone@example.com', text: quoted }));
		expect(out.from).toBe('noreply@alerts.islandtrust.example');
		expect(out.text).toBe(SAMPLE_ALERT_TEXT);
	});

	it('scans a long run of header-like lines once (no quadratic rescans)', () => {
		const text = 'From: x\n'.repeat(12_000); // ~96 KB; took >10 s before the fix
		const start = performance.now();
		expect(unwrapForward(input({ text })).text).toBe(text);
		expect(performance.now() - start).toBeLessThan(1_000);
	});

	it('uses the html body only when text is empty', () => {
		const out = unwrapForward(input({ text: '  ', html: SAMPLE_ALERT_HTML }));
		expect(out.text).toContain('Transaction Type: POS Purchase');
		expect(out.text).toContain('Merchant: SUNNY MART & DELI');
		expect(out.text).toContain('Thank you.');
		expect(out.text).not.toMatch(/<|color: red/);
	});

	it('drops title and style even when </head> is left out', () => {
		const html =
			'<html><head><title>Alert</title><style>.x{color:red}</style><body><p>Transaction Type: POS Purchase</p>';
		expect(unwrapForward(input({ text: '', html })).text).toBe('Transaction Type: POS Purchase');
	});

	it('does not take </header> for the end of an unclosed <head>', () => {
		const html =
			'<html><head><style>p{}</style><body><p>Transaction Type: POS Purchase</p><header>x</header>';
		expect(unwrapForward(input({ text: '', html })).text).toContain(
			'Transaction Type: POS Purchase'
		);
	});
});

describe('normalizeAmount', () => {
	it.each([
		['1,234.56', 1234.56],
		['JMD$1,234.56', 1234.56],
		['USD 12.00', 12],
		['J$ 5,000', 5000],
		['$.50', 0.5],
		['0.005', 0.01]
	])('%s → %s', (raw, want) => expect(normalizeAmount(raw)).toBe(want));

	it.each([undefined, '', 'n/a', '0.00', '0.004', '1' + '0'.repeat(400)])('%s → null', (raw) => {
		expect(normalizeAmount(raw)).toBeNull();
	});
});

describe('normalizeCurrency', () => {
	it.each([
		['J$', 'JMD'],
		['JA$', 'JMD'],
		['jmd', 'JMD'],
		['JMD$1,234.56', 'JMD'],
		['US$', 'USD'],
		['USD 12.00', 'USD'],
		['1,000.00 TTD', 'TTD'],
		['20.00 EUR', 'EUR'],
		['USD 12.00 (JMD 1,890.00)', 'USD']
	])('%s → %s', (raw, want) => expect(normalizeCurrency(raw)).toBe(want));

	it.each([undefined, '$', '$1,000.00', '$25.00 at the mall', '$25.00 POS'])(
		'%s → null (unknown)',
		(raw) => {
			expect(normalizeCurrency(raw)).toBeNull();
		}
	);
});

describe('normalizeDirection', () => {
	it.each([
		['POS Purchase', 'debit'],
		['Credit card purchase', 'debit'],
		['ATM Withdrawal', 'debit'],
		['ATM Deposit', 'credit'],
		['POS', 'debit'],
		['Your account was debited', 'debit'],
		['Direct Deposit', 'credit'],
		['Account credited', 'credit'],
		['Payment received', 'credit'],
		['Purchase DECLINED', 'declined'],
		['Transaction reversal', 'reversal'],
		['Refund', 'reversal'],
		['Purchase to avoid', 'debit']
	])('%s → %s', (raw, want) => expect(normalizeDirection(raw)).toBe(want));

	it('returns null for unknown words', () => {
		expect(normalizeDirection('Balance enquiry')).toBeNull();
	});
});

describe('normalizeDate', () => {
	it.each([
		['12-Nov-2026 10:15:32', '2026-11-12T15:15:32.000Z'],
		['12/11/2026 10:15', '2026-11-12T15:15:00.000Z'], // day-first
		['2026-11-12T10:15:00Z', '2026-11-12T10:15:00.000Z'],
		['2026-11-12T10:15:00-04:00', '2026-11-12T14:15:00.000Z'],
		['Nov 12, 2026 at 12:05 AM', '2026-11-12T05:05:00.000Z'],
		['November 12th, 2026 12:30 p.m.', '2026-11-12T17:30:00.000Z'],
		['12 November 2026 at 10:16:00 EDT', '2026-11-12T14:16:00.000Z'],
		['12 Nov 2026', '2026-11-12T05:00:00.000Z'],
		// A dotted time is not read, but it must not replace the date.
		['12 Nov 2026 10.15.32', '2026-11-12T05:00:00.000Z'],
		['12 Nov 2026 10.05.32', '2026-11-12T05:00:00.000Z'],
		['12-Nov-2026 09.12.45', '2026-11-12T05:00:00.000Z'],
		['12 Nov 2026 10:16 GMT-5', '2026-11-12T15:16:00.000Z'],
		['12 Nov 2026 10:16 AM (GMT-05:00)', '2026-11-12T15:16:00.000Z'],
		['12 Nov 2026 10:16 (UTC-05:00) Bogota', '2026-11-12T15:16:00.000Z'],
		['12 Nov 2026 10:16 GMT', '2026-11-12T10:16:00.000Z'],
		['10.05.32 12/11/2026', '2026-11-12T05:00:00.000Z'],
		['12/11/26', '2026-11-12T05:00:00.000Z']
	])('%s → %s', (raw, want) => expect(normalizeDate(raw)).toBe(want));

	it.each([undefined, 'yesterday', '31/02/2026', '12 Foo 2026', '2026-11-12 25:00'])(
		'%s → null',
		(raw) => expect(normalizeDate(raw)).toBeNull()
	);
});

describe('applyTemplate', () => {
	it('parses the sample alert', () => {
		expect(applyTemplate(input(), SAMPLE_TEMPLATE)).toEqual({
			bankId: 'islandtrust',
			direction: 'debit',
			amount: 1234.56,
			currency: 'JMD',
			merchant: 'SUNNY MART KINGSTON',
			accountHint: '1234',
			occurredAt: '2026-11-12T15:15:32.000Z',
			reference: 'ITB000111222',
			parser: 'islandtrust-card-v1',
			confidence: 'high'
		});
	});

	it('matches sender subdomains, case-insensitively', () => {
		const out = applyTemplate(
			input({ from: 'NoReply@Mail.Alerts.IslandTrust.example' }),
			SAMPLE_TEMPLATE
		);
		expect(out?.amount).toBe(1234.56);
	});

	it.each([
		'noreply@islandtrust.example.evil.test',
		'noreply@notislandtrust.example',
		'noreply@islandtrust.example_x.evil.test',
		'noreply@alerts.islandtrust.example.évil.test',
		'x@a.b.c.d.e.f.g.islandtrust.example.evil.test'
	])('returns null for the look-alike sender %s', (from) => {
		expect(applyTemplate(input({ from }), SAMPLE_TEMPLATE)).toBeNull();
	});

	it('uses the <mailbox>, not an address in the display name', () => {
		const bank = '"noreply@alerts.islandtrust.example"';
		for (const mailbox of ['attacker@evil.test', "o'hara@evil.test", '"a b"@evil.test', '']) {
			expect(applyTemplate(input({ from: `${bank} <${mailbox}>` }), SAMPLE_TEMPLATE)).toBeNull();
		}
	});

	it.each([
		'"Bank <noreply@alerts.islandtrust.example>" <attacker@evil.test>',
		'(noreply@alerts.islandtrust.example) attacker@evil.test',
		'"noreply@alerts.islandtrust.example"@evil.test',
		'<attacker@evil.test> "<noreply@alerts.islandtrust.example>"',
		'Attacker <attacker@evil.test>, Bank <noreply@alerts.islandtrust.example>'
	])('never takes the sender from a display name, comment or quote: %s', (from) => {
		expect(applyTemplate(input({ from }), SAMPLE_TEMPLATE)).toBeNull();
	});

	it('returns null when the subject does not match', () => {
		expect(
			applyTemplate(input({ subject: 'Your statement is ready' }), SAMPLE_TEMPLATE)
		).toBeNull();
	});

	it('matches pasted text with no sender on its fields alone', () => {
		const out = applyTemplate(
			input({ channel: 'paste', from: undefined, subject: undefined }),
			SAMPLE_TEMPLATE
		);
		expect(out).toMatchObject({ amount: 1234.56, confidence: 'low' });
	});

	it('returns null when amount, direction or currency is missing', () => {
		expect(applyTemplate(input(), withFields({ amount: 'Total:\\s*(.+)' }))).toBeNull();
		expect(applyTemplate(input(), withFields({ direction: '' }))).toBeNull();
		const bareDollar = input({ text: SAMPLE_ALERT_TEXT.replace('JMD$', '$') });
		expect(applyTemplate(bareDollar, SAMPLE_TEMPLATE)).toBeNull();
	});

	it('falls back to the amount text for currency and to receivedAt for the date', () => {
		const out = applyTemplate(input(), withFields({ currency: '', occurredAt: '' }));
		expect(out).toMatchObject({ currency: 'JMD', occurredAt: RECEIVED });
	});

	it('leaves optional fields undefined when not configured', () => {
		const out = applyTemplate(
			input(),
			withFields({ merchant: '', reference: '', accountHint: '' })
		);
		expect(out).toMatchObject({
			merchant: undefined,
			reference: undefined,
			accountHint: undefined
		});
	});

	it('rejects oversized regexes, invalid regexes and oversized input', () => {
		expect(applyTemplate(input(), withFields({ merchant: 'a'.repeat(501) }))).toBeNull();
		expect(applyTemplate(input(), withFields({ amount: '(unclosed' }))).toBeNull();
		const big = input({ text: SAMPLE_ALERT_TEXT + ' '.repeat(MAX_INPUT_CHARS) });
		expect(applyTemplate(big, SAMPLE_TEMPLATE)).toBeNull();
		expect(applyTemplate(input({ from: 'a'.repeat(2000) }), SAMPLE_TEMPLATE)).toBeNull();
		expect(
			applyTemplate(input({ subject: 'Transaction Alert' + ' '.repeat(2000) }), SAMPLE_TEMPLATE)
		).toBeNull();
	});
});

describe('parseAlert', () => {
	it.each(Object.keys(FORWARDS))('parses a %s manual forward', (provider) => {
		const out = parseAlert(
			input({
				channel: 'manual-forward',
				from: 'someone@example.com',
				subject: 'Fwd: x',
				text: FORWARDS[provider]
			}),
			[SAMPLE_TEMPLATE]
		);
		expect(out).toMatchObject({
			amount: 1234.56,
			currency: 'JMD',
			direction: 'debit',
			confidence: 'low'
		});
	});

	it('parses an html-only alert', () => {
		const out = parseAlert(input({ text: '', html: SAMPLE_ALERT_HTML }), [SAMPLE_TEMPLATE]);
		expect(out).toMatchObject({ merchant: 'SUNNY MART & DELI', amount: 1234.56 });
	});

	it.each([
		['auto-forward', true, 'high'],
		['auto-forward', false, 'low'],
		['manual-forward', true, 'low'],
		['paste', true, 'low'],
		['share', true, 'low']
	] as const)('confidence for %s, verified=%s is %s', (channel, senderVerified, want) => {
		expect(parseAlert(input({ channel, senderVerified }), [SAMPLE_TEMPLATE])?.confidence).toBe(
			want
		);
	});

	it('gives low confidence when no sender was checked', () => {
		expect(parseAlert(input({ from: '' }), [SAMPLE_TEMPLATE])?.confidence).toBe('low');
	});

	it('never gives high confidence to a sender recovered from the body', () => {
		const spoof = input({ from: 'x@attacker.test', subject: 'hi', text: FORWARDS.gmail });
		expect(parseAlert(spoof, [SAMPLE_TEMPLATE])?.confidence).toBe('low');
	});

	it('parses a forward whose From line has a name but no address', () => {
		const text = FORWARDS.outlook.replace(SAMPLE_BANK_FROM, 'Island Trust Bank');
		const out = parseAlert(
			input({ channel: 'manual-forward', from: 'someone@example.com', text }),
			[SAMPLE_TEMPLATE]
		);
		expect(out).toMatchObject({ amount: 1234.56, confidence: 'low' });
	});

	it('rejects a forward whose From address is a look-alike', () => {
		const text = FORWARDS.gmail.replace(
			SAMPLE_BANK_FROM,
			'Bank <noreply@alerts.islandtrust.example_x.evil.test>'
		);
		const out = parseAlert(
			input({ channel: 'manual-forward', from: 'someone@example.com', text }),
			[SAMPLE_TEMPLATE]
		);
		expect(out).toBeNull();
	});

	it('reads a classic Outlook "[mailto:…]" From', () => {
		const text = FORWARDS.gmail.replace(
			SAMPLE_BANK_FROM,
			'Island Trust Bank [mailto:noreply@alerts.islandtrust.example]'
		);
		expect(unwrapForward(input({ text })).from).toBe('noreply@alerts.islandtrust.example');
	});

	it('uses the first template that parses', () => {
		const other: ParserTemplate = {
			...SAMPLE_TEMPLATE,
			id: 'other',
			match: { fromDomains: ['other.example'] }
		};
		const broken = { ...withFields({ direction: '' }), id: 'broken' };
		const second = { ...SAMPLE_TEMPLATE, id: 'second' };
		expect(parseAlert(input(), [other, broken, second, SAMPLE_TEMPLATE])?.parser).toBe('second');
	});

	it('returns null when no template matches', () => {
		expect(parseAlert(input(), [])).toBeNull();
		expect(parseAlert(input({ text: 'Hello there' }), [SAMPLE_TEMPLATE])).toBeNull();
	});

	it('rejects oversized html before unwrapping', () => {
		const html = `<p>${'x'.repeat(MAX_INPUT_CHARS)}</p>`;
		expect(parseAlert(input({ text: '', html }), [SAMPLE_TEMPLATE])).toBeNull();
	});
});

describe('providerForEmail', () => {
	it('finds providers by domain', () => {
		expect(providerForEmail('Some.One@Hotmail.com')?.id).toBe('outlook');
		expect(providerForEmail('someone@me.com')?.id).toBe('icloud');
	});

	it('returns undefined for custom or unknown domains', () => {
		expect(providerForEmail('someone@company.example')).toBeUndefined();
		expect(providerForEmail('not an email')).toBeUndefined();
	});
});

describe('package boundary', () => {
	// The engine may depend on npm packages listed here, never on app code ($lib, $app, …)
	const ALLOWED_PACKAGES = ['re2js'];

	it('imports nothing from outside the engine folder', () => {
		const files = ['', 'fixtures']
			.flatMap((dir) => readdirSync(join(__dirname, dir)).map((f) => join(dir, f)))
			.filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
		expect(files.length).toBeGreaterThan(5);
		for (const file of files) {
			const source = readFileSync(join(__dirname, file), 'utf8');
			const specifiers = [
				...source.matchAll(/(?<![\w'"])(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)
			].map((m) => m[1]);
			for (const spec of specifiers) {
				if (ALLOWED_PACKAGES.includes(spec)) continue;
				const target = resolve(dirname(join(__dirname, file)), spec);
				expect(
					spec.startsWith('.') && target.startsWith(__dirname + sep),
					`${file} imports ${spec}`
				).toBe(true);
			}
		}
	});
});
