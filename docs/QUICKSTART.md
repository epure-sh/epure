# Quickstart

Full operator path: first exception → grouped issue in the dashboard. If the [README](../README.md) quick start worked, jump to [Optional depth](#optional-depth) or [Contributing](#contributing-and-ci).

**2026-09-12** (M-series Mac, Docker Desktop, cached images): compose → login → envelope → issue in **~9 s** warm; **<60 s** with dev seed. First no-cache build: **~160 s** one-time.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Docker + Docker Compose | v2 | Runs epure + PostgreSQL 16 |
| `curl` | any | Health checks and smoke tests |
| `jq` | optional | Pretty-print JSON responses |
| Rust stable + `cargo` | optional | Local builds and `./scripts/test.sh` |
| Node 22+ | optional | SPA hot reload (`web/`) |

No Redis, Kafka, or external object store. Two containers only — see [Architecture](./ARCHITECTURE.md).

---

## Golden path (Steps 1–7)

Total time with cached images and dev seed: **~45–60 s**. Warm stack (compose already running): **~2 s** to first issue after ingest.

| Step | Action | Expected time |
|---|---|---|
| **1** | Clone and enter the repo | ~5 s |
| **2** | Start the stack | ~9 s (cached) · ~160 s (first no-cache build) |
| **3** | Verify health | ~1 s |
| **4** | Seed dev data (optional) | ~5–10 s |
| **5** | Log in to the dashboard | ~5 s |
| **6** | Ingest a test exception | ~2 s |
| **7** | Confirm the issue in the UI | ~2 s |

### Step 1 — Clone

```bash
git clone https://github.com/epure-sh/epure.git
cd epure
```

Optional: copy `.env.example` to `.env` if you override compose defaults. Compose sets `DATABASE_URL` for the app service automatically.

### Step 2 — Start the stack

```bash
docker compose up --build
```

Expected services:

| Service | Image | Port |
|---|---|---|
| `epure` | built Dockerfile | `8080:8080` |
| `postgres` | `postgres:16-alpine` | `5433:5432` (host → container) |

Validate the compose file without starting:

```bash
docker compose config
```

Leave this terminal running, or start detached: `docker compose up --build -d`.

### Step 3 — Verify health

```bash
curl -sS http://localhost:8080/health
```

Expected: `200 OK` with `{"status":"ok"}`.

### Step 4 — Seed dev data (optional)

For a one-command smoke test with a pre-built org, project, DSN, and dashboard user:

```bash
./scripts/seed-dev.sh
```

When epure is already running, `seed-dev.sh` also ingests realistic sample issues (stack traces, breadcrumbs, multiple users/releases). To seed events only:

```bash
./scripts/seed-events-dev.sh
```

<details>
<summary>⚠️ DEV ONLY — seeded credentials</summary>

These values exist only for local development. **Never use them in production.**

| Field | Dev value |
|---|---|
| Email | `dev@epure.local` |
| Password | `devpassword` |
| Member (RBAC tests) | `member@epure.local` / `devpassword` |

| Field | Dev value |
|---|---|
| Project ID | `550e8400-e29b-41d4-a716-446655440000` |
| Public key | `a1b2c3d4e5f6g7h8i9j0` |
| Secret key | `supersecretdevkey` |

Alternative: register a new account at `/login` and skip the seed entirely.

Or enable startup seed (dev only): set `EPURE_DEV_SEED=1` in `.env` and restart the `epure` service.

Manual re-apply:

```bash
docker compose exec -T postgres psql -U epure -d epure < scripts/seed-dev.sql
```

</details>

### Step 5 — Log in

Open [http://localhost:8080/login](http://localhost:8080/login).

- **Password:** ⚠️ DEV ONLY: use `dev@epure.local` / `devpassword` after seeding, or register a new account.
- **Google OAuth:** set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in compose/env; the login page shows the Google button only when configured.

Verify session from the terminal:

```bash
# ⚠️ DEV ONLY credentials
curl -sS -c /tmp/epure.cookies -b /tmp/epure.cookies \
  -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@epure.local","password":"devpassword"}'

curl -sS -b /tmp/epure.cookies http://localhost:8080/api/v1/auth/me
curl -sS -o /dev/null -w "issues=%{http_code}\n" -b /tmp/epure.cookies http://localhost:8080/api/v1/issues
```

Expected: login `204`, `/auth/me` `200`, `/issues` `200` with session cookie.

**Local HTTP:** `EPURE_SESSION_SECURE=0` (default in compose) so the session cookie works without HTTPS.

### Step 6 — Ingest a test exception

Replace `{project_id}`, `{public_key}`, `{secret_key}` with your DSN values (seeded table above, or Settings → DSN keys).

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

With seeded values (⚠️ DEV ONLY), you can also post a captured fixture:

```bash
curl -sS -X POST "http://localhost:8080/api/550e8400-e29b-41d4-a716-446655440000/envelope/" \
  -H "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=a1b2c3d4e5f6g7h8i9j0, sentry_secret=supersecretdevkey" \
  -H "Content-Type: application/x-sentry-envelope" \
  --data-binary @fixtures/sentry/browser/envelope.txt
```

### Step 7 — Confirm the issue

Open [http://localhost:8080/](http://localhost:8080/). The new grouped issue should appear within ~500 ms (worker batch flush; measured **0.18 s** ingest-to-visible on warm stack).

Verify in Postgres:

```bash
docker compose exec postgres psql -U epure -d epure -c \
  "SELECT id, title, event_count FROM issues ORDER BY created_at DESC LIMIT 5;"
```

You now have a working local install. To point a real SDK at epure, change only the DSN — see [Migration](./MIGRATION.md).

---

## Dev vs production

| | Local (this guide) | Production |
|---|---|---|
| Compose file | `docker-compose.yml` | `docker-compose.yml` + `docker-compose.prod.yml` |
| Session cookie | `EPURE_SESSION_SECURE=0` | `EPURE_SESSION_SECURE=1` behind HTTPS |
| Dev seed | `./scripts/seed-dev.sh` or `EPURE_DEV_SEED=1` | **Never** — register real users |
| Public URL | `http://localhost:8080` | Your domain in `EPURE_PUBLIC_URL` |
| Backups / TLS / retention | Not required for smoke test | Required — see [Self-host](./SELF_HOST.md) |

<details>
<summary>Production path (collapsed)</summary>

For a production-like deployment:

1. Copy `.env.example` → `.env` and set `EPURE_PUBLIC_URL`, secrets, and `EPURE_SESSION_SECURE=1`.
2. Run with the production overlay: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`.
3. Put TLS in front (reverse proxy or load balancer).
4. Schedule Postgres backups and plan upgrades (`git pull && docker compose … up -d --build`).

Full checklist, env table, retention, and webhook hardening: **[Self-host — production checklist](./SELF_HOST.md#production-checklist)**.

</details>

---

## Optional depth

### Legacy store ingest

```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -X POST "http://localhost:8080/api/${PROJECT_ID}/store/" \
  -H "Content-Type: application/json" \
  -H "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=${PUBLIC}, sentry_secret=${SECRET}" \
  -d '{"exception":{"values":[{"type":"Error","value":"store path test"}]},"platform":"python","environment":"local"}'
```

Expected: **HTTP 202** (or 200 — both accepted).

### Invalid DSN (negative test)

```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -X POST "http://localhost:8080/api/${PROJECT_ID}/envelope/" \
  -H "Content-Type: application/x-sentry-envelope" \
  -H "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=${PUBLIC}, sentry_secret=wrong" \
  --data-binary "$ENVELOPE"
```

Expected: **HTTP 401** or **403** — no row inserted.

### CORS preflight (browser SDK)

```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -X OPTIONS "http://localhost:8080/api/${PROJECT_ID}/envelope/" \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: X-Sentry-Auth, Content-Type"
```

Expected: **HTTP 204** or **200** with `Access-Control-Allow-Origin` header.

### Heavy seed (dashboard UX testing)

For realistic volume across **Acme Web**, **Acme API**, and **Acme Mobile** (50+ issues, ~1k events, alerts, regressions, merges, user feedback):

```bash
./scripts/seed-heavy.sh
```

Login: `dev@epure.local` / `devpassword` (⚠️ DEV ONLY). Re-run to reset and re-seed.

### SPA / dashboard dev

UI dev with hot reload (local only):

```bash
cd web && npm install && npm run dev
# Proxies API to localhost:8080
```

### Database migrations (manual)

Migrations run automatically on app startup. To apply manually after Postgres is up:

```bash
export DATABASE_URL=postgres://epure:epure@localhost:5433/epure
cargo sqlx migrate run --source crates/storage/migrations
```

Host port **5433** maps to container **5432** — do not point local tools at 5432 unless Postgres runs natively on that port.

### Run server without Docker

```bash
export DATABASE_URL=postgres://epure:epure@localhost:5433/epure
cargo run -p epure-server -- --mode=all
```

Requires Postgres reachable on host port 5433 (start with `docker compose up postgres -d`).

---

## Contributing and CI

Integration tests need Postgres on host port **5433**:

```bash
./scripts/test.sh
```

Or manually:

```bash
export DATABASE_URL=postgres://epure:epure@localhost:5433/epure
cargo test
```

See `.env.test.example` for a copy-paste `DATABASE_URL`. Full contribution scope and PR flow: [CONTRIBUTING.md](../CONTRIBUTING.md).

### Slice proof checklist

For maintainers validating ROADMAP slices:

| Slice | Command / action | Pass criteria |
|---|---|---|
| S0 | `cargo build`; `docker compose config` | builds; compose valid |
| S1 | curl envelope → psql | 202 + Postgres row; spike drops bodies |
| S2 | upload `.map` + crash | demangled frames; PII redacted |
| S3 | two-org query | RLS isolation; partition drop |
| S3b | open `/`; web/design/qa.md | AppShell; token-bound UI |
| S4 | keyboard triage | no mouse; LLM export works |
| S5 | regression flow | webhook fires |
| S6 | admin integration tests; Settings UI | two projects + DSNs; env filter; revoke → 403; RBAC; ingest cap; invite flow |

S6 integration tests:

```bash
DATABASE_URL=postgres://epure:epure@localhost:5433/epure \
  cargo test -p epure-server --test admin_rbac --test admin_invitations --test ingest_cap
```

Envelope fixture tests:

```bash
cargo test -p epure-envelope
```

Fixtures live in `fixtures/sentry/{browser,node,python,go,ruby,php,java,dotnet}/`. API contract: [ingest.openapi.yaml](./ingest.openapi.yaml).

### Spike valve smoke test

Send >100 identical crashes/minute:

```bash
for i in $(seq 1 150); do
  curl -sS -o /dev/null -w "%{http_code}\n" \
    -X POST "http://localhost:8080/api/${PROJECT_ID}/envelope/" \
    -H "Content-Type: application/x-sentry-envelope" \
    -H "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=${PUBLIC}, sentry_secret=${SECRET}" \
    --data-binary "$ENVELOPE"
done
```

Expected: all responses **202**; `issues.event_count` ≥ 150; `events` row count << 150 (bodies dropped after bucket saturates). Details: [Architecture](./ARCHITECTURE.md#spike-valve).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Connection refused` on `:8080` | Run `docker compose ps`; wait for `epure` healthy. Check logs: `docker compose logs epure` |
| `Connection refused` on `:5433` | Start Postgres: `docker compose up postgres -d`. Confirm port mapping `5433:5432` |
| Health returns non-200 | Migrations may still be running; wait 10 s and retry. Check `docker compose logs epure` for migration errors |
| **202** ingest but no issue row | Wait ~500 ms for worker batch flush. Check worker logs. Query `issues` / `events` tables directly |
| Login returns 401 | Wrong password, or seed not applied. Run `./scripts/seed-dev.sh` or register a new account |
| Session cookie ignored (always redirected to login) | Set `EPURE_SESSION_SECURE=0` for HTTP localhost |
| CORS blocked in browser SDK | Add your frontend origin to `EPURE_CORS_ORIGINS` (comma-separated) |
| Migration fails locally | Ensure `DATABASE_URL=postgres://epure:epure@localhost:5433/epure` matches compose credentials |
| `cargo test` cannot connect to DB | Postgres must listen on host **5433**, not 5432. Run `docker compose up postgres -d` first |
| `./scripts/seed-dev.sh` errors | Start compose first: `docker compose up --build`. Script requires running `postgres` service |
| Ingest returns **403** `dsn_revoked` | Key was revoked in Settings → DSN keys. Create a new key or re-run dev seed |

More production issues (TLS, backups, upgrades): [Self-host](./SELF_HOST.md).

---

## Next steps

| Goal | Doc |
|---|---|
| Point your SDK at epure | [Migration](./MIGRATION.md) |
| Full SDK matrix and limits | [Compatibility](./COMPATIBILITY.md) |
| Production deploy | [Self-host](./SELF_HOST.md) |
| Ingest pipeline, RLS, spike valve | [Architecture](./ARCHITECTURE.md) |
| PII scrub and data handling | [DATA.md](../DATA.md) |
| Report a vulnerability | [SECURITY.md](../SECURITY.md) |

---

> **Managed hosting:** epure Cloud — Pro $24/mo · Plus $79/mo. Flat pricing, no per-event overage. [epure.sh](https://epure.sh)
