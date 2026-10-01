# Docs in this repository

Operator and product guides are published on the documentation site:

**[epure.sh/docs](https://epure.sh/docs)**

| Guide | URL |
|---|---|
| Docs hub | https://epure.sh/docs |
| Quickstart | https://epure.sh/docs/get-started/quickstart |
| Migrate from Sentry | https://epure.sh/docs/guides/migrate-from-sentry |
| FAQ index | https://epure.sh/docs/reference/faq |
| SDK matrix | https://epure.sh/docs/reference/sdk-matrix |
| Concepts | https://epure.sh/docs/get-started/concepts |
| Alerts | https://epure.sh/docs/product/alerts |
| Self-host install | https://epure.sh/docs/self-hosting/installation |
| Production checklist | https://epure.sh/docs/guides/production-checklist |
| Configuration | https://epure.sh/docs/self-hosting/configuration |
| Upgrades | https://epure.sh/docs/self-hosting/upgrades |
| Platforms | https://epure.sh/docs/platforms |
| API overview | https://epure.sh/docs/api |
| Agent API (human docs) | https://epure.sh/docs/api/agent |
| MCP and epure-cli | https://epure.sh/docs/guides/mcp-and-cli |
| Webhooks API | https://epure.sh/docs/api/webhooks |

## Files here

| Path | Purpose |
|---|---|
| [ingest.openapi.yaml](./ingest.openapi.yaml) | Machine-readable ingest contract (envelope + store) |
| [agent.openapi.yaml](./agent.openapi.yaml) | Agent API for MCP / `epure-cli` (PAT auth) |
| [../CHANGELOG.md](../CHANGELOG.md) | Tagged release history for the binary / image |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Build, test, PR workflow |
| [../.github/SUPPORT.md](../.github/SUPPORT.md) | Where to ask questions |
| [../.github/SECURITY.md](../.github/SECURITY.md) | Vulnerability reporting |
| [../docker-compose.yml](../docker-compose.yml) | Default 2-container stack (`ghcr.io/epure-sh/epure`) |
| [../deploy/](../deploy/README.md) | Production / source-build overlays and env templates |

## Images

```bash
docker pull ghcr.io/epure-sh/epure:v0.1.5
```

Production pin: `EPURE_IMAGE=ghcr.io/epure-sh/epure:v0.1.5`. Source build: `docker compose -f docker-compose.yml -f deploy/docker-compose.build.yml up --build`.

### Refresh `:latest` without a new release

Day-to-day package updates (UI fixes, small patches) do **not** need a git tag or GitHub Release. Push to `main`, then:

```bash
gh workflow run Image --ref main
```

That rebuilds amd64 + arm64 and retags `ghcr.io/epure-sh/epure:latest` (plus `sha-<short>`). Use a `v*` tag + `gh release create` only when you want a versioned, documented release.
