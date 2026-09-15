# Security Policy

epure is self-hosted error tracking: a Rust binary and PostgreSQL 16. You run both containers on your infrastructure. We take security reports seriously and will respond to credible vulnerabilities in the OSS core.

## Supported versions

| Version | Supported |
|---|---|
| Latest release (`v0.1.0-phase1` and newer tags) | Yes |
| `main` branch | Yes — fixes land here first |
| Older tags / forks | No |

Security fixes are published as patch releases when practical. Upgrade with `docker compose pull && docker compose up -d --build`.

## Reporting a vulnerability

**Preferred:** [GitHub Private Vulnerability Reporting](https://github.com/epure-sh/epure/security/advisories/new) (creates a GHSA draft). This keeps details private until a fix ships.

**Alternative:** Email **security@epure.sh** *(TBD — not yet monitored; use GitHub advisories until this address is live)*.

Please include:

- A clear description of the issue and the impact (e.g. cross-tenant data access, auth bypass, remote code execution)
- Steps to reproduce, including epure version or commit SHA
- Any proof-of-concept you are comfortable sharing

Do **not** open a public GitHub issue for security vulnerabilities.

## What we will do

1. Acknowledge your report within **72 hours** (business days).
2. Confirm the issue and scope, usually within **7 days**.
3. Develop and test a fix on `main`.
4. Publish a patched release and a GHSA advisory with credit (unless you prefer anonymity).
5. Coordinate disclosure timing with you.

## Safe harbor

We support good-faith security research on your own epure instance. Do not test against epure Cloud or third-party deployments without written permission. Avoid privacy violations, data destruction, and service disruption beyond what is needed to demonstrate the bug.

## Scope

**In scope:** epure server (ingest, dashboard APIs, auth, worker pipeline), PostgreSQL RLS policies, session handling, webhook dispatch, and the bundled SPA.

**Out of scope:** Your reverse proxy, TLS configuration, host OS hardening, PostgreSQL backups, and misconfigured `.env` secrets. Sentry SDK behavior in your application code is your responsibility — epure scrubs common secret patterns at ingest but cannot audit your instrumentation.

## Data handling for reports

Keep reproduction data minimal. If your report includes real event payloads, redact end-user identifiers before sending.

For operator security practices (PII scrubbing, RBAC, production checklist), see [DATA.md](DATA.md).
