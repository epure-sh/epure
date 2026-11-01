# Acme demo fixture titles

Shared titles for register bootstrap (`auth_bootstrap_workspace`), heavy seed ingest, playground fixtures, and the `acme-seed.ts` empty-feed fallback. Keep wording stable so filters and screenshots stay comparable.

## Acme Web

| Fingerprint / slug | Title | Lifecycle notes |
|---|---|---|
| demo-web-checkout-typeerror | TypeError: Cannot read properties of undefined (reading 'price') | unresolved, critical, escalating |
| demo-web-payment-failed | Error: Payment failed: card declined (500) | unresolved, high |
| demo-web-hydration | Error: Hydration failed: text content did not match server HTML | unresolved |
| demo-web-auth-token | Error: Session refresh failed: token expired | regression |
| demo-web-rate-limit | Error: Too many requests: rate limit exceeded | unresolved, warning |
| demo-web-null-map | TypeError: Cannot read properties of undefined (reading 'map') | unresolved, high users |
| demo-web-cors | TypeError: Failed to fetch (CORS blocked) | staging |
| demo-web-chunk-load | ChunkLoadError: Loading chunk 14 failed | unresolved |
| demo-web-resize-observer | Error: ResizeObserver loop completed with undelivered notifications | ignored |
| demo-web-local-dev | ReferenceError: process is not defined | local |
| demo-web-resolved-cart | TypeError: cart.items is not iterable | resolved |
| demo-web-info-analytics | Error: analytics beacon timed out | ignored, info |
| demo-web-stripe-timeout | GatewayTimeout: Upstream stripe webhook acknowledgement exceeded 5000ms | regression |
| demo-web-snooze-jwt | JsonWebTokenError: invalid signature on bearer verification | snoozed (until count / 24h) |
| demo-web-merge-parent | Error: Inventory sync conflict for SKU-4412 | merge parent |
| demo-web-merge-child | Error: Inventory sync conflict (duplicate fingerprint variant) | merge child |
| demo-web-fatal-oom | RangeError: Maximum call stack size exceeded | fatal |
| demo-web-staging-ab | Error: Feature flag evaluation failed for experiment checkout_v3 | staging |

## Acme API

| Fingerprint / slug | Title |
|---|---|
| demo-api-pg-refused | Error: connect ECONNREFUSED 10.0.4.12:5432 |
| demo-api-pg-timeout | OperationalError: database connection timed out |
| demo-api-nil-ptr | runtime error: invalid memory address or nil pointer dereference |
| demo-api-redis | Error: Redis BRPOP timed out on queue orders |
| demo-api-scope | ForbiddenError: missing scope invoices:write |
| demo-api-ignored-health | Error: healthcheck probe failed (transient) |

## Monitors (Web)

- Nightly Stripe Payouts (`nightly-backup`) — ok
- Billing Sync (`billing-sync`) — missed
- Stripe reconcile (`stripe-reconcile`) — error
- Session garbage collect (`session-gc`) — in_progress
- Staging warmup (`staging-warmup`) — paused
- CDN purge audit (`cdn-purge-audit`) — timeout

## Alert rules

- New production errors
- Production regressions
- Production error spike
- New staging errors (paused / disabled)
