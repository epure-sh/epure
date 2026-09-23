-- Historical migrations created epure_ingest / epure_app with documented
-- example passwords. Those strings must not remain valid after migrate.
-- The binary sets the real passwords from DATABASE_URL / EPURE_*_DATABASE_URL
-- immediately after this file runs.

DO $$
DECLARE
  ingest_pw text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  app_pw text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'epure_ingest') THEN
    EXECUTE format('ALTER ROLE epure_ingest PASSWORD %L', ingest_pw);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'epure_app') THEN
    EXECUTE format('ALTER ROLE epure_app PASSWORD %L', app_pw);
  END IF;
END
$$;
