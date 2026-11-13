import { describe, it, expect } from 'vitest';
import {
	confirmationLink,
	isForwardConfirmation,
	newInboxToken,
	senderVerified,
	sign,
	tokenFromAddress,
	verifySignature
} from './inboundEmail';

describe('verifySignature', () => {
	const secret = 'test-secret';
	const now = 1_800_000_000;
	const ts = String(now);
	const body = '{"to":"x"}';

	it('accepts a fresh, correct signature', () => {
		expect(verifySignature(secret, ts, body, sign(secret, ts, body), now)).toBe(true);
	});

	it.each([
		['wrong secret', secret, ts, body, sign('other', ts, body)],
		['changed body', secret, ts, body + ' ', sign(secret, ts, body)],
		['no secret configured', '', ts, body, sign('', ts, body)],
		['missing signature', secret, ts, body, null],
		['bad format', secret, ts, body, 'deadbeef'],
		['stale timestamp', secret, String(now - 301), body, sign(secret, String(now - 301), body)],
		['future timestamp', secret, String(now + 301), body, sign(secret, String(now + 301), body)],
		['non-numeric timestamp', secret, 'abc', body, sign(secret, 'abc', body)]
	])('rejects %s', (_, s, t, b, sig) => {
		expect(verifySignature(s, t, b, sig, now)).toBe(false);
	});
});

describe('tokens', () => {
	it('makes 24-char base32 tokens that are all different', () => {
		const tokens = new Set(Array.from({ length: 200 }, newInboxToken));
		expect(tokens.size).toBe(200);
		for (const t of tokens) expect(t).toMatch(/^[a-z2-7]{24}$/);
	});

	const token = 'abcdefghijklmnopqrstuvwx';

	it.each([
		[`${token}@in.example.com`, token],
		[`${token.toUpperCase()}@IN.example.com`, token],
		[`alerts+${token}@in.example.com`, token]
	])('reads %s', (address, want) => {
		expect(tokenFromAddress(address, 'in.example.com')).toBe(want);
	});

	it.each([
		`${token}@other.example.com`, // not our domain
		'short@in.example.com',
		`${token}1@in.example.com`, // '1' is not base32
		'not an address'
	])('rejects %s', (address) => {
		expect(tokenFromAddress(address, 'in.example.com')).toBeNull();
	});
});

describe('senderVerified', () => {
	it('needs DMARC pass for the From domain itself', () => {
		expect(senderVerified('Bank <alerts@bank.example>', 'bank.example')).toBe(true);
		expect(senderVerified('Bank <alerts@bank.example>', 'BANK.example')).toBe(true);
		expect(senderVerified('Bank <alerts@bank.example>', 'gmail.com')).toBe(false);
		expect(senderVerified('Bank <alerts@bank.example>', undefined)).toBe(false);
		expect(senderVerified(undefined, 'bank.example')).toBe(false);
		expect(senderVerified('"a@bank.example" <x@evil.test>', 'bank.example')).toBe(false);
	});
});

describe('forward confirmations', () => {
	const gmail = 'Gmail Team <forwarding-noreply@google.com>';
	const subject =
		'(#123456789) Gmail Forwarding Confirmation - Receive Mail from someone@gmail.com';

	it('is recognised only from a DMARC-verified mail provider', () => {
		expect(isForwardConfirmation(subject, gmail, 'google.com')).toBe(true);
		expect(isForwardConfirmation(subject, gmail, undefined)).toBe(false); // spoofed From
		expect(isForwardConfirmation(subject, 'x <a@evil.test>', 'evil.test')).toBe(false);
		expect(isForwardConfirmation('Transaction Alert', gmail, 'google.com')).toBe(false);
	});

	it('extracts only provider links', () => {
		const text =
			'Click https://evil.test/x then https://mail-settings.google.com/mail/vf-abc123 to confirm.';
		expect(confirmationLink(text)).toBe('https://mail-settings.google.com/mail/vf-abc123');
		expect(confirmationLink('see http://mail.google.com/insecure')).toBe('');
		expect(confirmationLink('https://google.com.evil.test/x')).toBe('');
	});
});
