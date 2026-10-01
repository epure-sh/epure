# Security Policy

Epure is self-hosted error tracking (Rust binary + PostgreSQL 16). You run it on your infrastructure.

## Supported versions

| Version | Supported |
|---|---|
| Latest release tag | Yes |
| `main` | Yes (fixes land here first) |
| Older tags / forks | Best-effort |

Upgrade: pin `EPURE_IMAGE` to the current release, then `docker compose pull && docker compose up -d`. Guide: [Upgrades](https://epure.sh/docs/self-hosting/upgrades).

## Reporting a vulnerability

1. **Preferred:** [GitHub Private Vulnerability Reporting](https://github.com/epure-sh/epure/security/advisories/new)
2. **Fallback:** email **`security@news.epure.sh`**

Do **not** open a public issue for security bugs.

Include: impact, repro (or clear source path), Epure version or commit SHA, and any PoC you are comfortable sharing.

## What we will do

1. Acknowledge within **72 hours** (business days).
2. Confirm scope, usually within **7 days**.
3. Fix on `main`, ship a patched release, publish a GHSA with credit (unless you prefer anonymity).
4. Coordinate disclosure timing with you.

## Scope

**In scope:** server (ingest, dashboard, Agent API / PATs, auth, worker), Postgres RLS, sessions, webhooks, bundled SPA.

**Out of scope:** your reverse proxy / TLS / host OS, Postgres backups, misconfigured `.env`, and Sentry SDK behavior in your app.

## Safe harbor

Good-faith research on **your own** Epure instance is welcome. Do not test against Epure Cloud or third-party deployments without written permission.
