// Cloudflare Email Worker: receives mail sent to `<token>@<your inbound domain>` (catch-all rule)
// and posts it, signed, to MC Budget's /api/inbound-email. It stores nothing.
import PostalMime from 'postal-mime';

interface Env {
	/** Public URL of the MC Budget app, e.g. https://budget.example.com */
	APP_URL: string;
	/** Same value as INBOUND_EMAIL_SECRET in the app. Set with `wrangler secret put`. */
	INBOUND_EMAIL_SECRET: string;
}

/** The parts of Cloudflare's ForwardableEmailMessage this Worker uses. */
interface IncomingEmail {
	readonly to: string;
	readonly raw: ReadableStream;
	readonly rawSize: number;
}

const MAX_RAW_BYTES = 2 * 1024 * 1024; // bank alerts are a few KB
const MAX_CHARS = 100_000; // the app refuses longer text or html

/**
 * Domain that Cloudflare's own MX reported `dmarc=pass` for. Only the FIRST Authentication-Results
 * header is Cloudflare's; a sender can add its own further down, so those are ignored.
 */
function dmarcPassDomain(headers: { key: string; value: string }[]): string | undefined {
	const first = headers.find((h) => h.key.toLowerCase() === 'authentication-results')?.value;
	if (!first || !/^\s*mx\.cloudflare\.net\s*;/i.test(first)) return undefined;
	return first.match(/\bdmarc=pass\b[^;]*?\bheader\.from=([A-Za-z0-9.-]+)/i)?.[1].toLowerCase();
}

async function sign(secret: string, timestamp: string, body: string): Promise<string> {
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		enc.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${body}`));
	return `v1=${[...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export default {
	async email(message: IncomingEmail, env: Env): Promise<void> {
		// Never reject: a bounce would go back to the user's mail provider. Drop and log instead.
		if (message.rawSize > MAX_RAW_BYTES) {
			console.log(`dropped: ${message.rawSize} bytes is too large`);
			return;
		}
		const email = await PostalMime.parse(message.raw);
		const header = (name: string) => email.headers.find((h) => h.key.toLowerCase() === name)?.value;

		const body = JSON.stringify({
			to: message.to,
			from: header('from'),
			subject: email.subject,
			text: (email.text ?? '').slice(0, MAX_CHARS),
			html: email.html?.slice(0, MAX_CHARS),
			receivedAt: new Date().toISOString(),
			dmarcPassDomain: dmarcPassDomain(email.headers)
		});
		const timestamp = String(Math.floor(Date.now() / 1000));
		const res = await fetch(`${env.APP_URL.replace(/\/+$/, '')}/api/inbound-email`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-mcb-timestamp': timestamp,
				'x-mcb-signature': await sign(env.INBOUND_EMAIL_SECRET, timestamp, body)
			},
			body
		});
		// Status only: the body may hold alert text
		console.log(`app answered ${res.status}`);
	}
};
