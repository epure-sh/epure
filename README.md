<p align="center">
  <img src=".github/readme-hero.webp" alt="Epure" />
</p>

# Epure

[Epure](https://epure.sh) is exception-only error monitoring for self-hosters. Keep your official Sentry SDKs. Change the DSN. When production throws, you get a grouped issue and a stack you can read.

- [x] Official Sentry SDK ingest (envelope + store). [Docs](docs/COMPATIBILITY.md)
- [x] Grouped issues, breadcrumbs, JS/TS sourcemaps. [Docs](docs/QUICKSTART.md)
- [x] Spike valve for infinite loops. [Architecture](docs/ARCHITECTURE.md)
- [x] Keyboard triage (`j` / `k` / `e` / `i`) + Markdown export for LLMs
- [x] Alerts, webhooks, releases, regressions
- [x] Multi-project orgs, DSN rotate/revoke, RBAC
- [x] Two containers: Rust binary + PostgreSQL 16 with RLS. [Self-host](docs/SELF_HOST.md)
- [x] Dashboard

![Epure Issues dashboard](.github/readme-shot.webp)

**2 containers** · **~82 MiB** idle · **~9 s** to first issue · measured 2026-09-12 on Docker Desktop (re-verify on your hardware).

Watch "releases" of this repo to get notified of major updates.

## Documentation

Full docs: [epure.sh/docs](https://epure.sh/docs) · in-repo index: [docs/README.md](docs/README.md)

| Doc | Use it when |
|---|---|
| [QUICKSTART.md](docs/QUICKSTART.md) | First issue on a laptop |
| [SELF_HOST.md](docs/SELF_HOST.md) | Production box, TLS, backups |
| [MIGRATION.md](docs/MIGRATION.md) | Cutting over from Sentry |
| [COMPATIBILITY.md](docs/COMPATIBILITY.md) | SDK matrix and honest gaps |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Ingest, spike valve, RLS |
| [DATA.md](DATA.md) | PII scrub, RBAC, retention |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Patch / test / PR |

## Community & Support

- [GitHub Discussions](https://github.com/epure-sh/epure/discussions). Best for: setup questions and “did I wire the DSN wrong?”
- [GitHub Issues](https://github.com/epure-sh/epure/issues). Best for: bugs and SDK / protocol gaps (use a template).
- [SECURITY.md](SECURITY.md). Best for: vulnerabilities · `security@news.epure.sh`
- [SUPPORT.md](SUPPORT.md). Best for: where to ask · `support@news.epure.sh`
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Conduct reports · `conduct@news.epure.sh`

## Get started

Docker Compose v2:

```bash
git clone https://github.com/epure-sh/epure.git && cd epure
docker compose up --build
curl -sS http://localhost:8080/health   # → {"status":"ok"}
```

Open [http://localhost:8080](http://localhost:8080) → register → **Settings → DSN keys** → create a key → point your SDK.

```javascript
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "http://{public_key}@localhost:8080/{project_id}",
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  profilesSampleRate: 0,
});
```

No `@epure/*` package. Zero the extra product lines so transactions, replay, and profiles are discarded without surprise. Timed walkthrough: [docs/QUICKSTART.md](docs/QUICKSTART.md). Production overlay: [docs/SELF_HOST.md](docs/SELF_HOST.md).

<details>
<summary>Dev seed (skip register) — ⚠️ DEV ONLY</summary>

```bash
./scripts/seed-dev.sh
# login: dev@epure.local / devpassword
```

</details>

## How it works

Epure is a small stack for one job: production exceptions → grouped issues → calm triage. It is not a 1-to-1 mapping of Sentry. If the SDK sends transactions, replay, or profiles, the HTTP request is accepted and those items are dropped.

**Architecture**

Self-host with [Docker Compose](docker-compose.yml) (two containers). You can also use [managed hosting](https://epure.sh) (footer pricing).

| Piece | Role |
|---|---|
| **Ingest** | Envelope + legacy store. DSN auth. **202** before persist. |
| **Spike valve** | Fingerprint rate limit. Counter holds; duplicate bodies drop. |
| **Worker** | Demangle JS/TS, scrub PII, group by fingerprint, micro-batch write. |
| **PostgreSQL 16** | Issues, events (monthly partitions + TTL), sessions. RLS on dashboard APIs. |
| **Dashboard** | React SPA embedded in the Rust binary (`rust-embed`). Keyboard-first Issues UI. |

Details and diagrams: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### SDK clients

Keep the official Sentry clients. Epure is the destination.

| Language | Status | Notes |
|---|---|---|
| Browser (`@sentry/browser` 7.x) | E2E in CI | Sourcemaps demangle |
| Python (store) | E2E in CI | Raw frames |
| Node (`@sentry/node` 7.x) | Parse + fixture | Sourcemaps demangle |
| Go, Ruby, PHP, Java, .NET | Fixture captured | Raw frames |

Full matrix: [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md). Migration: [docs/MIGRATION.md](docs/MIGRATION.md).

### Out of scope (Phase 1)

Distributed tracing · session replay · continuous profiling · generic log ingest · iOS/Android symbolication · Redis / Kafka / ClickHouse on the path.

<details>
<summary>How Epure compares</summary>

Measured Epure figures from this repo (2026-09-12). Competitor figures from their documentation as of 2026-09. Re-verify before you rely on them.

| | **Epure** | **Sentry self-host** | **GlitchTip** |
|---|---|---|---|
| **Containers** | 2 | 20+ ([docs](https://develop.sentry.dev/self-hosted/)) | 4+ ([install](https://glitchtip.com/documentation/install)) |
| **RAM** | **~82 MiB** idle (measured) | 16 GB + swap ([guide](https://develop.sentry.dev/self-hosted/)) | 512 MB rec / 256 MB min |
| **SDK path** | Change DSN | Change DSN | Change DSN |
| **License** | Apache 2.0 | BSL / SaaS | MIT |

If GlitchTip is already quiet for you, stay there.

</details>

## Status badges

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Docker Compose](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![Rust](https://img.shields.io/badge/Rust-stable-orange?logo=rust&logoColor=white)](crates/)
[![CI](https://img.shields.io/github/actions/workflow/status/epure-sh/epure/ci.yml?branch=main&label=CI)](https://github.com/epure-sh/epure/actions/workflows/ci.yml)

---

**Apache 2.0** · no `ee/` split · [CHANGELOG](CHANGELOG.md) · [GOVERNANCE](GOVERNANCE.md) · [ROADMAP](ROADMAP.md)

**Managed hosting:** Epure Cloud — Pro $24/mo · Plus $79/mo. Flat pricing, no per-event overage. [epure.sh](https://epure.sh)
