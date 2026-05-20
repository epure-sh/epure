#!/usr/bin/env sh
# Deprecated — preview error data comes from register; heavy volume is ./scripts/seed.sh
set -eu
cd "$(dirname "$0")/.."
echo "error: seed-dev.sh was removed." >&2
echo "  Preview data: register at /login (Acme Web + Acme API)." >&2
echo "  Heavy UX data: ./scripts/seed.sh [--email … --password … | --link-user …]" >&2
exit 1
