# Quickstart

First exception → grouped issue. README install already works? Jump to [Troubleshooting](#troubleshooting) or [CONTRIBUTING](../CONTRIBUTING.md).

**2026-09-12** (Docker Desktop, cached images): compose → issue in **~9 s**. Warm stack: **~2 s**. First no-cache build: **~160 s** once.

## Golden path

```bash
git clone https://github.com/epure-sh/epure.git && cd epure
docker compose up --build
curl -sS http://localhost:8080/health   # → {"status":"ok"}
```

| Service | Port |
|---|---|
| `epure` | `8080` |
| `postgres` | host `5433` → `5432` |

Open [http://localhost:8080](http://localhost:8080) → register → **Settings → DSN keys** → create a key.

<details>
<summary>Dev seed (skip register) — ⚠️ DEV ONLY</summary>

```bash
./scripts/seed-dev.sh
# login: dev@epure.local / devpassword
```

| Field | Value |
|---|---|
| Project ID | `550e8400-e29b-41d4-a716-446655440000` |
| Public key | `a1b2c3d4e5f6g7h8i9j0` |
| Secret | `supersecretdevkey` |

Also: `./scripts/seed-events-dev.sh` · heavy UX seed: `./scripts/seed-heavy.sh` · startup seed: `EPURE_DEV_SEED=1` (never in production).

</details>

### Ingest a test exception

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

Expect **HTTP 202**. Issue appears in about **0.5 s** (warm measured **0.18 s**). Local HTTP sessions: `EPURE_SESSION_SECURE=0`.

Point a real SDK: [MIGRATION.md](./MIGRATION.md). Production: [SELF_HOST.md](./SELF_HOST.md).

<details>
<summary>Optional: store path, negative tests, local cargo</summary>

**Legacy store**

```bash
curl -sS -w "\nHTTP %{http_code}\n" \
  -X POST "http://localhost:8080/api/${PROJECT_ID}/store/" \
  -H "Content-Type: application/json" \
  -H "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=${PUBLIC}, sentry_secret=${SECRET}" \
  -d '{"exception":{"values":[{"type":"Error","value":"store path test"}]},"platform":"python","environment":"local"}'
```

**Bad secret** → **401** / **403**. **CORS preflight** → add origin to `EPURE_CORS_ORIGINS`.

**SPA hot reload:** `cd web && npm install && npm run dev` (API → `:8080`).

**Cargo without Docker app:**

```bash
export DATABASE_URL=postgres://epure:epure@localhost:5433/epure
docker compose up postgres -d
cargo run -p epure-server -- --mode=all
```

Migrations run on startup. Manual: `cargo sqlx migrate run --source crates/storage/migrations`.

**CI / tests:** `./scripts/test.sh` (Postgres on host **5433**). See [CONTRIBUTING.md](../CONTRIBUTING.md).

</details>

## Troubleshooting

| You see | Try this |
|---|---|
| `Connection refused` on `:8080` | `docker compose ps` · `docker compose logs epure` |
| Health not `{"status":"ok"}` | Wait ~10 s for migrations · check logs |
| **202** but no issue | Wait ~500 ms · refresh · check worker logs |
| Login loop | `EPURE_SESSION_SECURE=0` on HTTP localhost |
| Browser CORS | Add origin to `EPURE_CORS_ORIGINS` |
| Ingest **403** | Key revoked · Settings → DSN keys or re-seed |
| `cargo test` / seed fails | Postgres must listen on host **5433** |

## Next

| Goal | Doc |
|---|---|
| SDK cutover | [MIGRATION.md](./MIGRATION.md) |
| Matrix / gaps | [COMPATIBILITY.md](./COMPATIBILITY.md) |
| Production | [SELF_HOST.md](./SELF_HOST.md) |
| Pipeline / RLS | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| PII / RBAC | [DATA.md](../DATA.md) |

> **Managed hosting:** Epure Cloud — Pro $24/mo · Plus $79/mo. [epure.sh](https://epure.sh)
