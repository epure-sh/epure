#!/usr/bin/env sh
# Deprecated wrapper — use ./scripts/seed.sh
set -eu
cd "$(dirname "$0")/.."
echo "note: seed-heavy.sh is deprecated; forwarding to ./scripts/seed.sh" >&2
exec ./scripts/seed.sh "$@"
