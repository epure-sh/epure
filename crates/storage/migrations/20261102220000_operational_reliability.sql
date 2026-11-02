-- Dispatch reads remain tenant-scoped by the existing FORCE RLS policy.
GRANT SELECT ON alert_channels TO epure_ingest;

-- Transaction-local settings are empty strings after a pooled transaction has
-- reset them. An unset optional context must not fail an otherwise valid lookup.
ALTER POLICY oauth_authorizations_user ON oauth_authorizations
    USING (
        user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    )
    WITH CHECK (
        user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    );

-- Durable webhook outbox. No signing keys or credentials are copied into it.
CREATE TABLE webhook_deliveries (
    id uuid PRIMARY KEY,
    org_id uuid NOT NULL,
    project_id uuid NOT NULL,
    webhook_id uuid NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event text NOT NULL,
    payload jsonb NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','delivered','failed','cancelled')),
    attempts integer NOT NULL DEFAULT 0,
    http_status integer,
    last_error text,
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (org_id, project_id) REFERENCES projects(org_id, id) ON DELETE CASCADE
);
CREATE INDEX webhook_deliveries_due ON webhook_deliveries(next_attempt_at)
    WHERE status IN ('pending','processing');
GRANT SELECT, INSERT, UPDATE ON webhook_deliveries TO epure_ingest, epure_app;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries FORCE ROW LEVEL SECURITY;
CREATE POLICY webhook_deliveries_tenant ON webhook_deliveries
    USING (org_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- Incident state is separate from the latest SDK check-in state.
ALTER TABLE monitors
    ADD COLUMN consecutive_failures integer NOT NULL DEFAULT 0,
    ADD COLUMN incident_open boolean NOT NULL DEFAULT false,
    ADD COLUMN active_check_in_id text,
    ADD COLUMN runtime_started_at timestamptz;
CREATE INDEX monitors_deadline ON monitors(next_check_in_at) WHERE paused = false;
ALTER TABLE monitors ADD COLUMN incident_issue_id uuid REFERENCES issues(id) ON DELETE SET NULL;
CREATE TABLE monitor_transitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id uuid NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    issue_id uuid REFERENCES issues(id) ON DELETE SET NULL,
    kind text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    attempts integer NOT NULL DEFAULT 0,
    last_error text
);
-- Only the maintenance job may read cross-tenant transitions. Dashboard history
-- is exposed through tenant-scoped alerts instead of this internal queue.
REVOKE ALL ON monitor_transitions FROM PUBLIC;
GRANT INSERT ON monitor_transitions TO epure_ingest;

-- Existing channel destinations should receive monitor recovery notifications.
UPDATE webhooks w SET events=array_append(w.events,'monitor_recovered')
WHERE NOT ('monitor_recovered'=ANY(w.events)) AND EXISTS (
    SELECT 1 FROM alert_channels c WHERE c.config->>'webhook_id'=w.id::text
);
