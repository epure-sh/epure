#!/usr/bin/env sh
# Seed heavy dashboard data (Acme Web / API / Mobile). Never writes passwords into SQL.
#
# Usage:
#   ./scripts/seed.sh
#   ./scripts/seed.sh --email you@example.com --password 'secret'
#   ./scripts/seed.sh --link-user you@example.com
#
# Register first for normal preview data (Acme Web/API). This command is for
# high-volume UX fixtures with fixed DSN UUIDs.
set -eu

cd "$(dirname "$0")/.."

EPURE_URL="${EPURE_URL:-http://localhost:8080}"
SEED_EMAIL=""
SEED_PASSWORD=""
LINK_USER=""

usage() {
  cat <<'EOF'
Usage: ./scripts/seed.sh [options]

  (no account flags)         Seed org/projects/events only
  --email EMAIL --password P Create account (register if needed) and own the seed org
  --link-user EMAIL          Attach an existing user as owner of the seed org
  -h, --help                 Show this help

Environment: EPURE_URL (default http://localhost:8080)
EOF
}

json_str() {
  python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1"
}

sql_quote() {
  python3 -c 'import sys; print(sys.argv[1].replace(chr(39), chr(39)+chr(39)))' "$1"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --email)
      SEED_EMAIL="${2:-}"
      shift 2
      ;;
    --password)
      SEED_PASSWORD="${2:-}"
      shift 2
      ;;
    --link-user)
      LINK_USER="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ -n "$LINK_USER" ] && { [ -n "$SEED_EMAIL" ] || [ -n "$SEED_PASSWORD" ]; }; then
  echo "error: use either --link-user or --email/--password, not both" >&2
  exit 1
fi

if [ -n "$SEED_EMAIL" ] && [ -z "$SEED_PASSWORD" ]; then
  echo "error: --email requires --password" >&2
  exit 1
fi

if [ -n "$SEED_PASSWORD" ] && [ -z "$SEED_EMAIL" ]; then
  echo "error: --password requires --email" >&2
  exit 1
fi

if ! docker compose ps postgres --status running >/dev/null 2>&1; then
  echo "error: start compose first — docker compose up --build" >&2
  exit 1
fi

psql_seed() {
  docker compose exec -T postgres psql -U epure -d epure "$@"
}

echo "==> Applying heavy seed scaffold (org, projects, DSN, releases)..."
psql_seed < scripts/seed-heavy.sql

if ! curl -sf "${EPURE_URL}/health" >/dev/null 2>&1; then
  echo "error: Epure is not reachable at ${EPURE_URL} — start it first (docker compose up)" >&2
  exit 1
fi

echo "==> Resetting prior seeded issues/events..."
psql_seed < scripts/seed-events-reset.sql

echo "==> Ingesting heavy event catalog..."
python3 scripts/seed-heavy-ingest.py

echo "==> Post-processing timestamps, statuses, merges, alerts..."
psql_seed < scripts/seed-heavy-post.sql

link_seed_org() {
  ACCOUNT_EMAIL="$1"
  EMAIL_SQL=$(sql_quote "$ACCOUNT_EMAIL")

  echo "==> Linking ${ACCOUNT_EMAIL} to seed org..."
  psql_seed -v ON_ERROR_STOP=1 <<SQL
DO \$\$
DECLARE
  v_user_id uuid;
  v_seed_org uuid := '11111111-1111-1111-1111-111111111111';
BEGIN
  SELECT id INTO v_user_id
  FROM users
  WHERE lower(email::text) = lower('${EMAIL_SQL}');

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user not found for email %', '${EMAIL_SQL}';
  END IF;

  INSERT INTO org_members (org_id, user_id, role)
  VALUES (v_seed_org, v_user_id, 'owner')
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'owner';

  -- Prefer seed org on login (auth_lookup_membership orders by created_at ASC).
  UPDATE org_members
  SET created_at = '1970-01-01'::timestamptz
  WHERE org_id = v_seed_org AND user_id = v_user_id;

  INSERT INTO user_setup_progress (
    user_id, org_id, project_id, project_named,
    dsn_copied_at, first_issue_seen_at, completed_at, updated_at
  )
  SELECT
    v_user_id,
    v_seed_org,
    p.id,
    true,
    now(),
    now(),
    now(),
    now()
  FROM projects p
  WHERE p.org_id = v_seed_org
    AND p.id IN (
      '550e8400-e29b-41d4-a716-446655440000'::uuid,
      '660e8400-e29b-41d4-a716-446655440001'::uuid,
      '770e8400-e29b-41d4-a716-446655440002'::uuid
    )
  ON CONFLICT (user_id, org_id, project_id) DO UPDATE SET
    project_named = true,
    completed_at = COALESCE(user_setup_progress.completed_at, EXCLUDED.completed_at),
    first_issue_seen_at = COALESCE(
      user_setup_progress.first_issue_seen_at,
      EXCLUDED.first_issue_seen_at
    ),
    updated_at = EXCLUDED.updated_at;
END;
\$\$;
SQL
}

ensure_account() {
  ACCOUNT_EMAIL="$1"
  ACCOUNT_PASSWORD="$2"
  email_json=$(json_str "$ACCOUNT_EMAIL")
  password_json=$(json_str "$ACCOUNT_PASSWORD")

  login_status=$(curl -sS -o /dev/null -w "%{http_code}" \
    -X POST "${EPURE_URL}/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":${email_json},\"password\":${password_json}}")

  if [ "$login_status" != "204" ]; then
    echo "==> Creating account ${ACCOUNT_EMAIL}..."
    register_status=$(curl -sS -o /tmp/epure-seed-register.json -w "%{http_code}" \
      -X POST "${EPURE_URL}/api/v1/auth/register" \
      -H 'Content-Type: application/json' \
      -d "{\"email\":${email_json},\"password\":${password_json}}")
    if [ "$register_status" != "201" ] && [ "$register_status" != "204" ] && [ "$register_status" != "200" ]; then
      echo "error: register failed HTTP ${register_status}: $(cat /tmp/epure-seed-register.json 2>/dev/null || true)" >&2
      exit 1
    fi
  fi

  link_seed_org "$ACCOUNT_EMAIL"
}

if [ -n "$LINK_USER" ]; then
  link_seed_org "$LINK_USER"
elif [ -n "$SEED_EMAIL" ]; then
  ensure_account "$SEED_EMAIL" "$SEED_PASSWORD"
fi

echo ""
echo "Heavy seed complete."
if [ -n "$SEED_EMAIL" ]; then
  echo "Login: ${SEED_EMAIL} (password you passed to --password)"
elif [ -n "$LINK_USER" ]; then
  echo "Linked existing user: ${LINK_USER}"
else
  echo "No account linked. Register at ${EPURE_URL}/login, or re-run with --email/--password or --link-user."
fi
echo "Open: ${EPURE_URL}/"

psql_seed -tAc "
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
