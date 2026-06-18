# Security Policy

epure is self-hosted error tracking: a Rust binary and PostgreSQL 16. You run both containers on your infrastructure.

## Supported versions

| Version | Supported |
|---|---|
| Latest release (`v0.1.0-phase1` and newer tags) | Yes |
| `main` branch | Yes (fixes land here first) |
| Older tags / forks | No |

Security fixes ship as patch releases when practical. Upgrade with `docker compose pull && docker compose up -d --build`.

## Reporting a vulnerability

**Use [GitHub Private Vulnerability Reporting](https://github.com/epure-sh/epure/security/advisories/new)** (creates a GHSA draft). Keep details private until a fix ships.

Do **not** open a public GitHub issue for security vulnerabilities.

Prefer a private advisory. You can also email **`security@news.epure.sh`** (same confidentiality expectations).

Include:

- Description and impact (cross-tenant access, auth bypass, RCE, …)
- Steps to reproduce, including epure version or commit SHA
- Any proof-of-concept you are comfortable sharing

## What we will do

1. Acknowledge within **72 hours** (business days).
2. Confirm scope, usually within **7 days**.
3. Develop and test a fix on `main`.
4. Publish a patched release and a GHSA with credit (unless you prefer anonymity).
5. Coordinate disclosure timing with you.

## Safe harbor

Good-faith research on **your own** epure instance is welcome. Do not test against epure Cloud or third-party deployments without written permission. Avoid privacy violations, data destruction, and disruption beyond what you need to show the bug.

## Scope

**In scope:** epure server (ingest, dashboard APIs, auth, worker pipeline), PostgreSQL RLS policies, session handling, webhook dispatch, and the bundled SPA.

**Out of scope:** Your reverse proxy, TLS, host OS hardening, PostgreSQL backups, and misconfigured `.env` secrets. Sentry SDK behavior in your application is your responsibility. epure scrubs common secret patterns at ingest but cannot audit your instrumentation.

## Data handling for reports

Keep reproduction data minimal. Redact end-user identifiers from real event payloads before sending.

Operator practices (PII scrubbing, RBAC, production checklist): [DATA.md](DATA.md).
