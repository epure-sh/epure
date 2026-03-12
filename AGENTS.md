# AGENTS — apps/epure

This folder is the **product**. These files are **hydration**, not law.

| File | Role |
|---|---|
| [CONTEXT.md](./CONTEXT.md) | Dense resume of business + features + stack + UI. **Load first.** |
| [ROADMAP.md](./ROADMAP.md) | Slice plan + proofs. **What to build next.** |
| [README.md](./README.md) | Product storefront (public export: `launch-docs/out/`) |
| Canonical docs | Listed at the bottom of CONTEXT.md — open only when the digest is not enough |

## Load order

1. `CONTEXT.md` — what Epure is, what to ship, what to refuse
2. `../../business/FEATURES.md` — full matrix (Phase 1 = every row)
3. `../../business/ARCHITECTURE.md` — stack lock
4. `web/design/README.md` — tokens + kit contract (before Tier 4 triage)
5. `ROADMAP.md` — one slice at a time; slice done when **proof** works

## Slices (order)

Follow [ROADMAP.md](./ROADMAP.md). Do not skip proofs.

1. Gateway + persist (DSN → 202 → **Postgres** row)
2. Processing (sourcemaps, grouping, breadcrumbs, PII)
3. Storage (RLS, partitions, TTL, unique users)
3b. UI kit + AppShell + IA (`web/design/README.md`)
4–6. FEATURES tiers 4–6 on that shell
