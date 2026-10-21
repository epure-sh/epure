-- Migration: Ensure epure_app has execute on ingest_set_org_context and clean canary helpers

GRANT EXECUTE ON FUNCTION ingest_set_org_context(uuid) TO epure_app;
