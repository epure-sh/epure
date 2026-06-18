-- S3: RLS roles, monthly event partitions, unique-user tracking

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'epure_ingest') THEN
        CREATE ROLE epure_ingest WITH LOGIN PASSWORD 'epure_ingest' BYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'epure_app') THEN
        CREATE ROLE epure_app WITH LOGIN PASSWORD 'epure_app';
    END IF;
END
$$;

DO $$
BEGIN
    EXECUTE format(
        'GRANT CONNECT ON DATABASE %I TO epure_ingest, epure_app',
        current_database()
    );
END
$$;
GRANT USAGE ON SCHEMA public TO epure_ingest, epure_app;

-- ---------------------------------------------------------------------------
-- Project retention constraint
-- ---------------------------------------------------------------------------

ALTER TABLE projects
    DROP CONSTRAINT IF EXISTS projects_retention_days_check;

ALTER TABLE projects
    ADD CONSTRAINT projects_retention_days_check
    CHECK (retention_days IN (14, 30, 90));

-- ---------------------------------------------------------------------------
-- Convert events → monthly partitions
-- ---------------------------------------------------------------------------

ALTER TABLE events RENAME TO events_legacy;

CREATE TABLE events (
    id UUID NOT NULL,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    occurred_at TIMESTAMPTZ NOT NULL,
    environment TEXT,
    release TEXT,
    platform TEXT,
    runtime_name TEXT,
    runtime_version TEXT,
    browser_name TEXT,
    os_name TEXT,
    country_code CHAR(2),
    user_id TEXT,
    user_email TEXT,
    payload_json JSONB NOT NULL,
    stack_frames JSONB,
    breadcrumbs JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- Create partitions for every month present in legacy data, plus current + next month.
DO $$
DECLARE
    month_start DATE;
    month_end DATE;
    partition_name TEXT;
BEGIN
    FOR month_start IN
        SELECT DISTINCT date_trunc('month', occurred_at)::date FROM events_legacy
        UNION
        SELECT date_trunc('month', CURRENT_DATE)::date
        UNION
        SELECT (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date
        ORDER BY 1
    LOOP
        month_end := (month_start + INTERVAL '1 month')::date;
        partition_name := format(
            'events_%s_%s',
            to_char(month_start, 'YYYY'),
            to_char(month_start, 'MM')
        );
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF events FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            month_start,
            month_end
        );
    END LOOP;
END
$$;

INSERT INTO events (
    id,
    org_id,
    project_id,
    issue_id,
    occurred_at,
    environment,
    release,
    platform,
    runtime_name,
    runtime_version,
    browser_name,
    os_name,
    country_code,
    user_id,
    user_email,
    payload_json,
    stack_frames,
    breadcrumbs,
    created_at
)
SELECT
    id,
    org_id,
    project_id,
    issue_id,
    occurred_at,
    environment,
    release,
    platform,
    runtime_name,
    runtime_version,
    browser_name,
    os_name,
    country_code,
    user_id,
    user_email,
    payload_json,
    stack_frames,
    breadcrumbs,
    created_at
FROM events_legacy;

DROP TABLE events_legacy;

CREATE INDEX events_issue_occurred_idx ON events (issue_id, occurred_at DESC);
CREATE INDEX events_project_env_occurred_idx ON events (project_id, environment, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- Unique users per issue
-- ---------------------------------------------------------------------------

CREATE TABLE issue_unique_users (
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_key TEXT NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (issue_id, user_key)
);

CREATE INDEX issue_unique_users_issue_id_idx ON issue_unique_users (issue_id);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsn_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_unique_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_tenant ON projects
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY issues_tenant ON issues
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY events_tenant ON events
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY releases_tenant ON releases
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM projects p
            WHERE p.id = releases.project_id
              AND p.org_id = current_setting('app.current_org_id', true)::uuid
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM projects p
            WHERE p.id = releases.project_id
              AND p.org_id = current_setting('app.current_org_id', true)::uuid
        )
    );

CREATE POLICY release_artifacts_tenant ON release_artifacts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM releases r
            INNER JOIN projects p ON p.id = r.project_id
            WHERE r.id = release_artifacts.release_id
              AND p.org_id = current_setting('app.current_org_id', true)::uuid
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM releases r
            INNER JOIN projects p ON p.id = r.project_id
            WHERE r.id = release_artifacts.release_id
              AND p.org_id = current_setting('app.current_org_id', true)::uuid
        )
    );

CREATE POLICY dsn_keys_tenant ON dsn_keys
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM projects p
            WHERE p.id = dsn_keys.project_id
              AND p.org_id = current_setting('app.current_org_id', true)::uuid
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM projects p
            WHERE p.id = dsn_keys.project_id
              AND p.org_id = current_setting('app.current_org_id', true)::uuid
        )
    );

CREATE POLICY issue_unique_users_tenant ON issue_unique_users
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM issues i
            WHERE i.id = issue_unique_users.issue_id
              AND i.org_id = current_setting('app.current_org_id', true)::uuid
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM issues i
            WHERE i.id = issue_unique_users.issue_id
              AND i.org_id = current_setting('app.current_org_id', true)::uuid
        )
    );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO epure_ingest, epure_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO epure_ingest, epure_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO epure_ingest, epure_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO epure_ingest, epure_app;
