# Frontend playground

Fast UX iteration without Docker or Postgres. The full dashboard runs against an in-memory mock API with realistic seed data.

## Start

```bash
cd web
npm install
npm run dev:playground
```

Opens http://localhost:5173 with hot reload. No login required — session is mocked.

## What's included

| Screen | Seed data |
|---|---|
| Issues | 9 issues across 2 projects (unresolved, regression, resolved, ignored, **snoozed**) |
| Issue detail | Stack traces, breadcrumbs, multi-occurrence events |
| Alerts | Velocity + regression alerts |
| Releases | 3 web releases, 1 API release |
| Settings | DSN keys, team, webhooks |
| Design Lab | `/__design` — all primitives + theme diff panel |

Fixtures live in `playground/fixtures/seed.ts`. Event payloads reuse `fixtures/seed/events/*.json` from the repo root so playground and backend seeds stay aligned.

## Edit workflow

1. Change UI in `web/src/` (features, shell, ui kit)
2. Adjust seed data in `playground/fixtures/seed.ts` for new UX states
3. Reload — Vite HMR picks up component changes instantly

To reset interactive state (resolve, merge, etc.) after clicking around:

```js
window.__EPURE_PLAYGROUND__.reset()
```

To open the setup wizard (Checkout Web — incomplete):

```js
window.__EPURE_PLAYGROUND__.openSetup()
```

Or open `/?setup=880e8400-e29b-41d4-a716-446655440099` — dialog overlays the projects dashboard.
### Theme

Production style is **Calm Ledger (Indigo)** only (`data-style="calm-ledger"`). On `/__design`, check 8px buttons (not pills), paper/indigo tokens, unread = weight+dot/edge (no row wash), underline tabs, indigo-wash secondary, and quiet empty states (no dashed frame).

Try these queries on the Issues feed:

| Query | Surfaces |
|---|---|
| `is:unresolved` | Default feed, stat strip, unread bars |
| `is:regression` | Regression banner + badge (danger in Quiet Ledger only) |
| `is:snoozed` | Snooze banner on auth-token issue |
| `is:resolved` | Neutral resolved badges |

## vs full stack

| | Playground | `npm run dev` + compose |
|---|---|---|
| Backend | Mock fetch | Rust API on :8080 |
| Auth | Skipped | Real session |
| Data | Static + mutable in memory | Postgres + ingest |
| Use for | UX/layout/iteration | API integration, E2E |

For backend-backed dev with hot reload:

```bash
docker compose up          # terminal 1
cd web && npm run dev      # terminal 2, proxies /api → :8080
# register at /login for preview data, or:
./scripts/seed.sh --email you@example.com --password '…'
```
