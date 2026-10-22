-- Monitors / Crons table for tracking cron and heartbeat check-ins

CREATE TABLE IF NOT EXISTS monitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    org_id UUID NOT NULL,
    slug VARCHAR(255) NOT NULL,
    schedule TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'in_progress', 'error', 'missed')),
    last_check_in_at TIMESTAMPTZ,
    last_duration_ms DOUBLE PRECISION,
    environment VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT monitors_org_project_fk
        FOREIGN KEY (org_id, project_id) REFERENCES projects (org_id, id)
        ON DELETE CASCADE,
    CONSTRAINT monitors_project_slug_unique
        UNIQUE (project_id, slug)
);

CREATE TABLE IF NOT EXISTS monitor_check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id UUID NOT NULL REFERENCES monitors (id) ON DELETE CASCADE,
    project_id UUID NOT NULL,
    org_id UUID NOT NULL,
    check_in_id VARCHAR(128),
    status VARCHAR(32) NOT NULL,
    duration_ms DOUBLE PRECISION,
    environment VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT monitor_check_ins_org_project_fk
        FOREIGN KEY (org_id, project_id) REFERENCES projects (org_id, id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS monitors_project_id_idx ON monitors (project_id);
CREATE INDEX IF NOT EXISTS monitors_org_id_idx ON monitors (org_id);
CREATE INDEX IF NOT EXISTS monitor_check_ins_monitor_id_idx ON monitor_check_ins (monitor_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON monitors, monitor_check_ins TO epure_ingest, epure_app;

ALTER TABLE monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitors FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS monitors_tenant ON monitors;
CREATE POLICY monitors_tenant ON monitors
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (
        org_id = current_setting('app.current_org_id', true)::uuid
        AND EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = monitors.project_id
              AND p.org_id = monitors.org_id
              AND p.org_id = current_setting('app.current_org_id', true)::uuid
        )
    );

ALTER TABLE monitor_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitor_check_ins FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS monitor_check_ins_tenant ON monitor_check_ins;
CREATE POLICY monitor_check_ins_tenant ON monitor_check_ins
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (
        org_id = current_setting('app.current_org_id', true)::uuid
    );

-- Helper function for alert email dispatching under strict RLS
CREATE OR REPLACE FUNCTION ingest_get_org_member_emails(p_org_id uuid)
RETURNS TABLE (email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT DISTINCT u.email::text
    FROM users u
    INNER JOIN org_members om ON om.user_id = u.id
    WHERE om.org_id = p_org_id AND u.email IS NOT NULL AND u.email != '';
$$;

REVOKE ALL ON FUNCTION ingest_get_org_member_emails(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ingest_get_org_member_emails(uuid) TO epure_ingest, epure_app;
