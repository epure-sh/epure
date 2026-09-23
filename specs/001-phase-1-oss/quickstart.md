# Quickstart: Phase 1 OSS Exception Monitoring

**Feature**: `001-phase-1-oss` | **Date**: 2026-09-11

Runnable validation guide for local development and ROADMAP slice proofs. See [data-model.md](./data-model.md) and [contracts/ingest.openapi.yaml](./contracts/ingest.openapi.yaml) for schema and API details.

---

## Prerequisites

- Docker + Docker Compose v2
- Rust stable + `cargo`
- (Optional) Node 22+ for SPA dev (`web/`)
- `curl`, `jq`

---

## Environment Variables

**Compose users:** no `.env` required. `docker compose up` → `http://localhost:8080`.

| Path | When |
|---|---|
| `docker compose up` | Default — `8080` + `5433` |
| `cp .env.example .env` | Port conflict, demo seed, CORS, OAuth |
| `./configure --quick` | Same as above; auto-picks free ports |
| `./configure --prod` | Production VPS secrets |
| `.env.dev.example` → `.env.dev` | `cargo test` / host binaries against Compose Postgres |

Compose injects all three `DATABASE_URL*` values inside the container. Host-side cargo uses `.env.dev.example` (port **5433** by default).

| Variable | Compose `.env` | Default | Description |
|---|---|---|---|
| `EPURE_PORT` | Optional | `8080` | Host port for UI + ingest |
| `POSTGRES_HOST_PORT` | Optional | `5433` | Host port for Postgres (`psql`, `cargo test`) |
| `EPURE_PUBLIC_URL` | Optional | auto | Derived from `EPURE_PORT` on localhost; set for ngrok or production |
| `EPURE_DEV_SEED` | Optional | off | `1` = fixed-UUID scaffold (`scripts/seed-dev.sql`) on startup — no accounts/passwords; localhost only |
| `EPURE_CORS_ORIGINS` | Optional | `*` | Comma-separated ingest CORS origins |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional | empty | Google OAuth; leave empty for email/password |
| `DATABASE_URL` | `.env.dev` only | — | Host tools: `postgres://epure:epure@localhost:5433/epure` |
| `EPURE_BIND` | `.env.dev` only | `0.0.0.0:8080` | Listen address when running the binary on the host |
| `EPURE_MODE` | `.env.dev` only | `all` | Phase 1: only `all` supported |
| `RUST_LOG` | either | `info` | Log filter |

---

## Docker Compose (production-like)

From `apps/epure/`:

```bash
docker compose up --build
```

Expected services:

| Service | Image | Port |
|---|---|---|
| `epure` | built Dockerfile | `8080:8080` |
| `postgres` | `postgres:16-alpine` | `5433:5432` (host → container) |

Validate compose file without starting:

```bash
docker compose config
```

**S0 proof**: compose config validates; health endpoint responds after build.

---

## Health Check

```bash
curl -sS http://localhost:8080/health
```

Expected: `200 OK` with body indicating healthy (exact JSON defined in S0 implementation).

---

## Database Migrations

After Postgres is up (local or compose):

```bash
cd apps/epure
export DATABASE_URL=postgres://epure:epure@localhost:5433/epure
cargo sqlx migrate run --source crates/storage/migrations
```

Migrations apply in order; S1 minimal schema first, S3 adds RLS + partitions.

---

## Local Cargo Build & Test

```bash
cd apps/epure
./scripts/test.sh
```

Or manually:

```bash
export DATABASE_URL=postgres://epure:epure@localhost:5433/epure
cargo test
```

See `.env.test.example` for a copy-paste `DATABASE_URL`.

Run server locally (requires Postgres on host port 5433):

```bash
export DATABASE_URL=postgres://epure:epure@localhost:5433/epure
cargo run -p epure-server -- --mode=all
```

**S0 proof**: `cargo build` and `cargo test` succeed.

---

## Seed data

**Preview (default):** register at `/login`. New workspaces get Acme Web + Acme API with sample errors (test banner). No seed script required.

**Heavy UX fixtures** (fixed DSN UUIDs, 50+ issues, ~1k events, alerts, merges) — one command:

```bash
cd apps/epure
./scripts/seed.sh --email you@example.com --password 'choose-a-password'
# or attach an existing account:
./scripts/seed.sh --link-user you@example.com
```

Passwords are never written into seed SQL. Account creation uses the register API; `--link-user` only adds org membership.

| Step | Script |
|---|---|
| Org, projects, DSN, releases | `scripts/seed-heavy.sql` |
| Reset issues/events (idempotent) | `scripts/seed-events-reset.sql` |
| Ingest via `/api/{project}/store/` | `scripts/seed-heavy-ingest.py` |
| Backdate, statuses, merges, alerts | `scripts/seed-heavy-post.sql` |

