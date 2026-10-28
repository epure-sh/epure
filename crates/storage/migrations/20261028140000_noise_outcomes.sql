-- Server-side noise rules and an hourly accounting of what happened to events.
-- Presets default off: a missing row means nothing is suppressed.

CREATE TABLE IF NOT EXISTS project_noise_policies (
    project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    org_id UUID NOT NULL,
    extensions BOOLEAN NOT NULL DEFAULT false,
    crawlers BOOLEAN NOT NULL DEFAULT false,
    localhost BOOLEAN NOT NULL DEFAULT false,
    legacy_browsers BOOLEAN NOT NULL DEFAULT false,
    resize_observer BOOLEAN NOT NULL DEFAULT false,
    chunk_load BOOLEAN NOT NULL DEFAULT false,
    message_patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT project_noise_policies_org_project_fk
        FOREIGN KEY (org_id, project_id) REFERENCES projects (org_id, id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ingest_outcomes (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    org_id UUID NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    count BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (project_id, window_start, reason),
    CONSTRAINT ingest_outcomes_org_project_fk
        FOREIGN KEY (org_id, project_id) REFERENCES projects (org_id, id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ingest_outcomes_project_window_idx
    ON ingest_outcomes (project_id, window_start DESC);

ALTER TABLE project_noise_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_noise_policies FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_noise_policies_tenant ON project_noise_policies;
CREATE POLICY project_noise_policies_tenant ON project_noise_policies
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE ingest_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_outcomes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ingest_outcomes_tenant ON ingest_outcomes;
CREATE POLICY ingest_outcomes_tenant ON ingest_outcomes
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON project_noise_policies, ingest_outcomes
    TO epure_ingest, epure_app;

ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_kind_check;
ALTER TABLE alerts
    ADD CONSTRAINT alerts_kind_check
    CHECK (kind IN (
        'velocity_spike',
        'regression',
        'new_issue',
        'event_milestone',
        'users_affected',
        'ingest_cap_hit',
        'custom',
        'noise_spike'
    ));
