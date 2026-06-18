# Support

Where to get help with epure (self-host and OSS).

| Need | Where |
|---|---|
| Install / first issue | [docs/QUICKSTART.md](docs/QUICKSTART.md) · [epure.sh/docs](https://epure.sh/docs/get-started/quickstart) |
| Production deploy | [docs/SELF_HOST.md](docs/SELF_HOST.md) · [Self-host](https://epure.sh/selfhost) |
| SDK / wire format | [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md) · [Platforms](https://epure.sh/docs/platforms) |
| Migrate from Sentry | [docs/MIGRATION.md](docs/MIGRATION.md) |
| Bug or regression | [GitHub Issues](https://github.com/epure-sh/epure/issues) (use a template) |
| Setup question | [GitHub Discussions](https://github.com/epure-sh/epure/discussions) |
| Security vulnerability | [SECURITY.md](SECURITY.md) · `security@news.epure.sh` |
| Cloud / pricing | [epure.sh/pricing](https://epure.sh/pricing) · `support@news.epure.sh` |

Mailboxes use `{role}@news.epure.sh` (e.g. `support@`, `security@`, `conduct@`).

## Before you open an issue

1. Confirm `/health` returns `{"status":"ok"}`.
2. Note epure version or commit SHA, Docker version, and OS.
3. Redact DSN secrets and end-user PII from logs and payloads.
4. Search existing issues and Discussions first.

Maintainers triage bugs and compatibility reports ahead of feature ideas. Phase 1 scope: [ROADMAP.md](ROADMAP.md). Out of scope (tracing, replay, profiling, mobile symbolication): do not file as bugs.

## Commercial support

Managed hosting is [epure Cloud](https://epure.sh) (Pro $24 / Plus $79). Contact **`support@news.epure.sh`**. OSS GitHub Issues are not a paid support channel.
