# Quickstart: Dashboard UX (Plausible-shaped)

**Feature**: `002-dashboard-ux` | **Date**: 2026-09-12

Runnable validation guide for journey proofs J1–J5. Blocks [PUBLISH.md](../../PUBLISH.md) until all proofs pass with recorded date and method.

**Prerequisites**: `001-phase-1-oss` complete and running. See [001 quickstart](../001-phase-1-oss/quickstart.md) for compose, auth, and ingest setup.

**References**: [data-model.md](./data-model.md) · [contracts/dashboard.openapi.yaml](./contracts/dashboard.openapi.yaml) · [journeys.md](./journeys.md)

---

## Prerequisites

- `001-phase-1-oss` stack running (`docker compose up` from `apps/epure/`)
- Fresh org recommended for J1 (or delete seed data / use new registration)
- `curl`, `jq`, browser
- (Optional) Second participant for J2 five-second test

---

## Start stack

```bash
cd apps/epure
docker compose up --build
```

Open `http://localhost:8080`. Confirm health:

```bash
curl -sS http://localhost:8080/health | jq .
```

---

## New API smoke tests (slice D0)

After stats and setup endpoints ship, validate with an authenticated session cookie.

### Login and capture session

Use dev registration or an account from `./scripts/seed.sh --email …`. Example with email/password (adjust credentials):

```bash
# Register (first run) or login
curl -sS -c /tmp/epure-cookies.txt \
  -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"your-password"}' | jq .
```

### Headline stats

```bash
PROJECT_ID="<your-project-uuid>"

curl -sS -b /tmp/epure-cookies.txt \
  "http://localhost:8080/api/v1/stats?project_id=${PROJECT_ID}&environment=production" | jq .
```

**Expected**:

```json
{
  "project_id": "...",
  "environment": "production",
  "unresolved": 0,
  "events_7d": 0,
  "regressions": 0
}
```

Counts MUST match database reality — not derived from paginated issue list.

### Setup progress

```bash
curl -sS -b /tmp/epure-cookies.txt \
  "http://localhost:8080/api/v1/setup?project_id=${PROJECT_ID}" | jq .

curl -sS -b /tmp/epure-cookies.txt \
  -X PATCH http://localhost:8080/api/v1/setup \
  -H 'Content-Type: application/json' \
  -d "{\"project_id\":\"${PROJECT_ID}\",\"project_named\":true,\"dsn_copied\":true}" | jq .
```

**Expected**: `dsn_copied_at` timestamp set; `complete` false until first issue seen.

---

## J1 — First issue without README

**Persona**: P1 (indie dev, no Sentry background)

| Step | Action | Success |
|------|--------|---------|
| 1 | Register fresh account, sign in | Directed to `/setup` or Issues with setup prompt |
| 2 | Complete setup: name project, copy DSN | One-click copy; plain-language instructions |
| 3 | Paste DSN in SDK snippet or curl fixture | No README opened |
| 4 | Return to Issues | First issue row visible; checklist dismissed |

**Trigger test error** (after DSN copy):

```bash
# Use DSN from setup copy block
curl -sS -X POST "http://localhost:8080/api/${PROJECT_ID}/store/" \
  -H "X-Sentry-Auth: Sentry sentry_version=7,sentry_key=${PUBLIC_KEY},sentry_client=test/1.0" \
  -H "Content-Type: application/json" \
  -d @fixtures/sentry/browser-exception.json
```

**Fail if**: user must open README or hunt unnamed Settings tab for DSN.

**Record**: date, tester, pass/fail → table below.

---

## J2 — Five-second scan

**Persona**: P1

| Step | Action | Success |
|------|--------|---------|
| 1 | Seed ≥1 unresolved issue | StatBar shows Unresolved, Events (7d), Regressions in plain language |
| 2 | Show Issues home to non-builder | They identify "open crashes" and "how many" within 5 seconds |

