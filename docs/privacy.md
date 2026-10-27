# Privacy

Epure is an error tracker you run yourself, or that Epure runs as a cloud instance. This page is the product behavior. It is not a substitute for a lawyer, a company imprint, or a signed data-processing agreement.

## Decisions locked in this repository

These are the choices that change what the software does. They follow data minimization: do not keep personal data you do not need to group an error.

| Topic | Behavior |
| --- | --- |
| End-user email, username, name | **Off** on every project until an admin turns **Store emails and usernames** on. |
| End-user IP address | **Never stored**, including when emails are turned on. |
| City, region, coordinates | Removed. Country code is kept only when the SDK or your edge (`cf-ipcountry`, `x-country-code`) sends one. Epure does not look up an IP. |
| Email used as `user.id` | Replaced with a stable pseudonym (`anon_` + 8 bytes of SHA-256). Unique-user counts still work. Erasure by that email still finds the events. |
| Opaque `user.id` | Kept. It is the identifier your app chose to send. |
| Secrets | Authorization headers, cookies, card numbers, and query parameters such as `token` or `password` are redacted on every event. |
| Session cookie | One cookie, `HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS (`__Host-epure.sid`). 14 days of inactivity. Strictly necessary, so there is no consent banner. |
| Analytics, session replay, phone-home | Not implemented. Tracing, replay, and profiling payloads are not stored. |
| Fonts | IBM Plex is bundled. The app does not call Google Fonts. |
| Login rate limits | The IP is held in memory for about a minute, as a hash, and is not written to Postgres. |
| OAuth grants | Client IP is not stored. User agent is stored so you can recognize a CLI session. |
| Historical events | Not rewritten on upgrade. Admins can strip stored identifiers or delete one person. |

Set `sendDefaultPii` / `send_default_pii` to **false** in the SDK. The in-app snippets do that. The setup wizard used to set Python `send_default_pii=True`; that is now `False`.

## Who is responsible

**Self-hosted.** You are the controller for workspace accounts and for the errors your applications send. Epure's authors do not receive that data. This binary does not call home.

**Your end users.** You are the controller of errors captured from your product. Epure is the tool. If you run Epure Cloud, the cloud operator is the processor for that content and you still need a contract with them.

**Cloud instance.** Set these on the server so `/privacy` names the real operator instead of a blank contact:

- `EPURE_CLOUD=true`
- `EPURE_OPERATOR_NAME`
- `EPURE_PRIVACY_CONTACT`
- `EPURE_DATA_REGION` (for example `EU`)
- `EPURE_PRIVACY_POLICY_URL`
- `EPURE_DPA_URL`

## What you can do in the app

- **Project settings → Privacy** — opt in to emails, export one person's events, delete them, or strip identifiers already stored.
- **Settings → Security** — download your own account JSON, or delete the account.
- **`/privacy`** — public notice. It lists Resend, Google, or GitHub only when those environment variables are set. Webhooks go to URLs you configure.

Account export omits password hashes, session secrets, OAuth token hashes, and DSN secrets.

Erasure matches `user.id`, `user.email`, and the pseudonym of an email. It deletes matching events and feedback rows. Exception text that happens to contain an email is not rewritten by the strip action; delete the events, or wait for retention (14, 30, or 90 days).

## What leaves the machine

Only if you turn it on:

| Service | When | Data |
| --- | --- | --- |
| Resend (`RESEND_API_KEY`) | Alert or mail send | Recipient address and the message |
| Google (`GOOGLE_CLIENT_ID`) | Sign-in | The account the person chooses |
| GitHub (`GITHUB_CLIENT_ID`) | Sign-in | The account the person chooses |
| Your webhooks | You add a URL | The alert payload you configured |

Copy-for-agent and MCP read data already stored on your instance. They do not add a new destination by themselves. The text you paste into an external model leaves your server when you paste it.

## The other repository (cloud billing)

This repository does not contain the Polar client. The UI calls `/api/v1/billing/checkout` and `/api/v1/billing/portal`. Plan columns and webhook idempotency tables live here. A comment in `crates/core` points at `cloud-billing`. That repository is not in the public `epure-sh` organization, so it was not changed from this work.

Change it there if you operate Epure Cloud:

1. **Legal identity.** Company name, address, registration, VAT, and the privacy policy and DPA URLs. This app will display them only when the environment variables above are set. Do not invent them inside the product.
2. **Article 28 contract.** A data-processing agreement between you and the cloud customer, including the instructions, the subprocessors, and deletion at the end of the contract.
3. **Payment provider.** Polar (or whoever checkout uses) receives billing identity. Sign their DPA, list them as a subprocessor, and prefer an EU processing location if you promise EU hosting.
4. **Where the cloud database runs.** This binary cannot move Postgres. If the managed database or the app host is outside the EU, say so, or move the region. `EPURE_DATA_REGION` is a label, not a control.
5. **Do not add** product analytics, session replay, or a phone-home from the cloud fork. The privacy notice in this binary says those are off.
6. **Billing webhooks.** Verify signatures and do not log full payloads that contain customer email.

Self-hosters do not need that repository. Billing screens in a self-hosted build are for the cloud product; ingested errors still follow the defaults in this document.
