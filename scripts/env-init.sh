#!/usr/bin/env bash
# Back-compat wrapper — prefer ./configure
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "${ROOT}/scripts/configure.sh" --port "${1:-8080}" --postgres-port "${2:-5433}"
