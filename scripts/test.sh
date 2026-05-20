#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
if [[ -f .env.dev ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.dev
  set +a
fi

PG_PORT="${POSTGRES_HOST_PORT:-5433}"
export DATABASE_URL="${DATABASE_URL:-postgres://epure:epure@localhost:${PG_PORT}/epure}"
export EPURE_SESSION_SECURE="${EPURE_SESSION_SECURE:-0}"

# Serial by default: parallel migrate races on shared Postgres (CI uses the same flag).
if [[ "$#" -eq 0 ]]; then
  set -- -- --test-threads=1
elif [[ "$*" != *"--test-threads"* && "$*" != *"--"* ]]; then
  set -- "$@" -- --test-threads=1
fi

exec cargo test "$@"
