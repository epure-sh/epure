#!/usr/bin/env bash
# Apply POSTGRES_PASSWORD / EPURE_*_DATABASE_URL secrets from .env to Postgres roles.
# Uses local trust inside the postgres container (TCP auth from epure uses these passwords).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "error: no .env — run ./configure --prod or copy deploy/env.production.example" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

for key in POSTGRES_PASSWORD EPURE_INGEST_PASSWORD EPURE_APP_PASSWORD; do
  if [[ -z "${!key:-}" || "${!key}" == "CHANGE_ME" ]]; then
    echo "error: ${key} is not set in .env" >&2
    exit 1
  fi
done

if ! docker compose ps --status running --services 2>/dev/null | grep -qx postgres; then
  echo "error: postgres service is not running — start the stack first:" >&2
  echo "  docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d postgres" >&2
  exit 1
fi

sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

pg_pw="$(sql_escape "$POSTGRES_PASSWORD")"
ingest_pw="$(sql_escape "$EPURE_INGEST_PASSWORD")"
app_pw="$(sql_escape "$EPURE_APP_PASSWORD")"

docker compose exec -T postgres psql -U epure -d epure -v ON_ERROR_STOP=1 <<EOF
ALTER ROLE epure PASSWORD '${pg_pw}';
ALTER ROLE epure_ingest PASSWORD '${ingest_pw}';
ALTER ROLE epure_app PASSWORD '${app_pw}';
EOF

echo "Postgres roles epure, epure_ingest, and epure_app now match .env."
echo "Recreate epure if it is crash-looping:"
echo "  docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml --profile tls up -d --force-recreate epure"
