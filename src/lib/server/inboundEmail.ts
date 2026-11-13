import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { emailAddress } from '$lib/alerts/engine/unwrap';

/** Requests older or newer than this are refused, so a captured request cannot be replayed later. */
export const MAX_CLOCK_SKEW_SECONDS = 300;

/**
 * Checks the Email Worker's signature: `v1=` + hex HMAC-SHA256(secret, `${timestamp}.${body}`).
 * Constant-time compare. False for a missing secret, a bad format or a stale timestamp.
 */
export function verifySignature(
	secret: string,
	timestamp: string | null,
	body: string,
	signature: string | null,
	nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
	if (!secret || !timestamp || !signature || !/^\d{1,12}$/.test(timestamp)) return false;
	if (Math.abs(nowSeconds - Number(timestamp)) > MAX_CLOCK_SKEW_SECONDS) return false;
	const given = signature.match(/^v1=([0-9a-f]{64})$/)?.[1];
	if (!given) return false;
	const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest();
	return timingSafeEqual(expected, Buffer.from(given, 'hex'));
}

/** Same signature, for tests and tooling. */
export function sign(secret: string, timestamp: string, body: string): string {
	return `v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}

const TOKEN = /^[a-z2-7]{24}$/;

/** A new forward-address token: 24 base32 characters (120 random bits). */
export function newInboxToken(): string {
	const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
	return [...randomBytes(24)].map((b) => alphabet[b & 31]).join('');
}

/**
 * The token in a recipient address, or null. Accepts `<token>@domain` (catch-all) and
 * `anything+<token>@domain` (subaddressing). The domain must be ours.
 */
export function tokenFromAddress(address: string, inboxDomain: string): string | null {
	const m = address
		.trim()
		.toLowerCase()
		.match(/^([^@\s]+)@([^@\s]+)$/);
	if (!m || !inboxDomain || m[2] !== inboxDomain.toLowerCase()) return null;
	const local = m[1];
	const candidate = local.includes('+') ? local.slice(local.lastIndexOf('+') + 1) : local;
	return TOKEN.test(candidate) ? candidate : null;
}

/** Domain of the first address in a From header value, lowercased. */
export function fromDomain(from: string | undefined): string | undefined {
	// Same fail-closed parser as the engine: display names and From lists give undefined
	return emailAddress(from)?.split('@')[1];
}

/**
 * True when Cloudflare saw DMARC pass for the domain in the From header. The Worker reports the
 * domain from the `Authentication-Results` header that Cloudflare's MX (`mx.cloudflare.net`) adds.
 */
export function senderVerified(
	fromHeader: string | undefined,
	dmarcPassDomain: string | undefined
): boolean {
	const domain = fromDomain(fromHeader);
	return !!domain && !!dmarcPassDomain && domain === dmarcPassDomain.toLowerCase();
}

// Mail providers that send a "confirm forwarding" mail before auto-forward starts.
const PROVIDER_DOMAINS = [
	'google.com',
	'microsoft.com',
	'live.com',
	'outlook.com',
	'proton.me',
	'protonmail.com',
	'icloud.com',
	'apple.com',
	'yahoo.com',
	'zoho.com',
	'fastmail.com'
];

const isProviderDomain = (domain: string) =>
	PROVIDER_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));

/**
 * A provider's "confirm forwarding" mail: subject about forwarding plus confirm/verify, sent by a
 * known provider AND verified by DMARC, so nobody else can plant a link in the user's Settings.
 */
export function isForwardConfirmation(
	subject: string | undefined,
	fromHeader: string | undefined,
	dmarcPassDomain: string | undefined
): boolean {
	if (!subject || !/forward/i.test(subject) || !/confirm|verif|approve/i.test(subject))
		return false;
	const domain = fromDomain(fromHeader);
	return !!domain && senderVerified(fromHeader, dmarcPassDomain) && isProviderDomain(domain);
}

/** First https link in the text that points at a known mail provider, or ''. */
export function confirmationLink(text: string): string {
	for (const m of text.matchAll(/https:\/\/[^\s<>"')\]]{1,900}/g)) {
		try {
			const url = new URL(m[0]);
			if (url.protocol === 'https:' && isProviderDomain(url.hostname.toLowerCase()))
				return url.href;
		} catch {
			// not a URL
		}
	}
	return '';
}
