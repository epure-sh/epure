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
| [../.github/SUPPORT.md](../.github/SUPPORT.md) | Where to ask questions |
| [../.github/SECURITY.md](../.github/SECURITY.md) | Vulnerability reporting |
| [../docker-compose.yml](../docker-compose.yml) | Default 2-container stack (`ghcr.io/epure-sh/epure`) |
| [../deploy/](../deploy/README.md) | Production / source-build overlays and env templates |

## Images

```bash
# latest multi-arch build
docker pull ghcr.io/epure-sh/epure:latest

# pin a numbered release (only when you intentionally cut one)
docker pull ghcr.io/epure-sh/epure:v1.1.0
```

Pin with `EPURE_IMAGE` in `.env` for production. Source build: `docker compose -f docker-compose.yml -f deploy/docker-compose.build.yml up --build`.

### Refresh `:latest` without a new release

Day-to-day package updates (UI fixes, small patches) do **not** need a git tag or GitHub Release. Push to `main`, then:

```bash
gh workflow run Image --ref main
```

That rebuilds amd64 + arm64 and retags `ghcr.io/epure-sh/epure:latest` (plus `sha-<short>`). Use a `v*` tag + `gh release create` only when you want a versioned, documented release.
