/** Can the user auto-forward mail from this provider? 'paid' = paid plan only, 'admin' = an admin must allow it. */
export interface MailProvider {
	id: string;
	name: string;
	domains: string[];
	autoForward: 'yes' | 'paid' | 'admin' | 'no';
	helpUrl: string;
}

export const PROVIDERS: MailProvider[] = [
	{
		id: 'gmail',
		name: 'Gmail',
		domains: ['gmail.com', 'googlemail.com'],
		autoForward: 'yes',
		helpUrl: 'https://support.google.com/mail/answer/10957'
	},
	{
		id: 'outlook',
		name: 'Outlook.com',
		domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com'],
		autoForward: 'yes',
		helpUrl:
			'https://support.microsoft.com/en-us/outlook/turn-on-or-off-automatic-forwarding-in-outlook-com'
	},
	{
		id: 'icloud',
		name: 'iCloud Mail',
		domains: ['icloud.com', 'me.com', 'mac.com'],
		autoForward: 'yes',
		helpUrl: 'https://support.apple.com/guide/icloud/mm6b1a3960/icloud'
	},
	{
		id: 'yahoo',
		name: 'Yahoo Mail',
		domains: ['yahoo.com', 'ymail.com', 'rocketmail.com'],
		autoForward: 'paid',
		helpUrl: 'https://help.yahoo.com/kb/SLN36684.html'
	},
	{
		id: 'proton',
		name: 'Proton Mail',
		domains: ['proton.me', 'protonmail.com', 'pm.me'],
		autoForward: 'paid',
		helpUrl: 'https://proton.me/support/email-forwarding'
	},
	{
		// New Zoho Mail Free accounts cannot forward (https://www.zoho.com/mail/help/email-forwarding.html).
		id: 'zoho',
		name: 'Zoho Mail',
		domains: ['zoho.com', 'zohomail.com'],
		autoForward: 'paid',
		helpUrl: 'https://www.zoho.com/mail/help/email-forwarding.html'
	},
	{
		id: 'fastmail',
		name: 'Fastmail',
		domains: ['fastmail.com', 'fastmail.fm'],
		autoForward: 'yes',
		helpUrl: 'https://www.fastmail.help/hc/en-us/articles/360058753434-Email-forwarding'
	},
	{
		// Work mail on custom domains: external auto-forward is off by default in the outbound spam policy.
		id: 'm365',
		name: 'Microsoft 365 (work or school)',
		domains: [],
		autoForward: 'admin',
		helpUrl:
			'https://learn.microsoft.com/en-us/defender-office-365/outbound-spam-policies-external-email-forwarding'
	}
];

/** Provider for a consumer mail address, or undefined (custom domains, unknown hosts). */
export function providerForEmail(email: string): MailProvider | undefined {
	const domain = email.trim().toLowerCase().split('@').pop();
	return domain ? PROVIDERS.find((p) => p.domains.includes(domain)) : undefined;
}
