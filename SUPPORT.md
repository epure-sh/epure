# Support

Epure is Apache 2.0 open source. Use the channels below so questions and bugs stay searchable for everyone.

## Where to ask

| Topic | Channel |
|---|---|
| Setup, Compose, DSN, “how do I…?” | [GitHub Discussions](https://github.com/epure-sh/epure/discussions) |
| Bugs, crashes, SDK ingest gaps | [GitHub Issues](https://github.com/epure-sh/epure/issues) — use a [bug](https://github.com/epure-sh/epure/issues/new?template=01-bug.yml) or [compat](https://github.com/epure-sh/epure/issues/new?template=02-compat.yml) template |
| Security vulnerabilities | [SECURITY.md](SECURITY.md) — private advisory or `security@news.epure.sh` |
| Conduct / harassment | `conduct@news.epure.sh` — see [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) |
| Non-security operator mail | `support@news.epure.sh` |

There is no Discord or waitlist for the OSS project.

## Before you open an issue

1. Confirm `curl -sS http://localhost:8080/health` returns `{"status":"ok"}`.
2. Note Epure version (`docker compose images` / image tag) and host OS/arch.
3. For SDK problems: language, package name, version, and a sanitized envelope or store payload.
4. Search existing issues and discussions first.

## Docs

- Product docs: [epure.sh/docs](https://epure.sh/docs)
- Quickstart: [epure.sh/docs/get-started/quickstart](https://epure.sh/docs/get-started/quickstart)
- Self-host: [epure.sh/docs/self-hosting/installation](https://epure.sh/docs/self-hosting/installation)
- Ingest OpenAPI in this repo: [docs/ingest.openapi.yaml](docs/ingest.openapi.yaml)
- Local develop / test: [CONTRIBUTING.md](CONTRIBUTING.md)

## Managed hosting

If you do not want to operate the Compose stack yourself: [epure.sh](https://epure.sh) (Cloud). Support for Cloud billing and accounts is separate from this repository.
