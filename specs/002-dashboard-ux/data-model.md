# Data Model: Dashboard UX

**Feature**: `002-dashboard-ux` | **Date**: 2026-09-12

UX-facing entities and minimal schema additions for headline stats and setup progress. Ingest, issues, events, and auth tables are unchanged from [001-phase-1-oss/data-model.md](../001-phase-1-oss/data-model.md).

---

## Entity Relationship (additions)

```text
users
  └── user_setup_progress ──► organizations
                          └── projects

issues (existing) ──► stats aggregates (read-only, no new table)
events (existing)   ──► events_7d count (read-only)
```

---

## New Table

### `user_setup_progress`

Tracks per-user onboarding ritual state for a project within an org. Drives SetupChecklist visibility and `/setup` redirect logic.

| Column | Type | Notes |
|---|---|---|
| user_id | UUID FK → users | dashboard user |
| org_id | UUID FK → organizations | RLS scope |
| project_id | UUID FK → projects | active project |
| project_named | BOOLEAN NOT NULL DEFAULT false | step 1 complete |
| dsn_copied_at | TIMESTAMPTZ NULL | step 2 complete timestamp |
| first_issue_seen_at | TIMESTAMPTZ NULL | step 4 — first grouped issue visible |
| completed_at | TIMESTAMPTZ NULL | all steps done; checklist dismissed |
| updated_at | TIMESTAMPTZ NOT NULL DEFAULT now() | last PATCH |

**PK**: `(user_id, org_id, project_id)`

**RLS**: `org_id = current_setting('app.current_org_id')::uuid` (same pattern as other tenant tables)

**Indexes**: `(org_id, project_id)` for org-admin views (optional)

**State transitions**:

```text
[new user] → project_named=false
  → PATCH project_named=true (setup step 1)
  → PATCH dsn_copied_at=now() (setup step 2)
  → [first issue ingested] → first_issue_seen_at=now() (client detect or server hook)
  → completed_at=now() → checklist hidden permanently for this triple
```

**Rules**:

- Returning user with `completed_at` set MUST NOT see setup flow (FR-UX-025)
- New org/project without progress row → treat as incomplete (show setup)
- `first_issue_seen_at` MAY be set by client when issue list returns ≥1 row, or by server when issue count transitions 0→1
- Revoked DSN does not reset progress — user re-copies from Settings

---

## Read Models (no persistence)

### Headline stats

Aggregated counts returned by `GET /api/v1/stats`. Not stored — computed on read.

| Field | Source | Filter scope |
|---|---|---|
| `unresolved` | `COUNT(*)` from `issues` WHERE `status = 'unresolved'` AND `merge_parent_id IS NULL` | `project_id`, `environment` (nullable = all envs) |
| `events_7d` | `COUNT(*)` from `events` WHERE `occurred_at >= now() - interval '7 days'` | `project_id`, `environment` |
| `regressions` | `COUNT(*)` from `issues` WHERE `status = 'regression'` AND `merge_parent_id IS NULL` | `project_id`, `environment` |

**Validation**:

- `project_id` required; must belong to session org (RLS)
- `environment` optional; when set, matches `issues.environment` / `events.environment`
- Zero counts return `0`, not null (edge case: regression count zero)

**Performance notes**:

- Issue counts: index on `(project_id, status, environment)` or existing list indexes
- Events 7d: partition pruning on `occurred_at` — query only partitions overlapping last 7 days
- Target <100 ms p95 for typical single-project org

---

## UX-facing entities (client state)

These are primarily client-side; only setup progress persists server-side.

### Setup progress (API + UI)

| UI step | Server field | Plain label |
|---|---|---|
| 1. Name project | `project_named` | "Create a project" |
| 2. Copy connection string | `dsn_copied_at` | "Copy your DSN" |
| 3. Send test error | (client-only helper) | "Send a test error" |
| 4. First issue seen | `first_issue_seen_at` | "First issue received" |

Compact checklist on Issues home shows steps 3–4 after `/setup` completes steps 1–2.

### Filter state (client only)

| Field | Type | Notes |
|---|---|---|
| `preset_chips` | string[] | Plain labels mapped to query tokens internally |
| `query` | string | Optional advanced syntax; hidden behind Filter popover |
| `applied_query` | string | Effective query sent to `GET /api/v1/issues?q=` |

Default applied query: unresolved issues for active project + environment (no `is:` visible on surface).

### Issue detail tab state (client only)

| Tab | Content source | Default |
|---|---|---|
| Overview | `IssueSummary` + primary actions | **active on select** |
| Stack | `EventDetail.stack_frames` via `CodeBlock` | lazy mount |
| Breadcrumbs | `EventDetail.breadcrumbs` | lazy mount |
| More | DiffPanel, SnoozeMenu, export, merge context | lazy mount |

Tab state MAY sync to URL hash (`#stack`) for shareable deep links — optional P1.

---

## API shapes

See [contracts/dashboard.openapi.yaml](./contracts/dashboard.openapi.yaml).

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/stats` | GET | Headline stats (FR-UX-024) |
| `/api/v1/setup` | GET | Read setup progress for user/org/project |
| `/api/v1/setup` | PATCH | Advance setup steps |

All routes require dashboard session + RLS org context (existing middleware).

---

## Migration

```sql
-- 20260912000001_setup_progress.sql (summary)
CREATE TABLE user_setup_progress (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_named BOOLEAN NOT NULL DEFAULT false,
  dsn_copied_at TIMESTAMPTZ,
  first_issue_seen_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_id, project_id)
);

ALTER TABLE user_setup_progress ENABLE ROW LEVEL SECURITY;
-- policy: org_id = current_setting('app.current_org_id')::uuid
```

Full migration with RLS policies ships in implementation slice D0.
