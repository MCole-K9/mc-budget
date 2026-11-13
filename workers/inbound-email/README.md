# Inbound email Worker

Receives bank alerts that users forward to `<token>@<your inbound domain>` and posts them, signed, to
MC Budget's `POST /api/inbound-email`. It stores nothing. Alerts land in the user's Pending list;
nothing reaches a wallet until the user confirms it.

## Set up (once)

You need: a spare domain on Cloudflare (Email Routing on), and the MC Budget app on a public URL.

1. **Make a shared secret** (any long random string):
   `openssl rand -base64 32`
2. **App**: set these environment variables and restart the app.
   - `INBOUND_EMAIL_DOMAIN` = your inbound domain, e.g. `in.example.com`
   - `INBOUND_EMAIL_SECRET` = the secret from step 1
3. **Worker**: in this folder:
   ```sh
   npm install
   # edit wrangler.jsonc: set APP_URL to your app's public URL
   npx wrangler login
   npx wrangler secret put INBOUND_EMAIL_SECRET   # paste the same secret
   npx wrangler deploy
   ```
4. **Cloudflare dashboard** → your inbound domain → Email → Email Routing → Routing rules →
   **Catch-all address** → Edit → action **Send to a Worker** → `mc-budget-inbound-email` → Save, and
   make sure it is enabled.
5. **App** → Settings → Bank alerts → **Get my address**. Set your mail (or a filter for your bank's
   alerts) to forward to that address. Gmail and Outlook first send a "confirm forwarding" mail; it
   shows up in Settings with its link.

## How it works

- The address token (24 random characters) identifies the user. Anyone who knows an address can add
  Pending alerts to that account, so keep it private; Settings can replace it.
- Each request is signed: header `x-mcb-signature: v1=<hex HMAC-SHA256(secret, timestamp + "." + body)>`
  and `x-mcb-timestamp` (Unix seconds). The app refuses wrong signatures and timestamps older or newer
  than 5 minutes.
- Cloudflare adds an `Authentication-Results` header. When it shows `dmarc=pass` for the bank's own
  domain (an auto-forward that kept the bank's From), the alert gets **high** confidence. Hand
  forwards stay low confidence.
- The Worker never rejects mail (a bounce would reach the user's mail provider); it drops messages over
  2 MB and logs only the app's HTTP status, never the alert text.

## Test locally

`npx wrangler dev`, then post a raw message (it must have a `Message-ID` header):

```sh
curl -X POST 'http://localhost:8787/cdn-cgi/local/email?from=alerts@bank.example&to=<token>@in.example.com' \
  --data-binary @alert.eml
```

`APP_URL` must point at an app that can receive the request (for a local app, a tunnel such as
`cloudflared tunnel --url http://localhost:5173`).
