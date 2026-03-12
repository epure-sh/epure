CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT,
    retention_days INT NOT NULL DEFAULT 30,
    ingest_cap_per_hour INT NOT NULL DEFAULT 5000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dsn_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    public_key TEXT NOT NULL,
    secret_key BYTEA NOT NULL,
    label TEXT,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX dsn_keys_public_key_active_idx
    ON dsn_keys (public_key)
    WHERE revoked_at IS NULL;

CREATE TABLE issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    fingerprint TEXT NOT NULL,
    title TEXT,
    status TEXT NOT NULL DEFAULT 'unresolved',
    level TEXT,
    first_seen_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    event_count BIGINT NOT NULL DEFAULT 0,
    unique_user_count INT NOT NULL DEFAULT 0,
    environment TEXT,
    release TEXT,
    merge_parent_id UUID REFERENCES issues(id),
    resolved_in_release TEXT,
    snooze_until TIMESTAMPTZ,
    snooze_until_count INT,
    snooze_until_users INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX issues_project_fingerprint_idx
    ON issues (project_id, fingerprint)
    WHERE merge_parent_id IS NULL;

CREATE INDEX issues_project_status_last_seen_idx
    ON issues (project_id, status, last_seen_at DESC);

CREATE TABLE events (
    id UUID PRIMARY KEY,
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX events_issue_occurred_idx ON events (issue_id, occurred_at DESC);

CREATE TABLE issue_counters (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    fingerprint TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    count BIGINT NOT NULL DEFAULT 0,
    bodies_stored BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (project_id, fingerprint, window_start)
);
