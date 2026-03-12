-- Alert triage (per-user read/ignore), custom rules, snooze overlay status.

-- ---------------------------------------------------------------------------
-- Snooze: remember status to restore when the overlay expires
-- ---------------------------------------------------------------------------

ALTER TABLE issues
    ADD COLUMN IF NOT EXISTS pre_snooze_status TEXT;

-- ---------------------------------------------------------------------------
-- Per-user alert read / ignore
-- ---------------------------------------------------------------------------

CREATE TABLE alert_user_states (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ,
    ignored BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (user_id, alert_id)
);

CREATE INDEX alert_user_states_alert_id_idx ON alert_user_states (alert_id);

-- Suppress future notifications for a rule/issue after Ignore.
CREATE TABLE alert_suppressions (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    issue_id UUID,
    ignored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT alert_suppressions_unique UNIQUE NULLS NOT DISTINCT (project_id, kind, issue_id)
);

CREATE INDEX alert_suppressions_project_idx ON alert_suppressions (project_id);

-- ---------------------------------------------------------------------------
-- Custom alert rules (built-in engines stay; these add filters/thresholds)
-- ---------------------------------------------------------------------------

CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    kind TEXT NOT NULL CHECK (kind IN (
        'velocity_spike',
        'regression',
        'issue_created'
    )),
    environment TEXT,
    threshold INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX alert_rules_project_idx ON alert_rules (project_id);

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
        'custom'
    ));

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE alert_user_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY alert_user_states_tenant ON alert_user_states
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM alerts a
            WHERE a.id = alert_user_states.alert_id
              AND a.org_id = current_setting('app.current_org_id', true)::uuid
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM alerts a
            WHERE a.id = alert_user_states.alert_id
              AND a.org_id = current_setting('app.current_org_id', true)::uuid
        )
    );

CREATE POLICY alert_suppressions_tenant ON alert_suppressions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM projects p
            WHERE p.id = alert_suppressions.project_id
              AND p.org_id = current_setting('app.current_org_id', true)::uuid
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM projects p
            WHERE p.id = alert_suppressions.project_id
              AND p.org_id = current_setting('app.current_org_id', true)::uuid
        )
    );

CREATE POLICY alert_rules_tenant ON alert_rules
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE
    ON alert_user_states, alert_suppressions, alert_rules
    TO epure_ingest, epure_app;
