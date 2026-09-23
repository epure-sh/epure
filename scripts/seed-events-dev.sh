#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

EPURE_URL="${EPURE_URL:-http://localhost:8080}"
PROJECT_ID="${EPURE_PROJECT_ID:-550e8400-e29b-41d4-a716-446655440000}"
PUBLIC_KEY="${EPURE_PUBLIC_KEY:-a1b2c3d4e5f6g7h8i9j0}"
SECRET_KEY="${EPURE_SECRET_KEY:-supersecretdevkey}"
EVENTS_DIR="fixtures/seed/events"
AUTH_HEADER="Sentry sentry_version=7, sentry_key=${PUBLIC_KEY}, sentry_secret=${SECRET_KEY}"

if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq is required for seed-events-dev.sh" >&2
  exit 1
fi

if ! curl -sf "${EPURE_URL}/health" >/dev/null 2>&1; then
  echo "error: Epure is not reachable at ${EPURE_URL} — start it first (docker compose up)" >&2
  exit 1
fi

if docker compose ps postgres --status running >/dev/null 2>&1; then
  docker compose exec -T postgres psql -U epure -d epure < scripts/seed-events-reset.sql
else
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "error: postgres is not running and DATABASE_URL is unset" >&2
    exit 1
  fi
  psql "${DATABASE_URL}" -f scripts/seed-events-reset.sql
fi

post_event() {
  local payload="$1"
  local status
  status=$(curl -sS -o /dev/null -w "%{http_code}" \
    -X POST "${EPURE_URL}/api/${PROJECT_ID}/store/" \
    -H "Content-Type: application/json" \
    -H "X-Sentry-Auth: ${AUTH_HEADER}" \
    -d "${payload}")
  if [ "${status}" != "202" ] && [ "${status}" != "200" ]; then
    echo "error: ingest failed with HTTP ${status}" >&2
    exit 1
  fi
}

post_fixture() {
  local file="$1"
  local count="${2:-1}"
  local i=1
  while [ "$i" -le "$count" ]; do
    payload=$(jq --arg uid "seed-user-${i}" --arg email "user${i}@acme-corp.com" \
      '.user.id = $uid | .user.email = $email' "${file}")
    post_event "${payload}"
    i=$((i + 1))
  done
}

echo "seeding realistic issues via ingest (${EPURE_URL})..."

post_fixture "${EVENTS_DIR}/browser-checkout-typeerror.json" 5
post_fixture "${EVENTS_DIR}/browser-payment-api-failed.json" 3
post_fixture "${EVENTS_DIR}/react-hydration-mismatch.json" 2
post_fixture "${EVENTS_DIR}/auth-token-expired.json" 2
post_fixture "${EVENTS_DIR}/node-unhandled-rejection.json" 1
post_fixture "${EVENTS_DIR}/python-database-timeout.json" 1
post_fixture "${EVENTS_DIR}/staging-feature-flag.json" 1
post_fixture "${EVENTS_DIR}/go-nil-pointer.json" 1

# Allow the ingest worker to flush batched events.
sleep 1

issue_count=$(docker compose exec -T postgres psql -U epure -d epure -tAc \
  "SELECT COUNT(*) FROM issues WHERE project_id = '${PROJECT_ID}';" 2>/dev/null \
  || psql "${DATABASE_URL:-}" -tAc "SELECT COUNT(*) FROM issues WHERE project_id = '${PROJECT_ID}';")

event_count=$(docker compose exec -T postgres psql -U epure -d epure -tAc \
  "SELECT COUNT(*) FROM events WHERE project_id = '${PROJECT_ID}';" 2>/dev/null \
  || psql "${DATABASE_URL:-}" -tAc "SELECT COUNT(*) FROM events WHERE project_id = '${PROJECT_ID}';")

echo "seed events applied — ${issue_count} issues, ${event_count} events"
echo "open ${EPURE_URL}/ — register, or ./scripts/seed.sh --email … --password …"
