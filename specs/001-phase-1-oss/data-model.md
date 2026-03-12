# Data Model: Phase 1 OSS Exception Monitoring

**Feature**: `001-phase-1-oss` | **Date**: 2026-09-11

PostgreSQL 16 schema for Epure OSS. Migrations phased: **S1 minimal** → **S3 RLS + partitions** → **S5–S6 lifecycle/admin**.

---

## Entity Relationship Overview

```text
organizations
  ├── org_members ──► users
  ├── projects
  │     ├── dsn_keys
  │     ├── releases
  │     │     └── release_artifacts
  │     └── webhooks (S5)
  ├── issues
  │     ├── issue_unique_users (S3)
  │     └── (events → partitioned)
  └── org_invitations (S6)

events (PARTITION BY RANGE occurred_at)
  └── events_2026_09, events_2026_10, ...

tower_sessions (tower-sessions store)
issue_counters (spike / ingest stats)
alerts (S5)
user_feedback (S5)
```

---

## Core Tables

### `organizations`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | TEXT NOT NULL | |
| created_at | TIMESTAMPTZ | default now() |

Top-level tenant. All tenant-scoped rows reference `org_id`.

---

### `users`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| email | CITEXT UNIQUE NOT NULL | login identity |
| password_hash | TEXT NULL | argon2id hash for email+password login |
| google_sub | TEXT NULL UNIQUE | Google OIDC subject for OAuth login |
| created_at | TIMESTAMPTZ | |

Dashboard auth: **Google OAuth OR email + password** (constitution v1.1.0). No magic-link.

---

### `org_members`

| Column | Type | Notes |
|---|---|---|
| org_id | UUID FK → organizations | |
| user_id | UUID FK → users | |
| role | TEXT NOT NULL | `owner` \| `admin` \| `member` |
| created_at | TIMESTAMPTZ | |

**PK**: `(org_id, user_id)`

**RBAC rules**:

- `owner`: billing (Phase 2), delete org/project, all admin actions
- `admin`: DSN keys, project settings, invitations
- `member`: triage read/write on issues; no project deletion or DSN management

---

### `sessions` (tower-sessions)

Managed by `tower-sessions` Postgres store crate — standard schema from crate docs. Stores session ID, expiry, JSON blob (user_id, org_id context).

Dashboard auth: HttpOnly `__Host-` cookie → session → `org_id` for RLS.

---

### `projects`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | also embedded in DSN path `{project_id}` |
| org_id | UUID FK → organizations | |
| name | TEXT NOT NULL | |
| slug | TEXT | URL-safe identifier |
| retention_days | INT NOT NULL DEFAULT 30 | 14 \| 30 \| 90 |
| ingest_cap_per_hour | INT DEFAULT 5000 | safety cap |
| created_at | TIMESTAMPTZ | |

---

### `dsn_keys`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| project_id | UUID FK → projects | |
| public_key | TEXT NOT NULL | Sentry `sentry_key` |
| secret_key | BYTEA NOT NULL | hashed at rest (argon2id) or encrypted |
| label | TEXT | optional name |
| revoked_at | TIMESTAMPTZ NULL | non-null → reject ingest |
| created_at | TIMESTAMPTZ | |

**Index**: `(public_key)` unique where `revoked_at IS NULL`

Ingest auth: lookup by `public_key` → constant-time compare `secret_key`.

---

### `issues`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| org_id | UUID FK | denormalized for RLS |
| project_id | UUID FK → projects | |
| fingerprint | TEXT NOT NULL | SHA-256 hex |
| title | TEXT | exception type + message snippet |
| status | TEXT NOT NULL DEFAULT 'unresolved' | `unresolved` \| `resolved` \| `ignored` \| `regression` |
| level | TEXT | error, warning, … |
| first_seen_at | TIMESTAMPTZ | |
| last_seen_at | TIMESTAMPTZ | |
| event_count | BIGINT DEFAULT 0 | includes spike counter increments |
| unique_user_count | INT DEFAULT 0 | updated from issue_unique_users |
| environment | TEXT | latest or primary |
| release | TEXT | latest seen release |
| merge_parent_id | UUID NULL FK → issues | manual merge (S4) |
| resolved_in_release | TEXT NULL | regression engine (S5) |
| snooze_until | TIMESTAMPTZ NULL | |
| snooze_until_count | INT NULL | |
| snooze_until_users | INT NULL | |
| created_at | TIMESTAMPTZ | |

**Unique**: `(project_id, fingerprint)` where `merge_parent_id IS NULL`

**State transitions**:

```text
unresolved ──resolve──► resolved
unresolved ──ignore──► ignored
resolved + same fp in later release ──► regression
regression ──resolve──► resolved
any + merge ──► merge_parent_id set (canonical issue retains counts)
```

---

### `events` (partitioned parent — S3)

| Column | Type | Notes |
|---|---|---|
| id | UUID NOT NULL | PK includes partition key |
| org_id | UUID NOT NULL | |
| project_id | UUID NOT NULL | |
| issue_id | UUID NOT NULL | |
| occurred_at | TIMESTAMPTZ NOT NULL | partition key |
| environment | TEXT | |
| release | TEXT | |
| platform | TEXT | |
| runtime_name | TEXT | |
| runtime_version | TEXT | |
| browser_name | TEXT | |
| os_name | TEXT | |
| country_code | CHAR(2) | from IP geo |
| user_id | TEXT | from payload user.id |
| user_email | TEXT | scrubbed |
| payload_json | JSONB | full scrubbed event |
| stack_frames | JSONB | demangled frames array |
| breadcrumbs | JSONB | array of breadcrumb objects |
| created_at | TIMESTAMPTZ | |