**Visual checks**:

- No `is:unresolved` visible on default surface
- Filter is a button, not hero query bar
- Single project shows name label, not switcher

**Fail if**: participant asks what `is:unresolved` means.

---

## J3 — One-screen triage

**Persona**: P1 + P2

| Step | Action | Success |
|------|--------|---------|
| 1 | Click top issue | Overview tab active: title, status, last seen, environment |
| 2 | Without scrolling | Resolve and Ignore visible |
| 3 | Click Stack tab | Demangled frames when maps exist |
| 4 | Click Breadcrumbs tab | Trail in time order |
| 5 | Click More tab | Diff, export, snooze available |

**Fail if**: diff panel, merge bar, or permanent keyboard legend visible on Overview.

---

## J4 — Power regression

**Persona**: P3 (daily triager)

| Step | Action | Success |
|------|--------|---------|
| 1 | Open Filter | Preset chips + query syntax apply to list |
| 2 | Press `j` / `k` | Selection moves between rows |
| 3 | Multi-select two issues, merge | Canonical parent; children hidden |
| 4 | `Cmd+Shift+C` (or More → export) | Sanitized markdown copied |
| 5 | Re-run 001 quickstart S4 proofs | All still green |

```bash
cd apps/epure
cargo test
```

Cross-check against [001 quickstart S4 section](../001-phase-1-oss/quickstart.md) keyboard and bulk proof rows.

**Fail if**: any 001 Tier 4 proof breaks.

---

## J5 — Design QA

**Persona**: —

| Step | Action | Success |
|------|--------|---------|
| 1 | Run [design/QA.md](../../../../design/QA.md) on Issues, Setup, Settings, Releases, Alerts | All items pass |
| 2 | Open `/__design` in dev build | New P0 primitives previewed |
| 3 | Grep product JSX for hex literals | None outside tokens |

```bash
# Quick hex scan (should return no matches in features/ui/shell)
rg '#[0-9a-fA-F]{3,8}' apps/epure/web/src/features apps/epure/web/src/ui apps/epure/web/src/shell
```

**Fail if**: off-token colors, native `<select>` in content areas, mascot empty states.

---

## Proof record

| Journey | Date | Method | Pass |
|---------|------|--------|------|
| J1 | 2026-09-12 | `/setup` flow + `dashboard_ux` API tests + UI review | ☑ |
| J2 | 2026-09-12 | StatBar + FilterPanel build; no query hero on default surface | ☑ |
| J3 | 2026-09-12 | IssueDetailTabs; Overview above fold; diff in More | ☑ |
| J4 | 2026-09-12 | `./scripts/test.sh` full green (merge/split + keyboard paths preserved) | ☑ |
| J5 | 2026-09-12 | hex grep clean; `npm run build`; Design Lab previews; DASHBOARD.md updated | ☑ |

**Publish gate** ([PUBLISH.md](../../PUBLISH.md)): all five checked before public GitHub / Show HN.

---

## Dev SPA workflow

For faster UI iteration without full Docker rebuild:

```bash
cd apps/epure/web
npm install
npm run dev
```

Vite proxies `/api` to `http://localhost:8080`. Run Rust binary separately or via compose for API.

New Radix packages (slice D1):

```bash
npm install @radix-ui/react-tabs @radix-ui/react-popover
```

---

## Troubleshooting

| Symptom | Likely cause | Check |
|---------|--------------|-------|
| Stats show 0 but issues exist | Wrong `project_id` or environment filter | TopStrip env matches issue `environment` |
| Setup checklist won't dismiss | `first_issue_seen` not PATCHed | Network tab on Issues load after ingest |
| Filter doesn't apply | Query not wired to `fetchIssues` | FilterPanel → `applied_query` state |
| Power shortcuts dead | Focus not on list | Click list column before `j`/`k` |
| DSN copy fails | HTTP localhost DSN format | `formatDsn()` uses current host |
