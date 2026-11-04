#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DATABASE_URL:?Set a dedicated local test database URL}"
: "${EPURE_INGEST_DATABASE_URL:?Set the restricted ingestion role URL}"
: "${EPURE_APP_DATABASE_URL:?Set the restricted app role URL}"
cargo test -p epure-envelope
cargo test -p epure-server --lib
cargo test -p epure-server --test durable_ingest --test ingester_audit -- --test-threads=1 --nocapture
