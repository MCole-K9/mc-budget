import { error, json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { withAdminPb } from '$lib/server/db';
import { loadUserTemplates, MAX_TEMPLATES, saveAlert } from '$lib/server/alerts';
import {
	confirmationLink,
	isForwardConfirmation,
	senderVerified,
	tokenFromAddress,
	verifySignature
} from '$lib/server/inboundEmail';
import { MAX_INPUT_CHARS, parseAlert, unwrapForward, type AlertInput } from '$lib/alerts/engine';

// Alerts are small; the Email Worker trims text and html to MAX_INPUT_CHARS each.
const MAX_BODY_CHARS = 2 * MAX_INPUT_CHARS + 10_000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_PER_ADDRESS = 60;
const addressRateState = new Map<string, number[]>();

const PayloadSchema = z.object({
	/** Envelope recipient: `<token>@INBOUND_EMAIL_DOMAIN` */
	to: z.string().max(320),
	/** From header */
	from: z.string().max(1000).optional(),
	subject: z.string().max(1000).optional(),
	text: z.string().max(MAX_INPUT_CHARS).default(''),
	html: z.string().max(MAX_INPUT_CHARS).optional(),
	receivedAt: z
		.string()
		.refine((v) => !isNaN(Date.parse(v)))
		.optional(),
	/** Domain that Cloudflare's MX reported `dmarc=pass` for, if any */
	dmarcPassDomain: z.string().max(253).optional()
});

function takeRateLimit(key: string): boolean {
	const now = Date.now();
	const recent = (addressRateState.get(key) ?? []).filter((t) => t > now - RATE_LIMIT_WINDOW_MS);
	if (recent.length >= RATE_LIMIT_PER_ADDRESS) return false;
	recent.push(now);
	addressRateState.set(key, recent);
	return true;
}

/**
 * Receives one email from the Cloudflare Email Worker (workers/inbound-email). Authenticated only by
 * the HMAC signature, never by a session: the user is found from the secret token in the recipient
 * address. Alerts land as Pending (or Unread); nothing changes a wallet here.
 */
export const POST: RequestHandler = async ({ request }) => {
	const secret = env.INBOUND_EMAIL_SECRET ?? '';
	const domain = env.INBOUND_EMAIL_DOMAIN ?? '';
	if (!secret || !domain) error(404, 'Not found');

	if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_CHARS) error(413, 'Too large');
	const body = await request.text();
	if (body.length > MAX_BODY_CHARS) error(413, 'Too large');
	const ok = verifySignature(
		secret,
		request.headers.get('x-mcb-timestamp'),
		body,
		request.headers.get('x-mcb-signature')
	);
	if (!ok) error(401, 'Bad signature');

	let payload: z.infer<typeof PayloadSchema>;
	try {
		payload = PayloadSchema.parse(JSON.parse(body));
	} catch {
		error(400, 'Bad payload');
	}

	// Unknown or turned-off addresses get the same answer, so the endpoint does not reveal tokens
	const ignored = () => json({ status: 'ignored' }, { status: 202 });
	const token = tokenFromAddress(payload.to, domain);
	if (!token) return ignored();
	if (!takeRateLimit(token)) error(429, 'Too many messages for this address');

	return withAdminPb(async (pb) => {
		const found = await pb.collection('alert_inboxes').getList(1, 1, {
			filter: pb.filter('token = {:token} && enabled = true', { token }),
			requestKey: null
		});
		const inbox = found.items[0];
		if (!inbox) return ignored();
		const userId = String(inbox.user);

		// Gmail, Outlook, ... first send a "confirm forwarding" mail: keep it for Settings
		if (isForwardConfirmation(payload.subject, payload.from, payload.dmarcPassDomain)) {
			const text = payload.text || unwrapForward({ ...baseInput(payload), text: '' }).text;
			await pb.collection('alert_inboxes').update(inbox.id, {
				confirm_text: text.slice(0, 4000),
				confirm_link: confirmationLink(text),
				confirm_at: new Date().toISOString()
			});
			return json({ status: 'confirmation' });
		}

		const input: AlertInput = {
			...baseInput(payload),
			senderVerified: senderVerified(payload.from, payload.dmarcPassDomain)
		};
		const templates = await loadUserTemplates(pb, userId, MAX_TEMPLATES);
		const parsed = parseAlert(input, templates);
		// An Unread alert keeps its raw text for template writing; use the HTML body when there is no text
		const stored =
			!input.text.trim() && input.html ? { ...input, text: unwrapForward(input).text } : input;
		const saved = await saveAlert(pb, userId, stored, parsed);
		return json({ status: saved.status });
	});
};

function baseInput(payload: z.infer<typeof PayloadSchema>): AlertInput {
	return {
		channel: 'auto-forward',
		from: payload.from,
		subject: payload.subject,
		text: payload.text,
		html: payload.html,
		receivedAt: payload.receivedAt
			? new Date(payload.receivedAt).toISOString()
			: new Date().toISOString(),
		senderVerified: false
	};
}
