import { RE2JS } from 're2js';
import type { ParserTemplate } from './types';

export const MAX_REGEX_CHARS = 500;

export const TEMPLATE_FIELDS = [
	'amount',
	'currency',
	'direction',
	'merchant',
	'accountHint',
	'occurredAt',
	'reference'
] as const satisfies readonly (keyof ParserTemplate['fields'])[];

const FLAGS = RE2JS.CASE_INSENSITIVE | RE2JS.MULTILINE | RE2JS.LOOKBEHINDS;

/**
 * Compiles a template regex with RE2 (case-insensitive, multiline). RE2 matches in linear time,
 * so a user-written template cannot cause catastrophic backtracking (ReDoS), whatever its shape.
 * RE2 has no backreferences or lookaheads; lookbehinds work when they have no capture groups.
 * Throws on invalid or unsupported syntax.
 */
export function compileTemplateRegex(source: string): RE2JS {
	if (source.length > MAX_REGEX_CHARS) {
		throw new Error(`longer than ${MAX_REGEX_CHARS} characters`);
	}
	let re = compiled.get(source);
	if (!re) {
		re = RE2JS.compile(source, FLAGS);
		if (compiled.size >= MAX_CACHED) compiled.clear();
		compiled.set(source, re);
	}
	return re;
}

// Each parse checks then runs every template regex, so cache compiled patterns (bounded).
const MAX_CACHED = 1_000;
const compiled = new Map<string, RE2JS>();

/** Why a template regex cannot be used, or null when it compiles. */
export function regexProblem(source: string): string | null {
	try {
		compileTemplateRegex(source);
		return null;
	} catch (err) {
		return err instanceof Error ? err.message.replace(/^error parsing regexp: /, '') : 'invalid';
	}
}

/** Everything wrong with a template, as readable messages. Empty = usable. */
export function templateProblems(tpl: ParserTemplate): string[] {
	const problems: string[] = [];
	if (!tpl.bankId.trim()) problems.push('bank id is required');
	if (!tpl.fields.amount) problems.push('amount: a regex is required');
	if (!tpl.fields.direction) problems.push('direction: a regex is required');
	const sources: [string, string][] = [
		...TEMPLATE_FIELDS.map((k): [string, string] => [k, tpl.fields[k] ?? '']),
		['subject', tpl.match.subjectRegex ?? '']
	];
	for (const [name, source] of sources) {
		const problem = source ? regexProblem(source) : null;
		if (problem) problems.push(`${name}: ${problem}`);
	}
	for (const domain of tpl.match.fromDomains) {
		if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain)) {
			problems.push(`sender domain "${domain}" is not valid`);
		}
	}
	return problems;
}
