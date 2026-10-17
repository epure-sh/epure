-- OAuth 2.0 PKCE, Device Authorization Flow, and Connected Apps for CLI & MCP

-- 1. OAuth Authorizations (Active user sessions for CLI & MCP)
CREATE TABLE oauth_authorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL,
    client_name TEXT NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT ARRAY['read:agent', 'write:triage']::text[],
    ip_address TEXT,
    user_agent TEXT,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX oauth_auth_user_org_idx ON oauth_authorizations (user_id, org_id) WHERE revoked_at IS NULL;
CREATE INDEX oauth_auth_client_idx ON oauth_authorizations (client_id);

-- 2. OAuth Tokens (Access tokens link to agent_tokens for authentication + Refresh Tokens)
CREATE TABLE oauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authorization_id UUID NOT NULL REFERENCES oauth_authorizations(id) ON DELETE CASCADE,
    agent_token_id UUID NOT NULL REFERENCES agent_tokens(id) ON DELETE CASCADE,
    refresh_token_prefix TEXT NOT NULL UNIQUE,
    refresh_token_hash BYTEA NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX oauth_tokens_auth_idx ON oauth_tokens (authorization_id);

-- 3. OAuth Authorization Codes (PKCE handshake)
CREATE TABLE oauth_codes (
    code_hash BYTEA PRIMARY KEY,
    client_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    redirect_uri TEXT NOT NULL,
    code_challenge TEXT NOT NULL,
    code_challenge_method TEXT NOT NULL DEFAULT 'S256',
    scopes TEXT[] NOT NULL,
    client_name TEXT NOT NULL DEFAULT '',
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);

CREATE INDEX oauth_codes_expiry_idx ON oauth_codes (expires_at) WHERE used_at IS NULL;

-- 4. OAuth Device Codes (RFC 8628 Device Authorization Flow)
CREATE TABLE oauth_device_codes (
    device_code_hash BYTEA PRIMARY KEY,
    user_code TEXT NOT NULL UNIQUE,
    client_id TEXT NOT NULL,
    client_name TEXT NOT NULL DEFAULT '',
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    scopes TEXT[] NOT NULL DEFAULT ARRAY['read:agent', 'write:triage']::text[],
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX oauth_device_codes_user_code_idx ON oauth_device_codes (user_code);

-- 5. Row-Level Security
ALTER TABLE oauth_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_authorizations FORCE ROW LEVEL SECURITY;

CREATE POLICY oauth_authorizations_user ON oauth_authorizations
    FOR ALL
    USING (
        user_id = current_setting('app.current_user_id', true)::uuid
        OR org_id = current_setting('app.current_org_id', true)::uuid
    )
    WITH CHECK (
        user_id = current_setting('app.current_user_id', true)::uuid
        OR org_id = current_setting('app.current_org_id', true)::uuid
    );

-- 6. Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_authorizations TO epure_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_tokens TO epure_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_codes TO epure_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_device_codes TO epure_app;

-- 7. SECURITY DEFINER helpers for high-security token exchange
CREATE OR REPLACE FUNCTION oauth_lookup_refresh_token(p_prefix text)
RETURNS TABLE (
    token_id uuid,
    authorization_id uuid,
    agent_token_id uuid,
    refresh_token_hash bytea,
    expires_at timestamptz,
    revoked_at timestamptz,
    user_id uuid,
    org_id uuid,
    client_id text,
    scopes text[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        ot.id AS token_id,
        ot.authorization_id,
        ot.agent_token_id,
        ot.refresh_token_hash,
        ot.expires_at,
        ot.revoked_at,
        oa.user_id,
        oa.org_id,
        oa.client_id,
        oa.scopes
    FROM oauth_tokens ot
    JOIN oauth_authorizations oa ON oa.id = ot.authorization_id
    WHERE ot.refresh_token_prefix = p_prefix
      AND ot.revoked_at IS NULL
      AND oa.revoked_at IS NULL
      AND ot.expires_at > now()
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION oauth_lookup_refresh_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION oauth_lookup_refresh_token(text) TO epure_app;
