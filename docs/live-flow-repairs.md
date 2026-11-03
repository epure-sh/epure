# Shared channels, OAuth browser consent, and Polar billing repair

## Findings

The deployed server already contained OAuth support. The browser client used `/api/oauth/...` while the protected router serves `/api/v1/oauth/...`; the SPA fallback returned HTML to a JSON parser, leaving no workspace choices. Browser/device consent and connected-app requests now use the versioned API. Invalid response bodies produce a useful error, and the global approval shortcut does not intercept workspace-menu keyboard selection.

Output-channel creation deliberately fanned out one request per project, and the server stored only one association. Creation now submits one destination with `project_ids`. Legacy `project_id` requests remain supported. Existing channels are backfilled with their original project; existing separate destinations are preserved. Editing, project filtering, secret display, verification, channel dispatch and the delivery outbox use the shared association. Tenant validation applies to every selected project. Removing a project detaches it while other associations survive.

Polar's sandbox API rejected the deployed application credential. Its replacement and the rotated signing secret are kept solely in deployment configuration. The old signing key was present in a committed test fixture; tests now generate their own private random keys. Retired secrets were not retained in source changes.

The billing UI requested annual checkout and advertised annual billing, although the verified active Polar catalog has monthly Pro and Scale products. The app now displays the actual configured monthly prices and requests monthly checkout. Annual checkout requires a separately configured annual product; it cannot silently charge the monthly product. Production product IDs must be configured explicitly, while verified sandbox IDs remain sandbox-only defaults.

Checkout creation uses the documented API with workspace `external_customer_id`, persistent metadata, and a return URL carrying the actual provider checkout ID. Failed API calls return an error instead of fabricated checkout/session IDs or unbound hosted-link fallbacks. Return URLs are restricted to the app origin. Portal sessions use the documented external customer identifier.

Billing synchronization reads current customer state instead of treating a subscription field, an unpaid order, or a redirect as payment proof. Current subscription identifiers/status/periods come from Polar; no thirty-day period is fabricated. Workspace resolution uses stable customer/workspace bindings, with no email/domain guessing. A manual owner refresh can reconcile missed webhooks. Failed checkout sync retains its return identifier for retry.

Webhook handling supports both documented signature-key generations, verifies timestamps, and marks a delivery processed only after reconciliation succeeds. A durable processing lease serializes duplicate attempts without holding a database connection across external HTTP calls. Failed processing releases the claim; a crashed worker's claim expires. Customer-state events must be enabled alongside subscription lifecycle events. All API requests pin `Polar-Version: 2026-10`.

## Research

- [Polar checkout API](https://polar.sh/docs/api-reference/2026-10/checkouts/create-checkout-session): product selection, external customer identifiers, metadata, and the checkout-ID return placeholder.
- [API versioning](https://polar.sh/docs/api-reference/2026-10/versioning): pin API and webhook payload contracts separately.
- [Customer state](https://polar.sh/docs/integrate/customer-state): reconcile the customer's current entitlements.
- [Webhook delivery](https://polar.sh/docs/integrate/webhooks/delivery): signature-key generations, retries and delivery behavior.
- [Reported missing external IDs](https://github.com/polarsource/polar/issues/12319): motivates retaining a stable customer-ID binding rather than guessing by email when a payload omits metadata.
- [Community discussion of redirect and webhook sync failures](https://www.reddit.com/r/SaaS/comments/1lkweb3/struggling_to_connect_polarsh_subscriptions_to/): corroborating symptoms; implementation decisions use the primary API contracts above.

## Verification

Focused HTTP/Postgres tests cover shared-project creation/filtering/delivery/deletion and a single verification request; signed webhook failure/retry/replay, exact provider subscription periods, missing external IDs and stale activation events. Frontend tests exercise actual OAuth request paths and the multi-project creation body. Live verification is recorded separately so deterministic fixtures are not mistaken for a completed real checkout. No real payment is authorized or required; the live billing environment remains Polar sandbox.