**PK**: `(id, occurred_at)`

**Partitioning** (S3):

```sql
PARTITION BY RANGE (occurred_at);
-- Child: events_2026_09 FOR VALUES FROM ('2026-09-01') TO ('2026-10-01')
```

**S1 minimal**: single unpartitioned `events` table with same columns minus partition DDL.

---

### `releases`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| project_id | UUID FK | |
| version | TEXT NOT NULL | e.g. `v1.4.0` |
| created_at | TIMESTAMPTZ | |

**Unique**: `(project_id, version)`

---

### `release_artifacts`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| release_id | UUID FK → releases | |
| name | TEXT NOT NULL | filename e.g. `app.min.js.map` |
| storage_path | TEXT NOT NULL | local volume path (OSS) |
| checksum | TEXT | optional sha256 |
| created_at | TIMESTAMPTZ | |

Source maps stored on app container volume (`/data/artifacts/`).

---

### `issue_unique_users` (S3)

| Column | Type | Notes |
|---|---|---|
| issue_id | UUID FK → issues | |
| user_key | TEXT NOT NULL | coalesce(user.id, user.email) |
| first_seen_at | TIMESTAMPTZ | |

**PK**: `(issue_id, user_key)`

Alternative: HyperLogLog in Redis — **rejected** (no Redis). Exact table sufficient for Phase 1 scale.

---

### `issue_counters` / ingest stats

| Column | Type | Notes |
|---|---|---|
| project_id | UUID FK | |
| fingerprint | TEXT | |
| window_start | TIMESTAMPTZ | spike valve sync window |
| count | BIGINT | events in window |
| bodies_stored | BIGINT | vs counter-only drops |

Used to persist spike valve state across restarts and for ops visibility.

---

### `webhooks` (S5)

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| project_id | UUID FK | |
| url | TEXT NOT NULL | |
| format | TEXT | `slack` \| `discord` \| `generic` |
| events | TEXT[] | `issue_created`, `regression` |
| created_at | TIMESTAMPTZ | |

---

### `alerts` (S5)

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| org_id | UUID | |
| project_id | UUID | |
| issue_id | UUID NULL | |
| kind | TEXT | `velocity_spike`, `regression` |
| fired_at | TIMESTAMPTZ | |
| payload_json | JSONB | |

---

### `user_feedback` (S5)

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| event_id | UUID | |
| project_id | UUID | |
| name | TEXT | |
| email | TEXT | scrubbed |
| comments | TEXT | |
| created_at | TIMESTAMPTZ | |

---

### `org_invitations` (S6)

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| org_id | UUID FK → organizations | |
| email | CITEXT | invitee email |
| role | TEXT NOT NULL | `owner` \| `admin` \| `member` |
| token_hash | BYTEA | hashed single-use invite token |
| expires_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

Invitee registers or signs in with Google or password → role applied on acceptance.

---

## RLS Policies

Applied in **S3 migration** on all tenant-scoped tables.

**Session variable**: `app.current_org_id` (UUID string)

**Role setup**:

| Role | Purpose | RLS |
|---|---|---|
| `epure_ingest` | Worker writes from DSN-resolved scope | BYPASSRLS or no policies (explicit org_id/project_id in INSERT) |
| `epure_app` | Dashboard API | RLS enforced |

**Tables with RLS** (`org_id = current_setting('app.current_org_id')::uuid`):

- `projects`
- `issues`
- `events` (parent; inherited by partitions)
- `releases`
- `release_artifacts` (via join or denormalized org_id)
- `webhooks`
- `alerts`
- `dsn_keys` (via project org)
- `issue_unique_users` (via issue org)

**Tables without RLS** (global or auth plumbing):

- `organizations` (lookup by membership)
- `users`, `org_members`
- `sessions`, `org_invitations`
- `issue_counters` (ingest internal)

**Dashboard request pattern**:

```sql
BEGIN;
SET LOCAL app.current_org_id = '550e8400-e29b-41d4-a716-446655440000';
SELECT * FROM issues WHERE status = 'unresolved';
COMMIT;
```

---

## Indexes (recommended)

| Table | Index | Purpose |
|---|---|---|
| issues | `(project_id, status, last_seen_at DESC)` | issue list |
| issues | `(project_id, fingerprint)` UNIQUE | grouping |
| events | `(issue_id, occurred_at DESC)` | event detail per partition |
| events | `(project_id, environment, occurred_at DESC)` | env filter |
| dsn_keys | `(public_key)` WHERE revoked_at IS NULL | ingest auth |
| org_members | `(user_id)` | session → org lookup |

---

## Migration Phasing Summary

| Migration set | Slice | Adds |
|---|---|---|
| `001_*` | S1 | orgs, projects, dsn_keys, issues, events (flat), issue_counters |
| `002_*` | S2 | releases, release_artifacts; JSONB columns tuned |
| `003_*` | S3 | RLS enable + policies; partition events; issue_unique_users; TTL functions |
| `004_*` | S5 | webhooks, alerts, user_feedback, snooze columns |
| `005_*` | S6 | org_invitations; ingest_cap defaults |

S1 proofs run against flat schema. S3 migrates data to partitions without breaking ingest API contract.

---

## Validation Rules

| Rule | Source |
|---|---|
| `retention_days IN (14, 30, 90)` | FR-016 |
| Default retention 30 for new projects | Clarifications |
| Reject ingest if `dsn_keys.revoked_at IS NOT NULL` | FR-036 |
| Reject body > 2 MB | FR-007 |
| Spike valve 100/min/fingerprint default | FR-005 |
| Discard transaction envelope items | FR-001, Principle I |
| PII scrub before INSERT | FR-013 |
