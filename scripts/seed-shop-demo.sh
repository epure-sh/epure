#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

if ! docker compose ps postgres --status running >/dev/null 2>&1; then
  echo "error: start compose first — docker compose up --build" >&2
  exit 1
fi

docker compose exec -T postgres psql -U epure -d epure < scripts/seed-shop-demo.sql

echo "shop demo seed applied"
echo "  project: Shop Demo (shop-demo)"
echo "  project id: a50e8400-e29b-41d4-a716-446655440000"
echo "  DSN: http://d4e5f6g7h8i9j0k1l2m3n4@localhost:8080/a50e8400-e29b-41d4-a716-446655440000"
echo "tip: register for Acme preview data, or ./scripts/seed.sh --link-user you@example.com for heavy UX fixtures"