Re-run `./scripts/seed.sh` to reset and re-seed. Event-only re-ingest:

```bash
./scripts/seed-heavy-ingest.py   # requires running Epure
docker compose exec -T postgres psql -U epure -d epure < scripts/seed-heavy-post.sql
```

Generated fixtures: `fixtures/seed/events/heavy/` (also writable via `python3 scripts/seed-heavy-ingest.py --write-fixtures`).

Optional fixed-UUID scaffold without accounts (curl tests): set `EPURE_DEV_SEED=1` in `.env` and restart `epure`, or:

```bash
docker compose exec -T postgres psql -U epure -d epure < scripts/seed-dev.sql
```

Seeded ingest DSN (after `./scripts/seed.sh` or `EPURE_DEV_SEED`):

| Field | Dev value |
|---|---|
| Project ID | `550e8400-e29b-41d4-a716-446655440000` |
| Public key | `a1b2c3d4e5f6g7h8i9j0` |
| Secret key | `supersecretdevkey` |

---

## Dashboard Login (S3c+)

Open `http://localhost:8080/login` after register (or after `./scripts/seed.sh --email …`).

- **Password**: register a new account, or use the email/password you passed to `seed.sh`.
- **Google OAuth**: set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in compose/env; the login page shows the Google button only when configured.

Verify session (replace credentials):

```bash
curl -sS -c /tmp/epure.cookies -b /tmp/epure.cookies \
  -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"choose-a-password"}'

curl -sS -b /tmp/epure.cookies http://localhost:8080/api/v1/auth/me
curl -sS -o /dev/null -w "issues=%{http_code}\n" -b /tmp/epure.cookies http://localhost:8080/api/v1/issues
```

Expected: login `204`, `/auth/me` `200`, `/issues` `200` with session cookie.

---

## Curl: Envelope Ingest Test (S1 proof)

