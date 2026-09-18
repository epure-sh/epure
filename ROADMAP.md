# ROADMAP — Epure OSS

Phase 1 exception monitoring. UI: [web/design/README.md](./web/design/README.md).

**Rule:** one slice at a time. Done when the **proof** works.

Phase 1 = S0–S6. Phase 2 = Cloud ([epure.sh](https://epure.sh)).

## Status

- [x] S0–S6 (see [QUICKSTART](./docs/QUICKSTART.md) + `./scripts/test.sh`)
- [x] Dashboard UX polish
- [x] Public release `v0.1.0-phase1`

## Slices

| Slice | Ship | Proof |
|---|---|---|
| **S0** | Workspace + compose | `cargo build` · `docker compose config` |
| **S1** | Envelope/store, spike valve, persist | SDK → **202** → Postgres row |
| **S2** | Maps, breadcrumbs, fingerprint, PII scrub | Demangled frames · grouped issues |
| **S3** | RLS, partitions, TTL, unique users | Cross-org blocked · old partition dropped |
| **S3b** | UI kit + AppShell | [web/design/qa.md](./web/design/qa.md) |
| **S3c** | Google + password sessions | Unauth API → 401 |
| **S4** | Keyboard triage, merge/split, export | Issue without mouse |
| **S5** | Regression, snooze, velocity, webhooks | Regression webhook fires |
| **S6** | Multi-project, DSN, RBAC, caps | Revoke → **403** |

## Out of scope (Phase 1)

Tracing · replay · profiling · generic logs · iOS/Android symbolication · Redis/Kafka/ClickHouse · “100% Sentry parity.”

Phase 2 Cloud is tracked separately — no OSS PRs that assume Cloud infra or an `ee/` tree.
