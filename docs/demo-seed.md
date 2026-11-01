# Acme demo seed

Epure ships a mature **Acme** placeholder so first login and local heavy demos feel like a team that has used the product for months.

## Layers

| Layer | When | What |
|---|---|---|
| **Register bootstrap** | New account (`auth_bootstrap_workspace`) | Product source of truth for the placeholder: Acme Web + Acme API with ~18+6 issues, releases, cron monitors, alert channels/rules/history, webhooks, noise policy. Volume-light (1 event per issue). |
| **Heavy seed** | `./scripts/seed.sh` | Fixed UUIDs (`Acme Corp` / Web / API / Mobile), high event volume via ingest, plus the same ops entities (monitors, rules, channels, noise). |
| **`acme-seed.ts`** | Client empty-feed fallback only | Not a second catalog. Titles stay aligned with bootstrap; do not expand it into a parallel SoT. |
| **Playground** | `npm run dev:playground` | Same mature Acme narrative in [`web/playground/fixtures/seed.ts`](../web/playground/fixtures/seed.ts) + monitors/noise in [`web/playground/mock-api.ts`](../web/playground/mock-api.ts). Design-kit SoT for UI without a backend. |

Shared title list: [`scripts/demo-fixtures/titles.md`](../scripts/demo-fixtures/titles.md).

## Refresh

**New register workspace (bootstrap):**

1. Apply migrations (`docker compose up` / migrate as usual). Mature pack lives in `crates/storage/migrations/20261101000001_mature_demo_seed.sql`.
2. Register a new account — bootstrap runs once per org.
3. To re-see bootstrap data, use a fresh account (or wipe the org); do not expect re-register on the same org to re-seed.

**Heavy / fixed UUID demo:**

```sh
./scripts/seed.sh
# optional: attach an account
./scripts/seed.sh --email you@example.com --password '…'
```

`seed.sh` resets issues/events/alerts for the fixed projects, re-ingests, then runs `seed-heavy-post.sql`. Monitors, channels, rules, and noise policy are upserted from `seed-heavy.sql`.

## Intentionally thin

- Artifact / sourcemap uploads on releases
- Agent / MCP tokens
- Mobile deep catalog beyond heavy ingest
- 1k+ events inside register bootstrap (register must stay fast)

## Surfaces to click after register

Issues (status / env / priority filters) · Dashboard · Releases · Cron Monitors · Alerts history + rules · Settings DSN / noise filters.
