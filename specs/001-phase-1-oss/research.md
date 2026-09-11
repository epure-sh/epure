# Research: Phase 1 OSS Exception Monitoring

**Feature**: `001-phase-1-oss` | **Date**: 2026-09-11

Consolidated technical decisions for implementation planning. All items resolved — no open NEEDS CLARIFICATION.

---

## 1. Spike Valve (Per-Fingerprint Token Bucket)

**Decision**: In-memory token bucket per SHA-256 issue fingerprint; default **100 tokens/minute** per fingerprint; on saturation discard payload bodies and increment `issues.event_count` (and in-memory counter) only; still return **202 Accepted**.

**Rationale**:

- Protects disk/RAM during infinite loops without blocking client SDKs (constitution Principle IV).
- Per-fingerprint isolation prevents one looping bug from throttling unrelated issues.
- In-memory bucket keeps hot path fast; periodic flush syncs counters to Postgres (every N seconds or on bucket state change).

**Implementation sketch**:

```text
DashMap<Fingerprint, TokenBucket>
  TokenBucket { tokens: f64, last_refill: Instant, rate: 100/min }

check(fp):
  refill tokens by elapsed time
  if tokens >= 1.0: consume 1.0 → AllowStore(body)
  else: DenyStoreBody → increment counter only
```

**Alternatives considered**:

| Alternative | Rejected because |
|---|---|
| Global rate limit per project | Doesn't stop single-fingerprint loops dominating storage |
| Redis-backed bucket | Violates OSS no-Redis constraint |
| Return 429 to client | SDKs may retry/backoff unpredictably; Sentry returns 200/202 on success path |
| Postgres-only counter | Too slow for hot-path per-event check |

---

## 2. Zero-Allocation Envelope Parsing

**Decision**: Scan raw request bytes with `memchr` / `bytes` to locate envelope item boundaries and extract the `event` item JSON slice by reference (`&[u8]`). Defer full serde deserialize to the worker task off the hot path.

**Rationale**:

- Constitution requires zero-allocation parse on ingest hot path.
- Sentry envelope format: headers line + payload pairs (`{headers}\n{payload}\n` repeated).
- Transaction items identified by `"type":"transaction"` in item header — skip without parsing payload body.

**Hot path steps**:

1. Validate `Content-Type` and body size (≤2 MB).
2. Split envelope into items via newline scanning.
3. For each item: parse item header JSON (small, bounded); if `type == transaction` → skip; if `type == event` → capture payload slice.
4. Pass `EventSlice` to mpsc; return 202 immediately.

**Alternatives considered**:

| Alternative | Rejected because |
|---|---|
| `serde_json` full parse in handler | Allocates full DOM on hot path |
| `nom` parser combinator | Heavier compile/runtime for simple newline-delimited format |
| Store raw envelope blob only | Defers grouping/spike fingerprint to worker — acceptable for body storage but fingerprint needed for spike valve; compute lightweight fingerprint hash from type + first frame substring in hot path if needed |

**Store endpoint**: Legacy path accepts gzip/zlib-wrapped JSON; decompress in worker, not handler (handler validates magic bytes + size only).

---

## 3. PostgreSQL RLS + Session Variable Pattern

**Decision**: Two SQLx pool modes:

1. **Ingest pool** — superuser or role with `BYPASSRLS` for worker writes scoped explicitly by `project_id`/`org_id` from DSN resolution.
2. **Dashboard pool** — role **without** bypass; every transaction starts with `SET LOCAL app.current_org_id = $1` from session.

**Rationale**:

- Constitution: ingest = DSN scope; dashboard = RLS scope (spec FR-T01–T03).
- `SET LOCAL` scopes to transaction — safe with SQLx pool connection reuse when wrapped in explicit transactions.
- Avoids app-filter-only tenancy bugs on multi-tenant self-host.

**RLS policy template**:

```sql
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY issues_tenant ON issues
  FOR ALL
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
```

**Middleware pattern (Axum)**:

```text
async fn rls_scope(org_id: OrgId, mut conn: PoolConnection, next) {
  let mut tx = conn.begin().await?;
  sqlx::query("SET LOCAL app.current_org_id = $1").bind(org_id).execute(&mut *tx).await?;
  next.run(tx).await
}
```

**Alternatives considered**:

| Alternative | Rejected because |
|---|---|
| App-level `WHERE org_id = ?` only | Error-prone; one missed query leaks data |
| Separate database per org | Operationally heavy for OSS self-host |
| RLS on ingest path | DSN auth already scopes writes; adds latency to hot path |

---

## 4. Monthly Partition Create/Drop for TTL

**Decision**: Partition `events` by `RANGE (occurred_at)` into monthly child tables `events_YYYY_MM`. Proactive creation of current + next month. Daily cron job drops partitions where partition month end < `now() - retention_days` (per-project retention: 14/30/90, default 30).

**Rationale**:

