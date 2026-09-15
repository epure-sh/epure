-- S3c: dashboard auth schema (magic-link + org membership)

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE org_members (
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (org_id, user_id)
);

CREATE INDEX org_members_user_id_idx ON org_members (user_id);

CREATE TABLE magic_link_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT NOT NULL,
    token_hash BYTEA NOT NULL,
    org_id UUID NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NULL CHECK (role IS NULL OR role IN ('owner', 'admin', 'member')),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX magic_link_tokens_hash_active_idx
    ON magic_link_tokens (token_hash)
    WHERE used_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON users, org_members, magic_link_tokens TO epure_ingest, epure_app;
