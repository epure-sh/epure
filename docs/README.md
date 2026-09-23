# Docs in this repository

Operator and product guides live on the site so they stay versioned with the marketing/docs deploy:

**[epure.sh/docs](https://epure.sh/docs)**

| Guide | URL |
|---|---|
| Quickstart | https://epure.sh/docs/get-started/quickstart |
| Concepts | https://epure.sh/docs/get-started/concepts |
| Self-host install | https://epure.sh/docs/self-hosting/installation |
| Configuration | https://epure.sh/docs/self-hosting/configuration |
| Upgrades | https://epure.sh/docs/self-hosting/upgrades |
| Platforms | https://epure.sh/docs/platforms |
| Ingest API | https://epure.sh/docs/api |

## Files here

| Path | Purpose |
|---|---|
| [ingest.openapi.yaml](./ingest.openapi.yaml) | Machine-readable ingest contract (envelope + store) |
| [../CHANGELOG.md](../CHANGELOG.md) | Tagged release history for the binary / image |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Build, test, PR workflow |
| [../SUPPORT.md](../SUPPORT.md) | Where to ask questions |
| [../SECURITY.md](../SECURITY.md) | Vulnerability reporting |
| [../docker-compose.yml](../docker-compose.yml) | Default 2-container stack (`ghcr.io/epure-sh/epure`) |
| [../docker-compose.prod.yml](../docker-compose.prod.yml) | Production overlay |

## Images

```bash
# latest multi-arch release
docker pull ghcr.io/epure-sh/epure:latest

# pin a release
docker pull ghcr.io/epure-sh/epure:v1.1.0
```

Pin with `EPURE_IMAGE` in `.env` for production. Source build: `docker compose -f docker-compose.yml -f docker-compose.build.yml up --build`.
