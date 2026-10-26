#!/usr/bin/env bash
# CI-parity integration tests (Postgres 16 + role URLs). Requires Docker.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

export DATABASE_URL="${DATABASE_URL:-postgres://epure:epure@127.0.0.1:5433/epure}"
export EPURE_INGEST_DATABASE_URL="${EPURE_INGEST_DATABASE_URL:-postgres://epure_ingest:epure_ingest@127.0.0.1:5433/epure}"
export EPURE_APP_DATABASE_URL="${EPURE_APP_DATABASE_URL:-postgres://epure_app:epure_app@127.0.0.1:5433/epure}"
export EPURE_SESSION_SECURE=0

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running — start Docker, then: docker compose up -d postgres"
  exit 1
fi

docker compose up -d postgres
echo "Waiting for Postgres..."
for _ in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U epure -d epure >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

cargo test -- --test-threads=1
