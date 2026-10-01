# Deploy Epure on Railway

Railway does not run `docker-compose.yml` from Git on every push. This folder is a **template source**: import once (drag-and-drop), then wire GitHub per service or publish a [Railway template](https://docs.railway.com/reference/templates).

## Quick import

1. Create a Railway project.
2. Drag [`docker-compose.yml`](./docker-compose.yml) onto the project canvas.
3. Add **Shared variables** (Project → Shared Variables):

   | Variable | Suggested default in composer |
   | --- | --- |
   | `POSTGRES_PASSWORD` | `${{secret(32, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")}}` |
   | `EPURE_INGEST_PASSWORD` | `${{secret(32, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")}}` |
   | `EPURE_APP_PASSWORD` | `${{secret(32, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")}}` |
   | `EPURE_REGISTRATION` | `true` (set `false` after the first account) |

4. Enable **public networking** on `epure` only. Leave `postgres` private.
5. Attach volumes: `postgres` → `/var/lib/postgresql/data`, `epure` → `/data/artifacts`.
6. Deploy, open the `epure` public URL, register, create a project, copy the DSN.
7. Optional: set shared `EPURE_REGISTRATION` to `false` and redeploy so the public URL cannot open another workspace. Sign-in and invitation links still work.

Pin the image in production: `ghcr.io/epure-sh/epure:v0.1.7`.

## Publish a one-click template

See [`TEMPLATE.md`](./TEMPLATE.md) for maintainers (generate template from a working project, shared-variable contract).

## After import

- **Health:** `GET /health` → `{"status":"ok"}`
- **Docs:** [Self-hosting](https://epure.sh/docs/self-hosting/installation)
