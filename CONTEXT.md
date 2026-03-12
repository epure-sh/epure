# CONTEXT — Epure (digest)

Hydration for agents in `apps/epure`. **Not canonical.** If this disagrees with a source below, the source wins — then fix this file.

| Canonical | For |
|---|---|
| `business/THESIS.md` `WEDGE.md` `ICP.md` | Why / who |
| `business/FEATURES.md` | Full matrix (Phase 1 = every row) |
| `business/ARCHITECTURE.md` | Stack, Postgres, RLS, compose |
| `business/PRODUCT.md` | Build order |
| `apps/epure/ROADMAP.md` | Slice plan + proofs |
| `web/design/README.md` | UI kit + tokens contract |
| `business/ARCHITECTURE.md` | Stack lock + agent constraints |

---

## Product

**Epure** · `epure.sh` · Apache 2.0 OSS · Cloud Phase 2.  
Exception-only error tracking. Official Sentry SDKs, change `dsn`. Spike valve. Keyboard triage. Pro **$24** / Plus **$79** later.

Job: app throws → grouped issue + readable stack → ship the fix.

**Deploy (Phase 1):** 2 containers — **Rust binary** (ingest + API + embedded SPA) + **PostgreSQL 16**. Not Sentry’s 20+ stack. Still lite; not embedded SQLite.

Waitlist shipped outside repo. This folder is the product only.

---

## Never / not now

**Never:** tracing, replay, profiling, generic logs.  
**Not now:** iOS/Android, Redis/Kafka on OSS, SQLite as primary DB.  
**Not Phase 1:** Stripe, Cloud split modes, `ee/`, crons, SSO, audit.

---

## Stack (Phase 1)

**Rust:** Axum, Tokio, SQLx, mimalloc, rust-embed.  
**Postgres 16:** RLS on tenant tables (`app.current_org_id`). Sessions in Postgres. Monthly `events_YYYY_MM` partitions; TTL drops old partitions.  
**Ingest:** Tokio mpsc, 202 &lt;10 ms, spike valve, 2 MB cap, micro-batch writes.  
**Auth:** axum-login, tower-sessions, argon2id, `__Host-` cookies.  
**UI:** React 19, Vite, Radix, Tailwind v4, `@design` tokens. `ui/` → `shell/` → `features/`.  
**Fixtures:** browser, Node, Python, Go, Ruby, PHP, Java, .NET. JS/TS sourcemaps only.

---

## Phase 1 features (every row)

See `business/FEATURES.md`. Build order: Gateway → Processing → Storage (Postgres+RLS) → **3b kit+shell** → Triage → Lifecycle → Admin.

Slices: `ROADMAP.md` (S0→S6, full Phase 1 FEATURES).

---

## Design

Plausible-shaped calm UX on indigo tokens. Tokens in `web/design/tokens.css`. Kit in `web/src/ui/`. Issues = home (master-detail). Keyboard `j/k/e/i`. Empty: `0 UNRESOLVED EXCEPTIONS`. QA = `web/design/qa.md`.

---

## Proof (do not invent)

RAM, TTFI, SDK matrix: NEED-PROOF until measured (`marketing/landing/PROOF_INVENTORY.md`).
