#!/usr/bin/env bash
# Capture framed README / .github screenshots from a running Epure stack.
# Requires: Epure on :8080, Node 22+, Playwright chromium, landing sharp dep.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LANDING="$(cd "$ROOT/../../landing" && pwd)"

export EPURE_BASE_URL="${EPURE_BASE_URL:-http://localhost:8080}"
export EPURE_PROJECT_ID="${EPURE_PROJECT_ID:-550e8400-e29b-41d4-a716-446655440000}"
export EPURE_ISSUE_ID="${EPURE_ISSUE_ID:-}"

cd "$LANDING"
node scripts/capture-product-screenshots.mjs
