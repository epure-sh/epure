# Publishing Epure OSS to GitHub

Phase 1 exit criterion (ROADMAP). **Do not Show HN until this checklist is complete.**

Public product repo: https://github.com/epure-sh/epure  
Marketing site: separate dedicated repo (not this tree).  
Community/docs staging: [`launch-docs/out/`](./launch-docs/out/) (merge into this repo root on publish).

Do **not** open the kelson company workspace as OSS. Do **not** ship landing inside this repo.

## Dedicated product repo

This folder **is** the product tree. Overlay storefront files from `launch-docs/out/` at the repo root when publishing.

Required at public repo root:

- `README.md` (storefront: use `launch-docs/out/README.md`)
- `LICENSE` (Apache 2.0)
- `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SUPPORT.md`, `GOVERNANCE.md`
- `DATA.md`, `CHANGELOG.md`, `ROADMAP.md`
- `docs/` (from `launch-docs/out/docs/`)
- `.github/` (templates, `workflows/ci.yml`, `workflows/image.yml`, dependabot, `issues-list.webp`, `social-preview.png`)
- `docker-compose.yml` + `docker-compose.build.yml` + `docker-compose.prod.yml` + `Dockerfile` + `Dockerfile.runtime` + `fixtures/sentry/`
- `configure` + `scripts/configure.sh` + `Makefile` + `.env.example` + `.env.dev.example` + `.env.production.example` + `.env.test.example`
- `web/design/` (product design system — not the marketing `design/`)

Do **not** ship company-workspace agent hydration (`AGENTS.md` / `CONTEXT.md`) in the public tree — keep those files internal only.

## Pre-push checklist

- [x] `cargo test` green with `DATABASE_URL=postgres://epure:epure@localhost:5433/epure` (or `./scripts/test.sh`)
- [x] `docker compose up` pulls `ghcr.io/epure-sh/epure` → `/health` OK; register → Acme preview; `./scripts/seed.sh --email … --password …` → heavy login works
- [x] GHCR package **public** on `epure-sh/epure` (first `Image` workflow push, then Settings → Packages)
- [x] Production deploy uses `docker-compose.prod.yml` overlay (`EPURE_SESSION_SECURE=1`, Postgres not exposed on host); see `docs/SELF_HOST.md`
- [x] `LICENSE` (Apache 2.0) at repo root
- [x] README onboarding + community health files present
- [x] FEATURES gaps closed (split, release diff, webhooks UI, releases list)
- [x] No secrets in git (`.env`, DSN secrets, Google OAuth keys)
- [x] Measured claims dated; no SQLite-primary drift
- [x] Tag release `v0.1.0-phase1` after first public push
- [x] Re-measure idle RAM + first-issue path on publish hardware (2026-09-20: ~50 MiB / ~10 s)
- [ ] Demo GIF (optional) at `.github/issues-demo.gif` (still uses `issues-list.webp`)
- [x] Contact mail: `{role}@news.epure.sh` (`security@`, `support@`, `conduct@`) — no Discord / waitlist URL in README

## Remote status

| Item | Value |
|------|-------|
| Repo | https://github.com/epure-sh/epure |
| Release | [v1.1.0](https://github.com/epure-sh/epure/releases/tag/v1.1.0) (prior: [v1.0.0](https://github.com/epure-sh/epure/releases/tag/v1.0.0), [v0.1.0-phase1](https://github.com/epure-sh/epure/releases/tag/v0.1.0-phase1)) |
| CI workflow | `.github/workflows/ci.yml` (badge label: **CI**) |
| Image workflow | `.github/workflows/image.yml` (`v*` tags + dispatch; native `linux/amd64` + `linux/arm64`) |
| GHCR | `ghcr.io/epure-sh/epure:latest` / `:v1.1.0` — public multi-arch |

## GHCR visibility (one-time, UI only)

GitHub’s API cannot make an org container public. Keep the package Public so `docker compose up` works without login.

1. Org: [Package creation](https://github.com/organizations/epure-sh/settings/packages) → allow **Public**.
2. Package: [epure container settings](https://github.com/orgs/epure-sh/packages/container/epure/settings) → Danger Zone → **Change visibility** → **Public**.
3. Confirm: `docker pull ghcr.io/epure-sh/epure:latest` (no login).
| Community files | SECURITY, CONTRIBUTING, CODE_OF_CONDUCT, SUPPORT, GOVERNANCE |

## Social preview (manual)

GitHub has no public upload API for the social image.

1. Open **Settings → General → Social preview** on `epure-sh/epure`.
2. Upload `.github/social-preview.png` from this tree (`launch-docs/out/.github/social-preview.png`, 1280×640).
3. Confirm the Open Graph card on a fresh link unfurl after cache clears.

Repo description (suggested): `Exception-only error monitoring. Sentry SDK compatible. 2-container self-host.`  
Homepage: `https://epure.sh`
