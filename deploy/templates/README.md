# One-click and PaaS deploy templates

Epure’s default install remains root [`docker-compose.yml`](../../docker-compose.yml) on a VPS. These files target **platform marketplaces** and homelab panels that import Compose or Blueprints from Git.

| Platform | File(s) | How to use |
| --- | --- | --- |
| **Render** | [`../../render.yaml`](../../render.yaml) | README **Deploy to Render** button, or Blueprint → sync repo |
| **Railway** | [`../railway/docker-compose.yml`](../railway/docker-compose.yml) | Drag compose onto project canvas → [`../railway/README.md`](../railway/README.md) |
| **Coolify** | [`coolify/docker-compose.yml`](coolify/docker-compose.yml) | New resource → Docker Compose build pack → base dir `deploy/templates/coolify` |
| **Dokploy** | [`dokploy/docker-compose.yml`](dokploy/docker-compose.yml) + [`dokploy/template.toml`](dokploy/template.toml) | Compose path `deploy/templates/dokploy/…` or PR to [Dokploy/templates](https://github.com/Dokploy/templates) |

## Production requirements (all templates)

- **HTTPS** in front of the app (`EPURE_PUBLIC_URL`, `EPURE_CORS_ORIGINS`, `EPURE_SESSION_SECURE=1`).
- **Three database roles** with distinct passwords: `epure`, `epure_ingest`, `epure_app` (see [`../docker-compose.prod.yml`](../docker-compose.prod.yml)).
- **Pin** `ghcr.io/epure-sh/epure:v0.1.7` for anything beyond a trial.

## Coolify

1. **+ New** → public Git `https://github.com/epure-sh/epure`.
2. Build pack **Docker Compose**.
3. Base directory: `deploy/templates/coolify`.
4. Compose file: `docker-compose.yml`.
5. On service **epure**, set **Domains** to `https://your-host:8080` (internal port **8080**).
6. Deploy; open the URL → sign up → project → DSN.

Coolify fills `SERVICE_PASSWORD_*` and `SERVICE_URL_EPURE_8080` from the compose file.

## Dokploy

**Git:** Add Compose service → compose path `deploy/templates/dokploy/docker-compose.yml` → set env vars (or import blueprint metadata from `template.toml`).

Generate passwords (example):

```bash
openssl rand -hex 24   # POSTGRES_PASSWORD, EPURE_INGEST_PASSWORD, EPURE_APP_PASSWORD
```

Set `EPURE_PUBLIC_URL` and `EPURE_CORS_ORIGINS` to your public origin (e.g. `https://errors.example.com`). After the first account exists, set `EPURE_REGISTRATION=false` so the public URL cannot open another workspace. Sign-in and invitation links still work.

**Marketplace:** Copy `dokploy/` into `blueprints/epure/` on Dokploy/templates and open a PR (logo + `meta.json` entry still required upstream).

## Render & Railway

- Render: [`../../render.yaml`](../../render.yaml) — private Postgres `pserv` + public Epure image; URLs are assembled at container start.
- Railway: shared secrets + private networking — see [`../railway/README.md`](../railway/README.md).

## VPS production (not a template)

Use [`../docker-compose.prod.yml`](../docker-compose.prod.yml) with [`../env.production.example`](../env.production.example) or `./configure --prod`. Add `--profile tls` to start Caddy, or omit it when the host already terminates HTTPS.
