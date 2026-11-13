import { describe, it, expect } from 'vitest';
import { regexProblem, templateProblems } from './validate';
import { applyTemplate } from './template';
import {
	SAMPLE_ALERT_TEXT,
	SAMPLE_BANK_FROM,
	SAMPLE_SUBJECT,
	SAMPLE_TEMPLATE
} from './fixtures/bank';

describe('regexProblem', () => {
	it.each([
		'(a)\\1', // backreference: not in RE2
		'(?<x>a)\\k<x>',
		'(?=x)a', // lookahead: not in RE2
		'a(?!x)',
		'(?<=(C)ard: )\\d+', // lookbehind with a capture group
		'(unclosed',
		'a'.repeat(501)
	])('rejects %s', (source) => {
		expect(regexProblem(source)).not.toBeNull();
	});

	it('runs patterns that backtrack catastrophically in JS in linear time', () => {
		const hostile = 'a'.repeat(100_000) + '!';
		const input = {
			channel: 'paste' as const,
			text: hostile,
			receivedAt: '2026-11-12T00:00:00.000Z',
			senderVerified: false
		};
		for (const source of ['(a+)+$', '(a|aa)+$', 'a*a*a*$', '(.*a){12}']) {
			expect(regexProblem(source)).toBeNull();
			const tpl = { ...SAMPLE_TEMPLATE, fields: { ...SAMPLE_TEMPLATE.fields, amount: source } };
			const start = performance.now();
			applyTemplate(input, tpl);
			expect(performance.now() - start, source).toBeLessThan(2_000);
		}
	});

	it.each([
		...Object.values(SAMPLE_TEMPLATE.fields),
		'^Transaction Alert',
		'(?:Purchase|Withdrawal) of',
		'Amount:\\s*([A-Z]{3}\\$?\\s*[\\d,]+\\.\\d{2})',
		'(\\d{4})',
		'(ab)?c',
		'(?<=Card: )\\d+',
		'[(+*]+',
		'\\(+'
	])('accepts %s', (source) => {
		expect(regexProblem(source)).toBeNull();
	});
});

describe('templateProblems', () => {
	it('accepts the sample template', () => {
		expect(templateProblems(SAMPLE_TEMPLATE)).toEqual([]);
	});

	it('names each broken field', () => {
		const problems = templateProblems({
			...SAMPLE_TEMPLATE,
			bankId: ' ',
			match: { fromDomains: ['not a domain'], subjectRegex: '(?=x)' },
			fields: { ...SAMPLE_TEMPLATE.fields, amount: '', merchant: '(x)\\1' }
		});
		expect(problems).toHaveLength(5);
		expect(problems.join('\n')).toMatch(
			/bank id[\s\S]*amount[\s\S]*merchant[\s\S]*subject[\s\S]*domain/
		);
	});

	it('makes applyTemplate skip a template RE2 cannot run', () => {
		const input = {
			channel: 'paste' as const,
			from: SAMPLE_BANK_FROM,
			subject: SAMPLE_SUBJECT,
			text: SAMPLE_ALERT_TEXT,
			receivedAt: '2026-11-12T00:00:00.000Z',
			senderVerified: false
		};
		const unsafe = {
			...SAMPLE_TEMPLATE,
			fields: { ...SAMPLE_TEMPLATE.fields, reference: 'ITB(?=\\d)' }
		};
		expect(applyTemplate(input, SAMPLE_TEMPLATE)).not.toBeNull();
		expect(applyTemplate(input, unsafe)).toBeNull();
	});
});
