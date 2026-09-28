-- Personal access tokens for Agent API / CLI / MCP (machine auth).

CREATE TABLE agent_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    label text NOT NULL DEFAULT '',
    token_prefix text NOT NULL,
    secret_hash bytea NOT NULL,
    scopes text[] NOT NULL DEFAULT ARRAY['read:agent']::text[],
    last_used_at timestamptz,
    expires_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX agent_tokens_active_prefix_idx
    ON agent_tokens (token_prefix)
    WHERE revoked_at IS NULL;

CREATE INDEX agent_tokens_org_idx ON agent_tokens (org_id);

ALTER TABLE agent_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tokens FORCE ROW LEVEL SECURITY;

CREATE POLICY agent_tokens_tenant ON agent_tokens
    USING (org_id = current_setting('app.current_org_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON agent_tokens TO epure_app;

-- Lookup by prefix before org context is established (auth middleware).
CREATE OR REPLACE FUNCTION auth_lookup_agent_token(p_prefix text)
RETURNS TABLE (
    id uuid,
    org_id uuid,
    user_id uuid,
    secret_hash bytea,
    scopes text[],
    expires_at timestamptz,
    revoked_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        t.id,
        t.org_id,
        t.user_id,
        t.secret_hash,
        t.scopes,
        t.expires_at,
        t.revoked_at
    FROM agent_tokens t
    WHERE t.token_prefix = p_prefix
      AND t.revoked_at IS NULL
      AND (t.expires_at IS NULL OR t.expires_at > now())
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION auth_lookup_agent_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_agent_token(text) TO epure_app;

CREATE OR REPLACE FUNCTION auth_touch_agent_token(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE agent_tokens
    SET last_used_at = now()
    WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION auth_touch_agent_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_touch_agent_token(uuid) TO epure_app;
