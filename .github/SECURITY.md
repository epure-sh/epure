# Security Policy

Epure is self-hosted error tracking: a Rust binary and PostgreSQL 16. You run both containers on your infrastructure.

## Supported versions

| Version | Supported |
|---|---|
| Latest release (`v1.1.0` and newer tags) | Yes |
| `main` branch | Yes (fixes land here first) |
| Older tags / forks | Best-effort only |

Upgrade: `git pull && docker compose up -d` (pulls GHCR; pin `EPURE_IMAGE` in production). Guide: [epure.sh/docs/self-hosting/upgrades](https://epure.sh/docs/self-hosting/upgrades).

## Reporting a vulnerability

**Use [GitHub Private Vulnerability Reporting](https://github.com/epure-sh/epure/security/advisories/new)**. Keep details private until a fix ships.

Do **not** open a public GitHub issue for security vulnerabilities.

You can also email **`security@news.epure.sh`**.

Include: impact, repro steps, Epure version or commit SHA, and any PoC you are comfortable sharing.

## What we will do

1. Acknowledge within **72 hours** (business days).
2. Confirm scope, usually within **7 days**.
3. Fix on `main`, then patch release + GHSA with credit (unless you prefer anonymity).
4. Coordinate disclosure timing with you.

## Safe harbor

Good-faith research on **your own** Epure instance is welcome. Do not test against Epure Cloud or third-party deployments without written permission.

## Scope

**In scope:** Epure server (ingest, dashboard APIs, auth, worker), PostgreSQL RLS, sessions, webhooks, bundled SPA.

**Out of scope:** Your reverse proxy, TLS, host OS, Postgres backups, misconfigured `.env`, and Sentry SDK behavior in your app. Epure scrubs common secret patterns at ingest but cannot audit your instrumentation.

Operator data handling: [epure.sh/docs](https://epure.sh/docs) · PII / retention concepts: [Concepts](https://epure.sh/docs/get-started/concepts).