Replace `{project_id}`, `{public_key}`, `{secret_key}` with seeded values from [Seed data](#seed-data).

### Minimal envelope payload

```bash
PROJECT_ID="{project_id}"
PUBLIC="{public_key}"
SECRET="{secret_key}"

ENVELOPE=$'{"event_id":"'$(uuidgen | tr '[:upper:]' '[:lower:]')'","sdk":{"name":"sentry.test"}}\n{"type":"event","length":120}\n{"exception":{"values":[{"type":"Error","value":"test crash"}]},"platform":"javascript","environment":"local"}\n'

curl -sS -w "\nHTTP %{http_code}\n" \
  -X POST "http://localhost:8080/api/${PROJECT_ID}/envelope/" \
  -H "Content-Type: application/x-sentry-envelope" \
  -H "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=${PUBLIC}, sentry_secret=${SECRET}" \
  --data-binary "$ENVELOPE"
```

Expected: **HTTP 202** — immediate acceptance.

Verify persistence (after worker flush, ~500ms):

```bash
docker compose exec postgres psql -U epure -d epure -c \
  "SELECT id, title, event_count FROM issues ORDER BY created_at DESC LIMIT 5;"
```

**S1 proof**: row appears in `issues` / `events`.

---

## Curl: Legacy Store Ingest Test

```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -X POST "http://localhost:8080/api/${PROJECT_ID}/store/" \
  -H "Content-Type: application/json" \
  -H "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=${PUBLIC}, sentry_secret=${SECRET}" \
  -d '{"exception":{"values":[{"type":"Error","value":"store path test"}]},"platform":"python","environment":"local"}'
```

Expected: **HTTP 202** (or 200 per implementation — both accepted in contract).

---

## Curl: Invalid DSN (negative test)

```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -X POST "http://localhost:8080/api/${PROJECT_ID}/envelope/" \
  -H "Content-Type: application/x-sentry-envelope" \
  -H "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=${PUBLIC}, sentry_secret=wrong" \
  --data-binary "$ENVELOPE"
```

Expected: **HTTP 401** or **403** — no row inserted.

---

## Curl: CORS Preflight (browser SDK)

```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -X OPTIONS "http://localhost:8080/api/${PROJECT_ID}/envelope/" \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: X-Sentry-Auth, Content-Type"
```

Expected: **HTTP 204** or **200** with `Access-Control-Allow-Origin` header.

---

## Spike Valve Smoke Test (S1 proof)

Send >100 identical crashes/minute (script or loop):

```bash
for i in $(seq 1 150); do
  curl -sS -o /dev/null -w "%{http_code}\n" \
    -X POST "http://localhost:8080/api/${PROJECT_ID}/envelope/" \
    -H "Content-Type: application/x-sentry-envelope" \
    -H "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=${PUBLIC}, sentry_secret=${SECRET}" \
    --data-binary "$ENVELOPE"
done
```

Expected:

- All responses **202** (never block client)
- `issues.event_count` ≥ 150
- `events` row count << 150 (bodies dropped after bucket saturates)

---

## Fixture-Based Tests

Run envelope tests against SDK dumps:

```bash
cargo test -p envelope -- fixtures
```

Fixtures live in `fixtures/sentry/{browser,node,python,go,ruby,php,java,dotnet}/`.

---

## SPA / Dashboard (S3b+)

After S3b build embeds SPA:

```bash
open http://localhost:8080/
```

Expected: Issues home with `0 UNRESOLVED EXCEPTIONS` empty state (no crashes yet).

UI dev with hot reload (local only):

```bash
cd web && npm install && npm run dev
# Proxies API to localhost:8080
```

**S3b proof**: `web/design/qa.md` checklist passes; no hex in JSX.

---

## RLS Isolation Test (S3 proof)

1. Create org A and org B with separate users (seed or S6 admin).
2. Ingest event into org A project.
3. Authenticate as org B user → query issues API.

Expected: org B sees zero rows from org A.

---

## Slice Proof Checklist

| Slice | Command / action | Pass criteria |
|---|---|---|
| S0 | `cargo build`; `docker compose config` | builds; compose valid |
| S1 | curl envelope → psql | 202 + Postgres row; spike drops bodies |
| S2 | upload `.map` + crash | demangled frames; PII redacted |
| S3 | two-org query | RLS isolation; partition drop |
| S3b | open `/`; QA.md | AppShell; token-bound UI |
| S4 | keyboard triage | no mouse; LLM export works |
| S5 | regression flow | webhook fires |
| S6 | `cargo test -p epure-server --test admin_rbac --test admin_invitations --test ingest_cap`; Settings UI | two projects + DSNs; env filter isolates staging; revoke → 403; Member blocked on admin routes; ingest cap → 403; invite → register → role; SDK → first issue <60s (see README) |

### S6 proof steps

1. **Login** — register or `./scripts/seed.sh --email … --password …` at `/login`.
2. **Two projects** — Settings → Projects → create a second project; Settings → DSN keys → create a key per project (distinct public keys).
3. **Environment isolation** — ingest events with `environment: production` vs `staging`; top-strip env filter shows only matching issues per project.
4. **Revoke DSN** — Settings → DSN keys → Revoke; curl ingest with revoked key → **403** `dsn_revoked`.
5. **RBAC** — invite a Member; delete project, patch settings, create DSN, create webhook → **403**.
6. **Ingest cap** — set project ingest cap to `1` in Settings; second envelope in the same hour → **403** `ingest_cap_exceeded`.
7. **Team invite** — Settings → Team → invite email; invitee registers with that email → assigned role (Member/Admin/Owner).
8. **SDK onboarding** — follow [README](../../README.md) SDK → first issue path (measured ~8s locally; claim <60s after your own measurement).

```bash
DATABASE_URL=postgres://epure:epure@localhost:5433/epure \
  cargo test -p epure-server --test admin_rbac --test admin_invitations --test ingest_cap
```

---

## Browser proofs (S3b + S4)

Recorded **2026-09-12** on `docker compose up --build` (M-series Mac, Chrome).

| Check | S3b `QA.md` / S4 | Result |
|---|---|---|
| AppShell loads at `/` after login | S3b | Pass — Issues empty state, rail + top strip |
| No hex in rendered UI | QA §10 | Pass — token-bound classes only (source grep clean) |
| `j`/`k` move selection | S4 | Pass — list focus changes without mouse |
| `e` resolve / `i` ignore | S4 | Pass — status updates optimistically |
| `/` focuses query bar | S4 | Pass |
| `Cmd+Shift+C` copies markdown export | S4 | Pass — export hint visible; handler mounted |
| Merge multi-select → split restored | S4 | Pass — `merge_split` integration test; UI: merge then "Split all merged" |
| Release diff (Occurrence \| Release toggle) | S4 | Pass — select two releases on issue with multi-release events; payload diff renders |
| Settings → Webhooks create/delete | S5/S6 | Pass — Admin+ only; Slack/Discord/generic formats |

Full `web/design/qa.md` pixel checklist (accent %, slashed-zero) — spot-checked visually; no blockers.

---

## Troubleshooting

| Symptom | Check |
|---|---|
| 202 but no row | Wait 500ms batch flush; check worker logs |
| Connection refused | `docker compose ps`; Postgres healthy |
| Migration fail | `DATABASE_URL` matches compose credentials |
| CORS blocked in browser | `EPURE_CORS_ORIGINS` includes frontend origin |
