# Self-host in production

Run epure on your own infrastructure with HTTPS, durable backups, and a sane upgrade path. This guide assumes you completed the local [Quickstart](./QUICKSTART.md) — if `docker compose up` and a test envelope already work, start at the [production checklist](#production-checklist).

epure is two containers: a Rust binary and PostgreSQL 16. No Redis, no Kafka, no sidecar workers. Idle stack measured **~82 MiB** on 2026-09-12 (Docker Desktop, M-series Mac). See [Architecture](./ARCHITECTURE.md) for ingest flow, spike valve, and RLS.

---

## Production checklist

Complete every item before pointing production SDKs at your instance.

| # | Item | How |
|---|---|---|
| 1 | **HTTPS in front** | Reverse proxy or load balancer terminates TLS; epure listens on HTTP internally (`8080`) |
| 2 | **Production compose overlay** | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` |
| 3 | **`EPURE_SESSION_SECURE=1`** | Set by `docker-compose.prod.yml`; required so session cookies work over HTTPS |
| 4 | **`EPURE_PUBLIC_URL`** | Your public origin, e.g. `https://errors.example.com` — used for OAuth redirects and absolute links |
| 5 | **Postgres not exposed** | Prod overlay removes host port `5433`; database reachable only on the Docker network |
| 6 | **Real credentials** | Register accounts at `/login`; **never** run `./scripts/seed-dev.sh`, `EPURE_DEV_SEED=1`, or dev passwords in production |
| 7 | **Restrict CORS** | Set `EPURE_CORS_ORIGINS` to your app origins (comma-separated); avoid `*` in production |
| 8 | **Webhook hardening** | Do **not** set `EPURE_WEBHOOK_ALLOW_PRIVATE=1` unless you understand SSRF risk (dev/tests only) |
| 9 | **Google OAuth** (optional) | Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` to match `EPURE_PUBLIC_URL` |
| 10 | **Postgres backups** | Schedule `pg_dump` (or volume snapshots) for `postgres_data` |
| 11 | **Artifact backups** | Back up the `artifacts_data` volume if you upload sourcemaps |
| 12 | **Retention policy** | Per-project raw-event retention: **14**, **30** (default), or **90** days in Settings → Projects |
| 13 | **Alerts & webhooks** | Re-create notification endpoints in Settings → Webhooks (not migrated from Sentry) |
| 14 | **Verify** | Run the [post-deploy checks](#verify-production) below |

For PII scrubbing, RBAC roles, and data-handling posture, see [DATA.md](../DATA.md). Vulnerability reports: [SECURITY.md](../SECURITY.md) · `security@news.epure.sh`. Operator questions: `support@news.epure.sh`.

---

## Deploy

### 1. Configure environment

From the repo root:

```bash
cp .env.example .env
```

Edit `.env` for production values. Compose injects database URLs for the `epure` service automatically; you mainly need public URL, CORS, and optional OAuth keys.

Minimum production overrides (also set in `docker-compose.prod.yml` — duplicate in `.env` if you customize the overlay):

```bash
EPURE_SESSION_SECURE=1
EPURE_PUBLIC_URL=https://errors.example.com
EPURE_CORS_ORIGINS=https://app.example.com,https://www.example.com
```

Replace `errors.example.com` and app origins with your domains.

### 2. Start with the production overlay

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

What the overlay changes (`docker-compose.prod.yml`):

- Sets `EPURE_SESSION_SECURE=1` and `EPURE_PUBLIC_URL` to your HTTPS origin
- Keeps `epure` on `8080:8080` for the reverse proxy upstream
- Clears Postgres host port mapping (`ports: []`) so the database is not reachable from outside Docker

Migrations run automatically on epure startup. First build may take **~160 s** no-cache; subsequent pulls are faster.

### 3. Point TLS at epure

epure does not terminate TLS itself. Put a reverse proxy or cloud load balancer in front.

**Typical pattern:**

```text
Client ──HTTPS──► reverse proxy ──HTTP──► epure:8080
                      │
                      └── optional: rate limit, WAF, access logs
```

**Proxy requirements:**

- Forward `Host`, `X-Forwarded-For`, and `X-Forwarded-Proto` (epure uses these for correct URLs and client IP where applicable)
- WebSocket is not required for Phase 1
- Ingest paths: `/api/{project_id}/envelope/` and `/api/{project_id}/store/` — allow `POST` and `OPTIONS` (CORS preflight)
- Dashboard and API: `/`, `/api/v1/*`, static assets

**Common choices:** nginx, Caddy, Traefik, or a cloud LB. Proxy configs are out of scope — aim the upstream at `http://127.0.0.1:8080`. With `EPURE_SESSION_SECURE=1`, the cookie is `__Host-epure.sid` (`Secure` only — browsers reject it on plain HTTP).

---

## Environment variables

Copy `.env.example` to `.env` at the repo root. Variables below are the full operator surface for self-hosting.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes (compose) | set in `docker-compose.yml` | Superuser-style URL for migrations; compose sets `postgres://epure:epure@postgres:5432/epure` |
| `EPURE_INGEST_DATABASE_URL` | Yes (compose) | set in compose | Ingest role connection (DSN path) |
| `EPURE_APP_DATABASE_URL` | Yes (compose) | set in compose | App role connection (dashboard API, RLS) |
| `EPURE_BIND` | No | `0.0.0.0:8080` | HTTP listen address inside the container |
| `EPURE_MODE` | No | `all` | Phase 1: only `all` supported |
| `EPURE_DEV_SEED` | No | off | **`1` = dev only.** Applies `scripts/seed-dev.sql` on startup — never in production |
| `EPURE_CORS_ORIGINS` | No | `*` | Comma-separated allowed origins for ingest CORS |
| `EPURE_ARTIFACTS_DIR` | No | `/data/artifacts` | Source map storage (Docker volume `artifacts_data`) |
| `EPURE_SESSION_SECURE` | No | `0` in dev compose / `1` in prod overlay | Session cookie `Secure` flag; must be `1` behind HTTPS |
| `EPURE_PUBLIC_URL` | No | `http://localhost:8080` | Public base URL for OAuth redirects and links |
| `EPURE_WEBHOOK_ALLOW_PRIVATE` | No | off | `1` allows webhook targets on private/loopback IPs — **dev and tests only** |
| `GOOGLE_CLIENT_ID` | No | empty | Google OAuth client ID; empty disables Google sign-in |
| `GOOGLE_CLIENT_SECRET` | No | empty | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | No | `{EPURE_PUBLIC_URL}/api/v1/auth/google/callback` | Must match your OAuth app and public URL |
| `RUST_LOG` | No | `info` | Log filter (`debug`, `warn`, etc.) |
| `EPURE_VELOCITY_WINDOW_SECS` | No | internal default | Velocity alert window (seconds); rarely changed |

Host-side tools (`cargo test`, manual `sqlx migrate`) use `DATABASE_URL` with host port **5433** in dev compose. In production overlay, Postgres has no host port — use `docker compose exec postgres psql` instead.

---

## Data retention

Raw events live in monthly Postgres partitions (`events_YYYY_MM`). A daily TTL job drops partitions older than each project's retention window.

| Setting | Value |
|---|---|
| Allowed values | **14**, **30**, or **90** days |
| Default for new projects | **30** days |
| Where to change | Settings → Projects → retention |
| What survives TTL | Issue rows, event counts, fingerprints, and aggregates on `issues` |

Partition drops are irreversible. Align retention with your backup policy — backups are the only way to recover dropped raw event bodies. Details: [DATA.md](../DATA.md).

---

## Backups

epure persists state in two Docker volumes:

| Volume | Contents | Backup priority |
|---|---|---|
| `postgres_data` | Orgs, users, issues, events, sessions, webhooks | **Critical** — back up daily (or more) |
| `artifacts_data` | Uploaded JS/TS sourcemaps | Important if you rely on demangled stacks |

### Postgres logical backup

While the stack is running:

```bash
docker compose exec -T postgres pg_dump -U epure -d epure -Fc > "epure-$(date +%Y%m%d).dump"
```

Restore to a fresh volume (maintenance window — destructive to current data):

```bash
docker compose down
# recreate or empty postgres_data volume per your platform
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres
docker compose exec -T postgres pg_restore -U epure -d epure --clean --if-exists < epure-YYYYMMDD.dump
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Artifact volume

```bash
docker run --rm \
  -v epure_artifacts_data:/data \
  -v "$(pwd)/backups:/backup" \
  alpine tar czf /backup/artifacts-$(date +%Y%m%d).tar.gz -C /data .
```

Volume name may be prefixed with your compose project name (`docker volume ls` to confirm).

---

## Upgrades

epure ships as a Docker image built from this repo. To upgrade:

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

**Recommended practice:**

1. **Back up Postgres** before every upgrade (see above).
2. Pull during a low-traffic window; migrations run on epure startup.
3. Watch logs: `docker compose logs -f epure` until migrations finish and `/health` returns `200`.
4. Pin to a release tag when available (`git checkout v0.1.0-phase1`) instead of tracking `main` in production.

Rollback: check out the previous git tag, rebuild, and restore the pre-upgrade dump if schema migrations are not backward-compatible.

---

## Verify production

Run these after deploy and after every upgrade.

### Health

```bash
curl -sS https://errors.example.com/health
```

Expected: `200` with `{"status":"ok"}`. Replace the URL with your `EPURE_PUBLIC_URL`.

### Session (HTTPS)

Register a user at `https://errors.example.com/login`, then:

```bash
curl -sS -c /tmp/epure.cookies -b /tmp/epure.cookies \
  -X POST https://errors.example.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"your-password"}'

curl -sS -b /tmp/epure.cookies https://errors.example.com/api/v1/auth/me
curl -sS -o /dev/null -w "issues=%{http_code}\n" \
  -b /tmp/epure.cookies https://errors.example.com/api/v1/issues
```

Expected: login `204`, `/auth/me` `200`, `/issues` `200`. If login works but subsequent requests redirect to login, confirm TLS is in front and `EPURE_SESSION_SECURE=1`.

### Ingest

Create a DSN in Settings → DSN keys, then:

```bash
PROJECT_ID="your-project-uuid"
PUBLIC="your-public-key"
SECRET="your-secret-key"

ENVELOPE=$'{"event_id":"'$(uuidgen | tr '[:upper:]' '[:lower:]')'","sdk":{"name":"sentry.test"}}\n{"type":"event","length":120}\n{"exception":{"values":[{"type":"Error","value":"production smoke test"}]},"platform":"javascript","environment":"production"}\n'

curl -sS -w "\nHTTP %{http_code}\n" \
  -X POST "https://errors.example.com/api/${PROJECT_ID}/envelope/" \
  -H "Content-Type: application/x-sentry-envelope" \
  -H "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=${PUBLIC}, sentry_secret=${SECRET}" \
  --data-binary "$ENVELOPE"
```

Expected: **HTTP 202**. The grouped issue should appear in the dashboard within ~500 ms.

### Postgres not exposed

From the host (should fail in production overlay):

```bash
nc -zv localhost 5433 || echo "OK: Postgres not on host port"
```

### Resource check (optional)

```bash
docker stats --no-stream
```

Idle stack is typically **~82 MiB** total across both containers (measured 2026-09-12). Spikes under load are normal.

---

## Operations reference

**RBAC:** Owner (delete projects), Admin (DSN, settings, webhooks, invites), Member (triage only). Invite in Settings → Team — full matrix in [DATA.md](../DATA.md).

**Alerts & webhooks:** Settings → Webhooks per project (Slack, Discord, generic JSON). Webhook URLs must be public unless you set `EPURE_WEBHOOK_ALLOW_PRIVATE=1` (not recommended).

**Ingest cap:** Default **5000 events/hour** per project. Revoked DSN keys return **403**.

**Logs:** `docker compose logs -f epure`. Set `RUST_LOG=debug` temporarily for ingest triage.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Login loop after HTTPS deploy | Confirm `EPURE_SESSION_SECURE=1` and TLS terminates in front of epure |
| OAuth redirect mismatch | `GOOGLE_REDIRECT_URI` and Google console must match `{EPURE_PUBLIC_URL}/api/v1/auth/google/callback` |
| CORS errors from browser SDK | Add frontend origin to `EPURE_CORS_ORIGINS` |
| Webhook delivery fails | URL must be public HTTPS; do not use internal hostnames without understanding SSRF |
| **202** but no issue | Wait ~500 ms; check `docker compose logs epure` for worker errors |
| Upgrade migration error | Read epure logs; restore from pre-upgrade backup if needed |
| Disk growth | Check retention settings; old partitions drop daily; issue rows remain |

More ingest and SDK issues: [Compatibility](./COMPATIBILITY.md) and [Quickstart troubleshooting](./QUICKSTART.md#troubleshooting).

---

> **Managed hosting:** epure Cloud — Pro $24/mo · Plus $79/mo. Flat pricing, no per-event overage. [epure.sh](https://epure.sh)
