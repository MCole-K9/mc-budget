// Synthetic forward wrappers per mail provider. All names and addresses are made up.
import { SAMPLE_ALERT_TEXT, SAMPLE_BANK_FROM, SAMPLE_SUBJECT } from './bank';

const quote = (text: string) =>
	text
		.split('\n')
		.map((l) => (l ? `> ${l}` : '>'))
		.join('\n');

export const FORWARDS: Record<string, string> = {
	gmail: `FYI

---------- Forwarded message ---------
From: ${SAMPLE_BANK_FROM}
Date: Thu, Nov 12, 2026 at 10:16 AM
Subject: ${SAMPLE_SUBJECT}
To: <someone@gmail.com>


${SAMPLE_ALERT_TEXT}`,

	outlook: `

________________________________
From: ${SAMPLE_BANK_FROM}
Sent: Thursday, November 12, 2026 10:16 AM
To: Some One <someone@outlook.com>
Subject: ${SAMPLE_SUBJECT}

${SAMPLE_ALERT_TEXT}`,

	apple: `Begin forwarded message:

From: ${SAMPLE_BANK_FROM}
Subject: ${SAMPLE_SUBJECT}
Date: 12 November 2026 at 10:16:00 EST
To: Some One <someone@icloud.com>

${SAMPLE_ALERT_TEXT}`,

	yahoo: `----- Forwarded Message -----
From: ${SAMPLE_BANK_FROM}
To: someone@yahoo.com <someone@yahoo.com>
Sent: Thursday, November 12, 2026, 10:16:00 AM EST
Subject: ${SAMPLE_SUBJECT}

${SAMPLE_ALERT_TEXT}`,

	proton: `Sent with Proton Mail secure email.

------- Forwarded Message -------
From: ${SAMPLE_BANK_FROM}
Date: On Thursday, November 12th, 2026 at 10:16 AM
Subject: ${SAMPLE_SUBJECT}
To: someone@proton.me


${quote(SAMPLE_ALERT_TEXT)}`
};
