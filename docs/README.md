# Documentation

Exception-only error monitoring for self-hosters. Official Sentry SDKs work when you change the DSN. epure groups production exceptions, demangles JS/TS stacks, and gives you calm keyboard triage. These docs follow [Diátaxis](https://diataxis.fr/): tutorials, how-to guides, and reference.

New here? Start with the [README](../README.md) for the one-screen install, then follow [QUICKSTART.md](./QUICKSTART.md) through your first grouped issue.

---

## Getting started

| Doc | What you get |
|---|---|
| [QUICKSTART.md](./QUICKSTART.md) | Golden path: `docker compose up` → health check → optional dev seed → first issue. Time budgets per step, envelope curl blocks, top-10 troubleshooting. |
| [MIGRATION.md](./MIGRATION.md) | Switch from Sentry in about 15 minutes. Change the DSN, tune SDK sample rates, rebuild alerts and webhooks. Rollback is restoring the old DSN. |

---

## Self-host and operate

| Doc | What you get |
|---|---|
| [SELF_HOST.md](./SELF_HOST.md) | Production overlay (`docker-compose.prod.yml`), environment variables, TLS notes, backups, upgrades, retention and ingest caps. |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Two-container topology, ingest pipeline, spike valve, RLS, partitions, and TTL. Three diagrams with plain-text fallbacks. |
| [DATA.md](../DATA.md) | PII scrub at ingest, RBAC roles, session handling, operator privacy posture (not legal advice). |
| [SECURITY.md](../SECURITY.md) | Vulnerability reporting: private GitHub advisory or `security@news.epure.sh`. |

---

## Reference and integration

| Doc | What you get |
|---|---|
| [COMPATIBILITY.md](./COMPATIBILITY.md) | Honest SDK matrix (8 language fixtures), supported endpoints, explicit non-features, SDK tuning (`tracesSampleRate: 0`), FAQ. |
| [ingest.openapi.yaml](./ingest.openapi.yaml) | Wire contract for envelope and store ingest. |
| [fixtures/sentry/](../fixtures/sentry/) | Real SDK envelope dumps used in CI and local smoke tests. |

---

## Project

| Doc | What you get |
|---|---|
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Build prerequisites, `./scripts/test.sh`, web dev, scope guard for PRs. |
| [SUPPORT.md](../SUPPORT.md) | Where to ask questions vs file bugs · `support@news.epure.sh`. |
| [GOVERNANCE.md](../GOVERNANCE.md) | Maintainer decision process and Phase 1 stack lock. |
| [CHANGELOG.md](../CHANGELOG.md) | Release notes (`v0.1.0-phase1`). |
| [LICENSE](../LICENSE) | Apache 2.0 |
| [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) | Contributor Covenant 2.1 · `conduct@news.epure.sh`. |

Report SDK or protocol gaps with the [compatibility issue template](../.github/ISSUE_TEMPLATE/02-compat.yml).

---

**Managed hosting:** [epure Cloud](https://epure.sh) — Pro $24/mo · Plus $79/mo. Flat pricing, no per-event overage. Commercial: `support@news.epure.sh`.
