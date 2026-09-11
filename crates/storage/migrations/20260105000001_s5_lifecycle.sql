-- S5: webhooks, alerts, user feedback (snooze columns exist on issues from S1)

CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    format TEXT NOT NULL CHECK (format IN ('slack', 'discord', 'generic')),
    events TEXT[] NOT NULL DEFAULT ARRAY['issue_created', 'regression'],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX webhooks_project_id_idx ON webhooks(project_id);

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    issue_id UUID REFERENCES issues(id) ON DELETE SET NULL,
    kind TEXT NOT NULL CHECK (kind IN ('velocity_spike', 'regression')),
    fired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX alerts_org_fired_idx ON alerts(org_id, fired_at DESC);
CREATE INDEX alerts_project_fired_idx ON alerts(project_id, fired_at DESC);

CREATE TABLE user_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT,
    comments TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX user_feedback_event_id_idx ON user_feedback(event_id);
CREATE INDEX user_feedback_project_id_idx ON user_feedback(project_id);

-- RLS
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhooks_tenant ON webhooks
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM projects p
            WHERE p.id = webhooks.project_id
              AND p.org_id = current_setting('app.current_org_id', true)::uuid
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM projects p
            WHERE p.id = webhooks.project_id
              AND p.org_id = current_setting('app.current_org_id', true)::uuid
        )
    );

CREATE POLICY alerts_tenant ON alerts
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY user_feedback_tenant ON user_feedback
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM projects p
            WHERE p.id = user_feedback.project_id
              AND p.org_id = current_setting('app.current_org_id', true)::uuid
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM projects p
            WHERE p.id = user_feedback.project_id
              AND p.org_id = current_setting('app.current_org_id', true)::uuid
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON webhooks, alerts, user_feedback TO epure_ingest, epure_app;
