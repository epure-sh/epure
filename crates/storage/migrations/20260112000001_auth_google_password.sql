-- Auth refactor: Google OAuth + email/password (constitution v1.1.0)

ALTER TABLE users
    ADD COLUMN password_hash BYTEA NULL,
    ADD COLUMN google_sub TEXT NULL;

CREATE UNIQUE INDEX users_google_sub_idx ON users (google_sub) WHERE google_sub IS NOT NULL;

CREATE TABLE org_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT NOT NULL,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    token_hash BYTEA NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX org_invitations_email_active_idx
    ON org_invitations (email)
    WHERE accepted_at IS NULL;

DROP TABLE IF EXISTS magic_link_tokens;

GRANT SELECT, INSERT, UPDATE, DELETE ON org_invitations TO epure_ingest, epure_app;
GRANT UPDATE ON users TO epure_ingest, epure_app;
