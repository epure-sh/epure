#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

EPURE_URL="${EPURE_URL:-http://localhost:8080}"

if ! docker compose ps postgres --status running >/dev/null 2>&1; then
  echo "error: start compose first — docker compose up --build" >&2
  exit 1
fi

echo "==> Applying heavy dev seed (org, projects, DSN, users, releases)..."
docker compose exec -T postgres psql -U epure -d epure < scripts/seed-heavy.sql

if ! curl -sf "${EPURE_URL}/health" >/dev/null 2>&1; then
  echo "error: epure is not reachable at ${EPURE_URL} — start it first (docker compose up)" >&2
  exit 1
fi

echo "==> Resetting prior seeded issues/events..."
docker compose exec -T postgres psql -U epure -d epure < scripts/seed-events-reset.sql

echo "==> Ingesting heavy event catalog..."
python3 scripts/seed-heavy-ingest.py

echo "==> Post-processing timestamps, statuses, merges, alerts..."
docker compose exec -T postgres psql -U epure -d epure < scripts/seed-heavy-post.sql

echo ""
echo "Heavy seed complete."
echo "Login: dev@epure.local / devpassword"
echo "Open: ${EPURE_URL}/"

docker compose exec -T postgres psql -U epure -d epure -tAc "
SELECT
  'projects' AS kind, COUNT(*)::text AS count
FROM projects
WHERE org_id = '11111111-1111-1111-1111-111111111111'
  AND id IN (
    '550e8400-e29b-41d4-a716-446655440000',
    '660e8400-e29b-41d4-a716-446655440001',
    '770e8400-e29b-41d4-a716-446655440002'
  )
UNION ALL
SELECT 'issues', COUNT(*)::text
FROM issues
WHERE project_id IN (
    '550e8400-e29b-41d4-a716-446655440000',
    '660e8400-e29b-41d4-a716-446655440001',
    '770e8400-e29b-41d4-a716-446655440002'
  )
  AND merge_parent_id IS NULL
UNION ALL
SELECT 'merged_issues', COUNT(*)::text
FROM issues
WHERE project_id IN (
    '550e8400-e29b-41d4-a716-446655440000',
    '660e8400-e29b-41d4-a716-446655440001',
    '770e8400-e29b-41d4-a716-446655440002'
  )
  AND merge_parent_id IS NOT NULL
UNION ALL
SELECT 'events', COUNT(*)::text
FROM events
WHERE project_id IN (
    '550e8400-e29b-41d4-a716-446655440000',
    '660e8400-e29b-41d4-a716-446655440001',
    '770e8400-e29b-41d4-a716-446655440002'
  )
UNION ALL
SELECT 'alerts', COUNT(*)::text
FROM alerts
WHERE project_id IN (
    '550e8400-e29b-41d4-a716-446655440000',
    '660e8400-e29b-41d4-a716-446655440001',
    '770e8400-e29b-41d4-a716-446655440002'
  );
"
