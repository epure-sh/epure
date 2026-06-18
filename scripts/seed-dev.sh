#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

if ! docker compose ps postgres --status running >/dev/null 2>&1; then
  echo "error: start compose first — docker compose up --build" >&2
  exit 1
fi

docker compose exec -T postgres psql -U epure -d epure < scripts/seed-dev.sql
echo "dev seed applied — login dev@epure.local / devpassword"

if curl -sf "${EPURE_URL:-http://localhost:8080}/health" >/dev/null 2>&1; then
  ./scripts/seed-events-dev.sh
else
  echo "tip: start Epure (docker compose up) then run ./scripts/seed-events-dev.sh for realistic issues"
fi

echo "for heavy dashboard UX data (50+ issues, 3 projects): ./scripts/seed-heavy.sh"
