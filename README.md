<p align="center">
  <img src=".github/readme-hero.webp" alt="Epure issues dashboard" />
</p>

<p align="center">
  <a href="https://github.com/epure-sh/epure/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/epure-sh/epure/ci.yml?branch=main&label=CI" alt="CI status" /></a>
  <a href="https://github.com/epure-sh/epure/actions/workflows/image.yml"><img src="https://img.shields.io/github/actions/workflow/status/epure-sh/epure/image.yml?branch=main&label=Container" alt="Container build status" /></a>
  <a href="https://github.com/epure-sh/epure/releases/latest"><img src="https://img.shields.io/github/v/release/epure-sh/epure?label=Release" alt="Latest release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="Apache 2.0 license" /></a>
  <a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Rust-stable-orange?logo=rust&logoColor=white" alt="Rust" /></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 16" /></a>
</p>

# Epure

Self-hosted error tracking: grouped issues and stack traces, one Rust binary and PostgreSQL 16.

Keep the official Sentry SDK. Change the DSN to Epure. Docker Compose runs two containers (app + Postgres). You own backups and upgrades. Hosting the data means you are not billed per event.

| Lightweight | Keep your Sentry SDK | Built for agents |
| :--- | :--- | :--- |
| **~53 MiB combined idle.** App plus Postgres on a small VPS. | **DSN only.** Official Sentry SDK. Tracing, replay, and profiling sample rates stay at 0. | **Copy for AI.** Stack and breadcrumbs into Cursor or Claude, or [MCP and CLI](https://epure.sh/docs/guides/mcp-and-cli). |

## From clone to Issues
![Clone, docker compose up, Issues](.github/readme-shot.gif)

Docs: [architecture, deploy, and DSN migration](https://epure.sh/docs).

## Quickstart

**1. Start it**

```bash
git clone https://github.com/epure-sh/epure.git
cd epure
docker compose up -d
```

**2. Copy the DSN**

Open [http://localhost:8080](http://localhost:8080). Register, create a project, copy the DSN.

**3. Throw one error**

Keep the official Sentry SDK. Paste the Epure DSN. Set tracing, replay, and profiling sample rates to **0** (Epure does not store those payloads).

```javascript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN, // DSN from step 2
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  profilesSampleRate: 0,
});

Sentry.captureException(new Error("Epure test event"));
```

**4. Open Issues**

`Epure test event` is on the page. Grouped, with the stack.

Other languages, same DSN: [Pick your SDK](https://epure.sh/docs/platforms). It also lives under **Settings → SDK connection**, and the in-app **Setup** wizard shows it.

## Deploy

**On a VPS**

```bash
./configure --prod
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d
```

`./configure --prod` asks for the public HTTPS URL and writes the passwords. Put Caddy, nginx, or Traefik in front of port 8080. Open that URL and repeat steps 2 to 4.

After that account exists, set `EPURE_REGISTRATION=false` and recreate the container. Sign-in stays available. New workspaces cannot be created from the public URL. Invitation links still work.

Pin `EPURE_IMAGE` to the current release tag once the URL is public ([Releases](https://github.com/epure-sh/epure/releases) · [Installation](https://epure.sh/docs/self-hosting/installation)).

**On a platform**

| Platform | Start here |
| --- | --- |
| Render | Blueprint [`render.yaml`](render.yaml). |
| Railway | Drag [`deploy/railway/docker-compose.yml`](deploy/railway/docker-compose.yml) onto the project. [Notes](deploy/railway/README.md). |
| Coolify | Compose, base directory [`deploy/templates/coolify`](deploy/templates/coolify). |
| Dokploy | Compose file [`deploy/templates/dokploy/docker-compose.yml`](deploy/templates/dokploy/docker-compose.yml). |

Then the same steps: register, copy the DSN, throw once, open **Issues**. Longer list: [Installation](https://epure.sh/docs/self-hosting/installation) · [`deploy/`](deploy/README.md).

## Architecture

Two containers. The SDK talks to ingest; ingest returns 202 and a worker writes Postgres. The dashboard is the same binary.

<p align="center">
  <img src=".github/readme-architecture.png" alt="How an error gets in: your app sends an envelope to ingest (202 ACK), a worker demangles and groups into Postgres 16, and you open the dashboard over a session. One Rust binary on :8080. No Kafka, Redis, or ClickHouse." />
</p>

---

## Details

* Grouped issues and readable stack traces
* JS/TS sourcemaps
* Releases and regressions
* Alerts and webhooks
* Multi-project orgs and DSN rotation
* RBAC and PostgreSQL RLS
* Keyboard triage
* Spike protection

Epure does not store distributed traces, session replay, continuous profiling, generic logs, or infrastructure metrics. It does not symbolicate iOS/Android. Keep those sample rates at 0 in the SDK.

|  | Epure | Bugsink | Sentry self-hosted | GlitchTip |
| --- | --- | --- | --- | --- |
| **Primary focus** | Error tracking | Self-hosted error tracking | Errors plus tracing, replay, profiling | Errors and performance |
| **Deployment** | Two-container Compose | Single-container `docker run` | Large multi-service cluster | Multiple options |
| **License** | Apache 2.0. No `ee/` folder | PolyForm Shield 1.0.0 | Check current Sentry license | MIT |
| **Database** | PostgreSQL 16 | See their docs | Multiple datastores | PostgreSQL |

**Project Status:** Early release. Fits homelabs, side projects, and small teams who have tested backup and upgrade paths. Expect SDK and protocol gaps; [file them](https://github.com/epure-sh/epure/issues). [Changelog](CHANGELOG.md).

* [Report an Issue](https://github.com/epure-sh/epure/issues)
* [Join Discussions](https://github.com/epure-sh/epure/discussions)
* [Read CONTRIBUTING.md](CONTRIBUTING.md)
* [Security Policy](.github/SECURITY.md)

**License:** [Apache License 2.0](LICENSE). No separate closed-source core.
