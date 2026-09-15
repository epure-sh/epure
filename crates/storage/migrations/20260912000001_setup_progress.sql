CREATE TABLE user_setup_progress (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    project_named BOOLEAN NOT NULL DEFAULT false,
    dsn_copied_at TIMESTAMPTZ,
    first_issue_seen_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, org_id, project_id)
);

CREATE INDEX user_setup_progress_org_project_idx
    ON user_setup_progress (org_id, project_id);

ALTER TABLE user_setup_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_setup_progress_tenant ON user_setup_progress
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON user_setup_progress TO epure_app;
