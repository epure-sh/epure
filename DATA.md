# Data handling & privacy

epure is self-hosted error tracking. Events, issues, and dashboard accounts live in **your** PostgreSQL volume. The OSS core does not phone home or ship usage telemetry.

This page covers what epure stores, what it scrubs at ingest, tenancy controls, and what EU operators commonly evaluate. **Not legal advice** — work with counsel on GDPR, contracts, and your application's own data-processing obligations.

---

## What epure stores

| Category | Examples | Retention |
|---|---|---|
| **Events** | Stack frames, breadcrumbs, request metadata, `user.id` / `user.email`, environment, release | Per-project TTL: **14, 30, or 90 days** (default 30). Monthly partitions dropped; issue row survives. |
| **Issues** | Fingerprint, title, status, counts, snooze state | Until deleted |
| **Releases & sourcemaps** | Version tags, `.map` files for JS/TS demangling | Until project deleted |
| **Dashboard accounts** | Email, display name, password hash or Google OAuth link | Until removed |
| **Alerts, webhooks, feedback** | Alert history, webhook URLs, user comments linked to `event_id` | Config until deleted; feedback email scrubbed |

Your Sentry SDK chooses what to attach. epure only removes fields that match the scrub rules below.

---

## PII scrubber (at ingest)

Before persistence, the worker runs `scrub_event` (`crates/envelope/src/scrub.rs`). Scrubbing is **always on** — no per-project toggle in Phase 1.

### Patterns redacted

| Pattern | Applied to | Result |
|---|---|---|
| **Bearer tokens** | Strings in `request`, `breadcrumbs`, `extra`, `contexts` | `Bearer [REDACTED]` |
| **API keys / secrets / tokens** — key name + `:` or `=` + 8+ chars | String regex + matching key names | `prefix=[REDACTED]` |
| **Passwords** — `password`, `passwd`, `pwd` + `:` or `=` | String regex + matching key names | `prefix=[REDACTED]` |
| **AWS keys** — `AKIA` + 16 chars | String regex | `[REDACTED]` |
| **Stripe keys** — `sk_`/`rk_` + `live`/`test` + 16+ chars | String regex | `[REDACTED]` |
| **Credit cards** — 13–16 digit sequences | String regex | `[REDACTED]` |

**Headers fully redacted:** `Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key`, `X-Auth-Token`

**Object keys fully redacted** (case-insensitive substring): `password`, `secret`, `token`, `api_key`, `apikey`, `authorization`

**Sections walked:** `request.headers`, `request.data`, `request.cookies`, `breadcrumbs.values[].message` / `.data`, `extra`, `contexts`. User-feedback `email` also runs through `scrub_string`.

---

## What is **not** scrubbed

Regex scrubbing is a safety net, not exhaustive removal of personal data.

| Data | Notes |
|---|---|
| **`user.id` / `user.email`** | Stored in indexed columns for unique-user counts and `user.email:` search. |
| **Exception messages & stack traces** | `scrub_event` does not walk `exception` or `stacktrace` trees. |
| **Demangled source context** | Code snippets from sourcemaps stored as-is. |
| **IP-derived metadata** | Country code may persist; full IP depends on SDK config. |
| **Innocently named custom fields** | Arbitrary PII in `extra` / `contexts` passes unless a pattern matches. |
| **Feedback name & comments** | Only email is scrubbed. |
| **Unmatched breadcrumb text** | Console logs, URLs, form values remain. |

Configure your SDK `beforeSend` hook to drop fields you do not want stored.

---

## Tenancy isolation

Dashboard APIs use PostgreSQL **row-level security**. The app sets `app.current_org_id` per session; policies on `projects`, `issues`, `events`, `releases`, `dsn_keys`, and related tables restrict rows to the active org.

Ingest resolves the project from the DSN key via a separate DB role — no dashboard session involved. Cross-tenant reads are blocked at the database layer. Test: `crates/server/tests/rls_isolation.rs`.

---

## RBAC matrix

Three roles. Higher roles inherit lower permissions.

| Action | Member | Admin | Owner |
|---|---|---|---|
| View issues, events, stats, alerts, releases | ✓ | ✓ | ✓ |
| Resolve, ignore, snooze, merge, split, bulk actions | ✓ | ✓ | ✓ |
| List projects and members | ✓ | ✓ | ✓ |
| Create / update projects (retention, ingest cap) | | ✓ | ✓ |
| Create / revoke DSN keys | | ✓ | ✓ |
| Manage webhooks | | ✓ | ✓ |
| Invite, change roles, remove members | | ✓* | ✓ |
| View pending invitations | | ✓ | ✓ |
| Delete project | | | ✓ |

\* Only owners can invite/promote to `owner`, modify owners, or change/remove admins. At least one owner must remain. Admins cannot change their own role.

Members triage errors but cannot rotate DSN keys, change retention, or reconfigure webhooks.

---

## Data lifecycle

1. SDK POST → HTTP **202 Accepted**.
2. Worker demangles JS/TS frames, scrubs, groups by fingerprint, writes to a monthly partition.
3. Daily job drops partitions older than `retention_days`. Issue aggregates survive.
4. Operators bulk-delete issues or delete projects (owner only).

No built-in export or anonymization pipeline in Phase 1. Back up Postgres on your schedule.

---

## EU operator checklist

| Question | epure posture |
|---|---|
| **Where does data live?** | Infrastructure you control. No mandatory Cloud dependency in OSS. |
| **Sub-processors** | None in core path. Optional Google OAuth sends auth to Google. Webhooks POST to your URLs. |
| **Telemetry** | No phone-home in OSS. |
| **PII in events** | Partial regex scrub; `user.id` / `user.email` retained by design. |
| **Retention** | 14 / 30 / 90 days per project. |
| **Access control** | RLS + three-role RBAC. |
| **Erasure** | Delete issues, projects, or the database. No data-subject portal in Phase 1. |
| **DPA with epure** | N/A for pure self-host (you are controller). |

We do **not** claim "GDPR compliant," "zero PII," or "HIPAA certified." Document your lawful basis and subprocessors in your own privacy notices.

Operator questions: `support@news.epure.sh`. Vulnerabilities: [SECURITY.md](SECURITY.md) · `security@news.epure.sh`.

---

## Production hardening

| Setting | Purpose |
|---|---|
| `docker-compose.prod.yml` overlay | `EPURE_SESSION_SECURE=1`, Postgres not exposed on host |
| HTTPS reverse proxy | Secure session cookies (`__Host-epure.sid`) |
| `EPURE_PUBLIC_URL` | Correct OAuth callbacks |
| Strong passwords, DSN rotation | Leaked DSN allows ingest until revoked |
| `EPURE_WEBHOOK_ALLOW_PRIVATE=0` | Blocks webhooks to private IPs (default) |
| Postgres backups | Your responsibility |

Detail: [docs/SELF_HOST.md](docs/SELF_HOST.md). Vulnerabilities: [SECURITY.md](SECURITY.md) · `security@news.epure.sh`.
