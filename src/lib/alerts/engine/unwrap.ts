import type { AlertInput } from './types';
import { normalizeDate } from './normalize';

const MAX_DEPTH = 5; // forward of a forward of a …

// A line that opens a forwarded message. The original header block (From/Date/Subject/To) follows it.
const MARKERS = [
	/^[ \t>]*-{3,}[ \t]*Forwarded message[ \t]*-{3,}[ \t]*$/i, // Gmail, Yahoo, Proton
	/^[ \t>]*Begin forwarded message:[ \t]*$/i, // Apple Mail
	/^[ \t>]*-{3,}[ \t]*Original Message[ \t]*-{3,}[ \t]*$/i // Outlook (classic)
];
// Outlook's separator line. Banks use plain "____" dividers too, so it counts only with a "Sent:" header.
const OUTLOOK_RULE = /^[ \t>]*_{10,}[ \t]*$/;
const FROM_LINE = /^[ \t>]*From:/i;
const HEADER_LINE = /^[ \t>]*([A-Za-z-]+):[ \t]*(.*)$/;
const HEADER_KEYS = new Set(['from', 'date', 'sent', 'subject', 'to', 'cc', 'bcc', 'reply-to']);

// TODO: forward-as-attachment (message/rfc822) is unpacked upstream by the MIME parser, not here.

/**
 * Strips forward wrappers and recovers the original From, Subject and Date. Uses html only when text is empty.
 * A recovered From is just text in the body, so an unwrapped alert is never sender-verified.
 */
export function unwrapForward(input: AlertInput): AlertInput {
	const text = (input.text.trim() ? input.text : htmlToText(input.html ?? '')).replace(
		/\r\n?/g,
		'\n'
	);
	let result: AlertInput = { ...input, text };

	for (let depth = 0; depth < MAX_DEPTH; depth++) {
		const fwd = findForward(result.text);
		if (!fwd) break;
		const { from, subject, date, sent } = fwd.headers;
		result = {
			...result,
			// Name-only From → no sender (fields decide). A malformed address stays raw so templates reject it.
			from: emailAddress(from) ?? (from.includes('@') ? from : undefined),
			subject: subject ?? result.subject,
			text: fwd.body,
			html: undefined,
			receivedAt: normalizeDate(date ?? sent) ?? result.receivedAt,
			senderVerified: false
		};
	}
	return result;
}

function findForward(text: string): { headers: Record<string, string>; body: string } | null {
	const lines = text.split('\n');
	for (let i = 0; i < lines.length; i++) {
		const marker = MARKERS.some((re) => re.test(lines[i]));
		const rule = !marker && OUTLOOK_RULE.test(lines[i]);
		if (!marker && !rule && !FROM_LINE.test(lines[i])) continue;
		const block = readHeaders(lines, marker || rule ? i + 1 : i);
		const { from, sent } = block.headers;
		// Outlook needs "Sent:"; without the separator line it also needs a real address, so a direct
		// transfer alert ("From: Savings ****1234 … Sent: …") is not taken for a forward.
		if (from && (marker || (sent && (rule || emailAddress(from))))) {
			return { headers: block.headers, body: unquote(lines.slice(block.end).join('\n')).trim() };
		}
		// A later start inside this block would read the same headers, so skip it (keeps this linear).
		i = Math.max(i, block.end - 1);
	}
	return null;
}

function readHeaders(lines: string[], start: number) {
	let i = start;
	while (i < lines.length && /^[\s>]*$/.test(lines[i])) i++; // blank, or a quoted blank (">")
	const headers: Record<string, string> = {};
	for (; i < lines.length; i++) {
		const m = lines[i].match(HEADER_LINE);
		const key = m?.[1].toLowerCase();
		if (!m || !key || !HEADER_KEYS.has(key)) break;
		headers[key] ??= m[2].trim();
	}
	return { headers, end: i };
}

/** Removes "> " quoting when every non-empty line is quoted (Proton, some clients). */
function unquote(body: string): string {
	const lines = body.split('\n');
	const filled = lines.filter((l) => l.trim());
	if (!filled.length || !filled.every((l) => /^\s*>/.test(l))) return body;
	return lines.map((l) => l.replace(/^\s*> ?/, '')).join('\n');
}

const ADDRESS = /^[\w.+'-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){1,8}$/;

/**
 * The sender mailbox, or undefined. Fails closed: the value must hold exactly one `@` and be a bare
 * address, or end in one `<mailbox>` / Outlook `[mailto:mailbox]`
 * (`Bank Alerts <Alerts@Bank.example>` → `alerts@bank.example`). From lists, and addresses in display
 * names, comments or quoted local parts, give undefined.
 */
export function emailAddress(value?: string): string | undefined {
	if (!value || value.split('@').length !== 2) return undefined;
	const tail = value.match(/(?:<([^<>]*)>|\[mailto:([^[\]]*)\])\s*$/i);
	const mailbox = tail ? (tail[1] ?? tail[2]) : /[<[]/.test(value) ? '' : value;
	return mailbox.trim().match(ADDRESS)?.[0].toLowerCase();
}

const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' '
};

/**
 * Removes <script>, <style>, <head> and <title> blocks in one forward pass (a regex here is quadratic on
 * unclosed tags). A tag name with no closing tag (HTML5 may omit </head>) is skipped from then on.
 */
function dropBlocks(html: string): string {
	const lower = html.toLowerCase();
	const open = /<(script|style|head|title)\b/g;
	const unclosed = new Set<string>();
	let out = '';
	let pos = 0;
	for (let m = open.exec(lower); m; m = open.exec(lower)) {
		if (unclosed.has(m[1])) continue;
		// Whole tag name only: "</head" must not match "</header".
		const closeTag = new RegExp(`</${m[1]}(?=[\\s/>]|$)`, 'g');
		closeTag.lastIndex = open.lastIndex;
		const close = closeTag.exec(lower)?.index ?? -1;
		if (close === -1) {
			unclosed.add(m[1]); // each name scans to the end at most once, so this stays linear
			continue;
		}
		const end = lower.indexOf('>', close);
		out += html.slice(pos, m.index);
		pos = end === -1 ? html.length : end + 1;
		open.lastIndex = pos;
	}
	return out + html.slice(pos);
}

/** Plain text from an HTML mail body. Output is text only: never render it as HTML. */
function htmlToText(html: string): string {
	return dropBlocks(html)
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|tr|li|h[1-6]|table|blockquote)\s*>/gi, '\n')
		.replace(/<\/t[dh]\s*>/gi, ' ')
		.replace(/<[^<>]*>/g, '')
		.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
			if (code[0] !== '#') return ENTITIES[code.toLowerCase()] ?? entity;
			const cp = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : +code.slice(1);
			return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : entity;
		})
		.split('\n')
		.map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}
