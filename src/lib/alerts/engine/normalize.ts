import type { AlertDirection } from './types';

/** Times without a zone are read as Jamaica time (UTC-05:00, no daylight saving). */
const DEFAULT_UTC_OFFSET_MINUTES = -300;

/** First number in the text, e.g. `JMD$1,234.56` → 1234.56. Returns null for missing, zero (after rounding) or overflow. */
export function normalizeAmount(raw?: string): number | null {
	const match = raw?.match(/\d[\d,]*(?:\.\d+)?|\.\d+/);
	if (!match) return null;
	const value = Math.round(Number(match[0].replace(/,/g, '')) * 100) / 100;
	return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * `J$`/`JA$`/`JMD` → JMD, `US$`/`USD` → USD, plus a few other ISO codes. Anything else (a bare `$`) is unknown.
 * The first currency token wins: `USD 12.00 (JMD 1,890.00)` is USD.
 */
export function normalizeCurrency(raw?: string): string | null {
	const token = raw
		?.toUpperCase()
		.match(/(?:^|[^A-Z])(JMD|JA?\$|USD|US\$|CAD|GBP|EUR|TTD)(?![A-Z])/)?.[1];
	if (!token) return null;
	if (token.startsWith('J')) return 'JMD';
	if (token.startsWith('US')) return 'USD';
	return token;
}

// Order matters: "declined purchase" is declined, "credit card purchase" is a debit, "ATM deposit" is a credit.
const DIRECTION_RULES: [AlertDirection, RegExp][] = [
	['declined', /declin|denied|reject|unsuccessful|failed/i],
	['reversal', /revers|refund|\bvoid|chargeback/i],
	['debit', /purchase|withdraw|spent|charged/i],
	['credit', /credit|deposit|received|incoming|lodg/i],
	['debit', /debit|payment|transfer|charge|paid|\bpos\b|\batm\b/i]
];

export function normalizeDirection(raw?: string): AlertDirection | null {
	if (!raw) return null;
	return DIRECTION_RULES.find(([, re]) => re.test(raw))?.[0] ?? null;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const ZONES: Record<string, number> = {
	Z: 0,
	UTC: 0,
	GMT: 0,
	EST: -300,
	EDT: -240,
	CST: -360,
	CDT: -300,
	PST: -480,
	PDT: -420
};

const monthIndex = (name: string) => MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;

const plausible = (m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= 31;

function findDate(s: string): { y: number; m: number; d: number } | null {
	const iso = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
	if (iso && plausible(+iso[2], +iso[3])) return { y: +iso[1], m: +iso[2], d: +iso[3] };

	// Month names are unambiguous, so they go before numeric dates (a dotted time "10.05.32" looks like one).
	for (const r of s.matchAll(/(\d{1,2})(?:st|nd|rd|th)?[ -]+([A-Za-z]{3,9})\.?[ ,-]+(\d{4})/g)) {
		const m = monthIndex(r[2]);
		if (m) return { y: +r[3], m, d: +r[1] };
	}
	for (const r of s.matchAll(/([A-Za-z]{3,9})\.?[ -]+(\d{1,2})(?:st|nd|rd|th)?,?[ -]+(\d{4})/g)) {
		const m = monthIndex(r[1]);
		if (m) return { y: +r[3], m, d: +r[2] };
	}

	// Numeric dates are day-first (Jamaican convention): 12/11/2026 is 12 November.
	// Four-digit years first; a two-digit year needs "/" or "-", because "10.05.32" is a dotted time.
	for (const re of [
		/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g,
		/\b(\d{1,2})([/-])(\d{1,2})\2(\d{2})\b/g
	]) {
		for (const r of s.matchAll(re)) {
			const [d, m, y] = r.length === 4 ? [+r[1], +r[2], +r[3]] : [+r[1], +r[3], 2000 + +r[4]];
			if (plausible(m, d)) return { y, m, d };
		}
	}
	return null;
}

/** Zone right after the time: `-05:00`, `-0500`, `GMT-5`, `(UTC-05:00)`, `Z`, `EST`. Minutes east of UTC. */
function findZone(tail: string): number | null {
	const offset = tail.match(/^\s*\(?(?:(?:GMT|UTC)\s*)?([+-])(\d{1,2})(?::?(\d{2}))?/);
	if (offset && +offset[2] <= 14) {
		return (offset[1] === '-' ? -1 : 1) * (+offset[2] * 60 + +(offset[3] ?? 0));
	}
	const abbr = tail.match(/^\s*\(?(Z|UTC|GMT|[ECP][SD]T)\b(?!\s*[+-]\d)/);
	return abbr ? ZONES[abbr[1]] : null;
}

/** Parses common bank and mail-header date formats to an ISO string (UTC). Returns null if not a valid date. */
export function normalizeDate(raw?: string): string | null {
	if (!raw) return null;
	const date = findDate(raw);
	if (!date) return null;

	let hour = 0;
	let minute = 0;
	let second = 0;
	let zone: number | null = null;
	const time = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:\s*([AaPp])\.?[Mm]\b\.?)?/);
	if (time) {
		hour = +time[1];
		minute = +time[2];
		second = time[3] ? +time[3] : 0;
		const meridiem = time[4]?.toLowerCase();
		if (meridiem && (hour < 1 || hour > 12)) return null;
		if (meridiem === 'p' && hour < 12) hour += 12;
		if (meridiem === 'a' && hour === 12) hour = 0;
		zone = findZone(raw.slice(time.index! + time[0].length, time.index! + time[0].length + 16));
	}

	const { y, m, d } = date;
	if (m < 1 || m > 12 || d < 1 || hour > 23 || minute > 59 || second > 59) return null;
	const ms = Date.UTC(y, m - 1, d, hour, minute, second);
	if (new Date(ms).getUTCDate() !== d) return null; // e.g. 31/02
	return new Date(ms - (zone ?? DEFAULT_UTC_OFFSET_MINUTES) * 60_000).toISOString();
}
