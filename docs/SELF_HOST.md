# Self-host in production

HTTPS, backups, upgrades. Local smoke first: [QUICKSTART.md](./QUICKSTART.md). Topology: [ARCHITECTURE.md](./ARCHITECTURE.md). Idle stack **~82 MiB** (measured 2026-09-12).

## Production checklist

| # | Item |
|---|---|
| 1 | TLS terminates at reverse proxy → `epure:8080` |
| 2 | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` |
| 3 | `EPURE_SESSION_SECURE=1` (set by prod overlay) |
| 4 | `EPURE_PUBLIC_URL=https://errors.example.com` |
| 5 | Postgres **not** on host port (overlay clears `5433`) |
| 6 | Real users only — never `seed-dev` / `EPURE_DEV_SEED=1` |
| 7 | `EPURE_CORS_ORIGINS` = your app origins (no `*` in prod) |
| 8 | Leave `EPURE_WEBHOOK_ALLOW_PRIVATE` off (SSRF) |
| 9 | Optional Google OAuth: `GOOGLE_*` matches public URL |
| 10 | Back up `postgres_data` (+ `artifacts_data` if you upload maps) |
| 11 | Retention 14 / 30 / 90 days per project |
| 12 | Rebuild webhooks/alerts in Settings |

PII / RBAC: [DATA.md](../DATA.md). Security: [SECURITY.md](../SECURITY.md).

## Deploy

```bash
cp .env.example .env
# set EPURE_PUBLIC_URL, EPURE_CORS_ORIGINS, secrets
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Overlay: secure cookies, public URL, Postgres internal-only. Migrations run on startup.

**TLS:** proxy forwards `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`. Allow `POST`/`OPTIONS` on `/api/{project_id}/envelope/` and `/store/`. Cookie with secure flag is `__Host-epure.sid`.

## Environment

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` / ingest / app URLs | set by compose | Three roles; do not invent casually |
| `EPURE_BIND` | `0.0.0.0:8080` | Inside container |
| `EPURE_SESSION_SECURE` | `0` dev / `1` prod | Must be `1` behind HTTPS |
| `EPURE_PUBLIC_URL` | `http://localhost:8080` | OAuth + absolute links |
| `EPURE_CORS_ORIGINS` | `*` | Comma-separated in prod |
| `EPURE_ARTIFACTS_DIR` | `/data/artifacts` | Sourcemaps volume |
| `EPURE_DEV_SEED` | off | **Never** in production |
| `EPURE_WEBHOOK_ALLOW_PRIVATE` | off | Dev/tests only |
| `GOOGLE_CLIENT_ID` / `SECRET` / `REDIRECT_URI` | empty | Optional OAuth |
| `RUST_LOG` | `info` | |

## Retention

Raw events in monthly partitions. TTL drops partitions older than **14 / 30 / 90** days (default **30**). Issue aggregates survive. Change in Settings → Projects.

## Backups

| Volume | Priority |
|---|---|
| `postgres_data` | Critical — daily `pg_dump` or snapshots |
| `artifacts_data` | If you rely on demangled stacks |

```bash
docker compose exec -T postgres pg_dump -U epure -d epure -Fc > "epure-$(date +%Y%m%d).dump"
```

Restore needs a maintenance window (`pg_restore --clean`). Confirm volume names with `docker volume ls`.

## Upgrades

```bash
git pull   # prefer a release tag in production
# backup Postgres first
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose logs -f epure   # until /health is ok
```

## Verify

```bash
curl -sS https://errors.example.com/health   # → {"status":"ok"}
# Login at /login, create DSN, POST envelope → 202
nc -zv localhost 5433 || echo "OK: Postgres not on host"
```

## Ops notes

- **RBAC:** Owner / Admin / Member — matrix in [DATA.md](../DATA.md)
- **Ingest cap:** 5000 events/hour per project · revoked key → **403**
- **Webhooks:** public HTTPS URLs · Settings → Webhooks

## Troubleshooting

| Symptom | Fix |
|---|---|
| Login loop on HTTPS | `EPURE_SESSION_SECURE=1` + TLS in front |
| OAuth mismatch | Redirect URI = `{EPURE_PUBLIC_URL}/api/v1/auth/google/callback` |
| CORS | Add origin to `EPURE_CORS_ORIGINS` |
| Webhook fail | Public URL; private targets blocked by default |
| **202** no issue | Wait ~500 ms · `docker compose logs epure` |
| Disk growth | Check retention · partitions drop daily |

> **Managed hosting:** Epure Cloud — Pro $24/mo · Plus $79/mo. [epure.sh](https://epure.sh)
