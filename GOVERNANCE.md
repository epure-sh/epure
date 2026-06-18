# Governance

epure Phase 1 OSS is maintained by the epure project for the public repository [epure-sh/epure](https://github.com/epure-sh/epure).

## Decision sources

| Source | Role |
|---|---|
| [ROADMAP.md](ROADMAP.md) | Slice order and acceptance proofs (S0→S6) |
| Product FEATURES matrix (upstream business docs) | What Phase 1 must ship |
| [COMPATIBILITY.md](docs/COMPATIBILITY.md) | Honest SDK / protocol boundaries |
| Maintainers on `main` | Merge authority for this repository |

Phase 1 stack is fixed: **Rust binary + PostgreSQL 16 + RLS**, two Compose containers. Proposals that add Redis, Kafka, SQLite-as-primary, Node in the product container, tracing, replay, profiling, generic logs, or native mobile symbolication are out of scope unless maintainers explicitly expand the roadmap.

## Contributions

Anyone may open issues and pull requests under [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Maintainers review for roadmap fit, test coverage, and security. Large or speculative work should start as an issue.

There is no separate technical steering committee for Phase 1. Cloud (Phase 2) billing, SSO, audit, and crons are tracked outside this OSS tree; do not assume an `ee/` split here.

## Releases

Tagged releases (starting `v0.1.0-phase1`) mark stable install points. Security fixes prefer patch tags; see [SECURITY.md](SECURITY.md).

## Contact

Mailboxes use `{role}@news.epure.sh`:

| Role | Address |
|---|---|
| Support / commercial | `support@news.epure.sh` |
| Security vulnerabilities | `security@news.epure.sh` |
| Code of Conduct | `conduct@news.epure.sh` |

## Changes to this document

Maintainers may update governance as the project grows. Material changes land on `main` via PR.
