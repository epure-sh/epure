#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DATABASE_URL="${DATABASE_URL:-postgres://epure:epure@localhost:5433/epure}"
export EPURE_SESSION_SECURE="${EPURE_SESSION_SECURE:-0}"

exec cargo test "$@"
