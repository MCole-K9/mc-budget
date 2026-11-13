// Bank alert engine: pure and stateless. Imports no app code (only the re2js package), so it can
// move to its own package.
import type { AlertInput, ParsedAlert, ParserTemplate } from './types';
import { applyTemplate, exceedsLimits } from './template';
import { unwrapForward } from './unwrap';

export type * from './types';
export { applyTemplate, capture, senderMatches, MAX_INPUT_CHARS } from './template';
export { regexProblem, templateProblems, TEMPLATE_FIELDS, MAX_REGEX_CHARS } from './validate';
export { unwrapForward } from './unwrap';
export { normalizeAmount, normalizeCurrency, normalizeDate } from './normalize';
export { PROVIDERS, providerForEmail, type MailProvider } from './providers';

/** Unwraps a forwarded alert, then returns the result of the first parser template that matches. */
export function parseAlert(input: AlertInput, templates: ParserTemplate[]): ParsedAlert | null {
	if (exceedsLimits(input)) return null;
	const alert = unwrapForward(input);
	for (const tpl of templates) {
		const parsed = applyTemplate(alert, tpl);
		if (parsed) return parsed;
	}
	return null;
}
