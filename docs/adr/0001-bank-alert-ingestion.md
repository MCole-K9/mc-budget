# Bank alerts come in by forwarding only, and are parsed then dropped

Jamaican banks have no APIs; the only machine-readable signal is the email or SMS alert sent on each transaction. We take these alerts only when the user forwards, pastes or shares them to us. We parse each alert into a Pending alert that the user must confirm, and we do not keep the raw email after parsing.

## Considered Options

- **Gmail API (OAuth) to read the inbox**: rejected. Reading mail needs a restricted scope, which needs a yearly third-party (CASA) security assessment, and it gives us access to the whole inbox when we need one sender.
- **IMAP with the user's mail password or app password**: rejected. We would hold a credential to the user's whole mailbox.
- **Forwarding (auto or manual), paste and share**: chosen. The user decides what we see, any mail provider works, and we hold no mailbox credentials.

## Consequences

- Auto-forward is not free on every provider (Yahoo, Proton and Zoho need a paid plan; Microsoft 365 needs an admin), so manual forward, paste and share must always work.
- Forwarded mail loses the bank's sender authentication, so only an auto-forwarded alert from a verified sender gets high confidence. Everything else is low confidence. All alerts start as Pending; nothing changes a wallet until the user confirms.
- Email arrives through a Cloudflare Email Worker on a domain used only for this (catch-all to the Worker). The Worker signs each message (HMAC with a shared secret and a timestamp) and posts it to the app; the user is found by a random token in the recipient address, never by an id in the request. A sender is verified only when Cloudflare reports DMARC pass for the From domain.
- Raw email is not stored after parsing. A parse error cannot be replayed from our side; the user forwards the alert again.
- AI is opt-in and uses only the user's own key, never the shared instance key, because alert text is personal financial data. AI either drafts a parser template that the user reviews (later alerts of that format need no AI), or, when the user turns it on, reads an alert no template can read. AI results are always low confidence and stay Pending.
- The parsing engine is pure and stateless so that it can move into its own package. This supports a bring-your-own ladder for users who want more control: hosted parsing → their own AI key → local AI → their own ingest address → self-hosting the whole app.