- `DROP TABLE events_2025_06` is O(1) vs DELETE millions of rows — ideal for small VPS.
- Issue aggregates live on `issues` table (not dropped) — spec requires counts survive TTL.
- Aligns with ARCHITECTURE.md monthly partition strategy.

**Migration phasing**:

- **S1**: single `events` table (unpartitioned) for ingest proof simplicity.
- **S3**: create partitioned parent + migrate/backfill + attach RLS policies on parent (policies propagate to partitions in PG 16).

**Partition DDL pattern**:

```sql
CREATE TABLE events (
  id UUID NOT NULL,
  org_id UUID NOT NULL,
  project_id UUID NOT NULL,
  issue_id UUID NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  ...
) PARTITION BY RANGE (occurred_at);

CREATE TABLE events_2026_09 PARTITION OF events
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
```

**TTL job**:

```sql
-- For each project retention setting, compute cutoff month
-- DROP TABLE IF EXISTS events_YYYY_MM where month_end < cutoff
```

**Alternatives considered**:

| Alternative | Rejected because |
|---|---|
| Row-level DELETE job | Slow; bloats small VPS disks |
| TimescaleDB extension | Extra dependency; violates lite compose |
| Single table + partial index delete | Doesn't reclaim disk quickly |

---

## 5. rust-embed + Vite Build Integration

**Decision**: Multi-stage Dockerfile — Stage 1: Node builds `web/dist`; Stage 2: Rust `cargo build --release` embeds dist via `RustEmbed`. Axum serves embedded files with `Content-Type` sniffing; SPA fallback returns `index.html` for non-asset routes.

**Rationale**:

- Constitution: no Nginx/Node in product compose; single binary delivery.
- rust-embed compiles assets into binary — one artifact to ship.

**Build pipeline**:

```text
web/: npm ci && npm run build  →  web/dist/
server: RustEmbed #[folder = "../../web/dist/"]
Dockerfile:
  FROM node:22 AS web-build
  COPY web/ → npm run build
  FROM rust:1.xx AS rust-build
  COPY --from=web-build web/dist web/dist
  cargo build --release
```

**Dev workflow**: `vite dev` with proxy to `localhost:8080` for API (local only). Production compose uses embedded assets only.

**Cache headers**: `index.html` → no-cache; hashed assets → long cache (Vite default filenames).

**Alternatives considered**:

| Alternative | Rejected because |
|---|---|
| Nginx sidecar | Forbidden in OSS compose |
| Separate static file volume | Extra mount complexity; not single binary |
| SSR triage | Forbidden by constitution |

---

## 6. Sentry Envelope vs Store Compatibility

**Decision**: Implement both paths to official Sentry SDK spec subset for **exception events only**.

### Envelope (`POST /api/{project_id}/envelope/`)

- **Content-Type**: `application/x-sentry-envelope`
- Body: newline-delimited `{json_headers}\n{payload}\n` items
- Process: `event` items → persist; `transaction` items → discard; `attachment` → metadata only (optional Phase 1: ignore attachment bodies)
- Auth: `X-Sentry-Auth: Sentry sentry_version=7, sentry_key={public}, sentry_secret={secret}` or query params
- Response: **202 Accepted** with `{}` or Sentry-compatible JSON `{"id": "<event_id>"}`

### Legacy store (`POST /api/{project_id}/store/`)

- **Content-Type**: `application/json` or compressed variants
- Body: single event JSON; may be gzip/zlib compressed (`Content-Encoding`)
- Auth: same DSN header scheme
- Response: **200 OK** or **202 Accepted** (match Sentry behavior; plan standardizes on 202 for both)

### CORS

- `OPTIONS` on ingest routes returns configurable `Access-Control-Allow-Origin` (env `EPURE_CORS_ORIGINS`, default `*` for dev)
- Required headers: `X-Sentry-Auth`, `Content-Type`, `Content-Encoding`

### Compatibility honesty

- Publish version matrix per SDK fixture — never claim 100% parity
- Phase 1 gaps (documented): no native mobile symbolication, no session replay, no performance transactions, no attachment storage at scale

**Fixture languages** (minimum): browser, Node, Python, Go, Ruby, PHP, Java, .NET — stored under `fixtures/sentry/{lang}/`.

**Alternatives considered**:

| Alternative | Rejected because |
|---|---|
| Proprietary Epure SDK | Violates adoption wedge (change DSN only) |
| Envelope-only | Breaks legacy SDKs and curl reporters |
| Full Sentry parity | Out of scope; dishonest |

---

## Summary Table

| Topic | Decision |
|---|---|
| Spike valve | In-memory token bucket, 100/min/fingerprint, counter-only when saturated |
| Envelope parse | memchr/bytes zero-alloc scan; full JSON in worker |
| Tenancy | DSN → project (ingest); session → RLS `app.current_org_id` (dashboard) |
| Partitions | Monthly `events_YYYY_MM`; DROP for TTL; aggregates on `issues` |
| SPA delivery | Vite build → rust-embed → Axum fallback |
| Wire protocol | Envelope + store; transactions discarded; honest matrix |
