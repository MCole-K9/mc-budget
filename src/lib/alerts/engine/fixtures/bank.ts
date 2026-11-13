// Synthetic sample bank. "Island Trust Bank" and every value here are made up.
import type { ParserTemplate } from '../types';

export const SAMPLE_BANK_DOMAIN = 'alerts.islandtrust.example';
export const SAMPLE_BANK_FROM = `Island Trust Bank <noreply@${SAMPLE_BANK_DOMAIN}>`;
export const SAMPLE_SUBJECT = 'Transaction Alert';

export const SAMPLE_TEMPLATE: ParserTemplate = {
	id: 'islandtrust-card-v1',
	bankId: 'islandtrust',
	match: { fromDomains: ['islandtrust.example'], subjectRegex: '^Transaction Alert' },
	fields: {
		amount: 'Amount:\\s*(.+)',
		currency: 'Amount:\\s*([A-Z]{3}|[A-Z]{1,2}\\$)',
		merchant: 'Merchant:\\s*(.+)',
		accountHint: 'Card:\\s*\\**(\\d{4})',
		occurredAt: 'Date:\\s*(.+)',
		reference: 'Reference:\\s*(\\S+)',
		direction: 'Transaction Type:\\s*(.+)'
	}
};

export const SAMPLE_ALERT_TEXT = `Dear Customer,

A transaction was made with your card.

Transaction Type: POS Purchase
Card: ****1234
Amount: JMD$1,234.56
Merchant: SUNNY MART   KINGSTON
Date: 12-Nov-2026 10:15:32
Reference: ITB000111222

Thank you for banking with Island Trust Bank.`;

export const SAMPLE_ALERT_HTML = `<html><head><style>p { color: red; }</style></head><body>
<p>Dear Customer,</p>
<table>
<tr><td>Transaction Type:</td><td>POS Purchase</td></tr>
<tr><td>Card:</td><td>****1234</td></tr>
<tr><td>Amount:</td><td>JMD$1,234.56</td></tr>
<tr><td>Merchant:</td><td>SUNNY MART &amp; DELI</td></tr>
<tr><td>Date:</td><td>12-Nov-2026 10:15:32</td></tr>
<tr><td>Reference:</td><td>ITB000111222</td></tr>
</table>
<p>Thank&nbsp;you.</p>
</body></html>`;
