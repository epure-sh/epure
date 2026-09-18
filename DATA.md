# Data handling & privacy

Self-hosted. Events and accounts live in **your** Postgres volume. OSS does not phone home.

**Not legal advice.**

## What Epure stores

| Category | Examples | Retention |
|---|---|---|
| Events | Stacks, breadcrumbs, `user.id` / email, env, release | 14 / 30 / 90 days (default 30) |
| Issues | Fingerprint, status, counts | Until deleted |
| Releases / maps | Version tags, `.map` files | Until project deleted |
| Accounts | Email, password hash or Google link | Until removed |
| Alerts / webhooks / feedback | Config + history | Until deleted |

## PII scrub (always on)

Before persist (`crates/envelope/src/scrub.rs`): Bearer tokens, API keys, passwords, AWS/Stripe keys, card-like digit runs; headers `Authorization` / `Cookie` / `X-Api-Key`; keys matching password/secret/token.

**Not scrubbed:** `user.id` / `user.email`, exception messages, stack trees, demangled source, unmatched breadcrumbs. Use SDK `beforeSend` for fields you refuse to store.

## Tenancy & RBAC

Dashboard APIs set `app.current_org_id` (RLS). Ingest uses DSN → project, no session.

| Action | Member | Admin | Owner |
|---|---|---|---|
| Triage issues | ✓ | ✓ | ✓ |
| Projects / DSN / webhooks | | ✓ | ✓ |
| Invites / roles | | ✓* | ✓ |
| Delete project | | | ✓ |

\* Owners only for owner-level role changes. ≥1 owner required.

## Lifecycle

POST → **202** → worker → monthly partition → daily TTL drop. No export portal in Phase 1. Back up Postgres yourself.

## EU operator notes

You control infra. No core sub-processors (optional Google OAuth; webhooks you configure). No “GDPR compliant” / “zero PII” / “HIPAA” claims. Document your own basis.

## Hardening

Prod overlay · HTTPS · `EPURE_PUBLIC_URL` · rotate DSNs · `EPURE_WEBHOOK_ALLOW_PRIVATE=0` · backups. Detail: [SELF_HOST.md](docs/SELF_HOST.md). Vulns: [SECURITY.md](SECURITY.md).
