-- Sentry SDK v7 validates DSN projectId as numeric; Epure uses UUIDs internally.
-- Expose a stable numeric segment in the DSN path while keeping UUID primary keys.

CREATE SEQUENCE IF NOT EXISTS projects_dsn_project_id_seq START WITH 100010;

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS dsn_project_id BIGINT;

UPDATE projects
SET dsn_project_id = 100001
WHERE id = '550e8400-e29b-41d4-a716-446655440000'::uuid
  AND dsn_project_id IS NULL;

UPDATE projects
SET dsn_project_id = 100002
WHERE id = '660e8400-e29b-41d4-a716-446655440001'::uuid
  AND dsn_project_id IS NULL;

UPDATE projects
SET dsn_project_id = 100003
WHERE id = '770e8400-e29b-41d4-a716-446655440002'::uuid
  AND dsn_project_id IS NULL;

UPDATE projects
SET dsn_project_id = nextval('projects_dsn_project_id_seq')
WHERE dsn_project_id IS NULL;

ALTER TABLE projects
    ALTER COLUMN dsn_project_id SET NOT NULL;

ALTER TABLE projects
    ALTER COLUMN dsn_project_id SET DEFAULT nextval('projects_dsn_project_id_seq');

CREATE UNIQUE INDEX IF NOT EXISTS projects_dsn_project_id_key ON projects (dsn_project_id);

CREATE OR REPLACE FUNCTION ingest_lookup_project_id(p_dsn_project_id bigint)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM projects WHERE dsn_project_id = p_dsn_project_id LIMIT 1;
$$;

REVOKE ALL ON FUNCTION ingest_lookup_project_id(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ingest_lookup_project_id(bigint) TO epure_ingest;
