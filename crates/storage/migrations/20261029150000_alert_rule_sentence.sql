-- The create-alert wizard stores the sentence (when / if / then) and where it is sent.

ALTER TABLE alert_rules
    ADD COLUMN IF NOT EXISTS triggers JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS condition_match TEXT NOT NULL DEFAULT 'all',
    ADD COLUMN IF NOT EXISTS conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS payload_options JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS channel_ids UUID[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS cooldown_mins INT NOT NULL DEFAULT 30;

ALTER TABLE alert_rules DROP CONSTRAINT IF EXISTS alert_rules_condition_match_check;
ALTER TABLE alert_rules
    ADD CONSTRAINT alert_rules_condition_match_check
    CHECK (condition_match IN ('all', 'any'));

CREATE TABLE IF NOT EXISTS alert_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    label TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT alert_channels_provider_check
        CHECK (provider IN ('slack', 'discord', 'telegram', 'email', 'webhook'))
);

CREATE INDEX IF NOT EXISTS alert_channels_project_idx ON alert_channels (project_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON alert_channels TO epure_app;

ALTER TABLE alert_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_channels FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alert_channels_tenant ON alert_channels;
CREATE POLICY alert_channels_tenant ON alert_channels
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (
        org_id = current_setting('app.current_org_id', true)::uuid
        AND EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = alert_channels.project_id
              AND p.org_id = alert_channels.org_id
        )
    );
