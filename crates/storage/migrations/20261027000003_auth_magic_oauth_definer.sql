-- Magic-link and OAuth token issuance via SECURITY DEFINER (public auth paths).
-- Tighten ingest role grants and revoke app access to ingest_set_org_context.

CREATE OR REPLACE FUNCTION auth_insert_magic_link_token(
    p_email text,
    p_org_id uuid,
    p_role text,
    p_token_hash bytea,
    p_expires_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO magic_link_tokens (email, token_hash, org_id, role, expires_at)
    VALUES (lower(trim(p_email)), p_token_hash, p_org_id, p_role, p_expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION auth_consume_magic_link(
    p_token_hash bytea,
    p_allow_self_serve boolean DEFAULT true
)
RETURNS TABLE (
    user_id uuid,
    org_id uuid,
    email text,
    role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid;
    v_email text;
    v_org_id uuid;
    v_role text;
    v_user_id uuid;
    v_new_org uuid;
    v_org_name text;
BEGIN
    SELECT id, email::text, org_id, role
    INTO v_id, v_email, v_org_id, v_role
    FROM magic_link_tokens
    WHERE token_hash = p_token_hash
      AND used_at IS NULL
      AND expires_at > now()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invalid_magic_link' USING ERRCODE = 'P0001';
    END IF;

    UPDATE magic_link_tokens SET used_at = now() WHERE id = v_id;

    SELECT u.id, om.org_id, om.role::text
    INTO v_user_id, v_org_id, v_role
    FROM users u
    INNER JOIN org_members om ON om.user_id = u.id
    WHERE u.email = v_email
    ORDER BY om.created_at ASC
    LIMIT 1;

    IF FOUND THEN
        user_id := v_user_id;
        org_id := v_org_id;
        email := v_email;
        role := v_role;
        RETURN NEXT;
        RETURN;
    END IF;

    IF v_org_id IS NULL AND NOT p_allow_self_serve THEN
        RAISE EXCEPTION 'registration_closed' USING ERRCODE = 'P0001';
    END IF;

    v_user_id := gen_random_uuid();
    INSERT INTO users (id, email, credential_generation)
    VALUES (v_user_id, v_email, 1);

    IF v_org_id IS NOT NULL THEN
        INSERT INTO org_members (org_id, user_id, role)
        VALUES (v_org_id, v_user_id, COALESCE(v_role, 'member'));
        user_id := v_user_id;
        org_id := v_org_id;
        email := v_email;
        role := COALESCE(v_role, 'member');
        RETURN NEXT;
        RETURN;
    END IF;

    v_new_org := gen_random_uuid();
    v_org_name := split_part(v_email, '@', 1) || '''s Workspace';
    PERFORM auth_bootstrap_workspace(v_user_id, v_new_org, v_org_name);

    user_id := v_user_id;
    org_id := v_new_org;
    email := v_email;
    role := 'owner';
    RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION oauth_issue_tokens(
    p_user_id uuid,
    p_org_id uuid,
    p_client_id text,
    p_client_name text,
    p_scopes text[],
    p_ip_address text,
    p_user_agent text,
    p_access_token_prefix text,
    p_access_token_hash bytea,
    p_refresh_token_prefix text,
    p_refresh_token_hash bytea,
    p_access_expires_at timestamptz,
    p_refresh_expires_at timestamptz
)
RETURNS TABLE (authorization_id uuid, agent_token_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auth_id uuid;
    v_agent_id uuid;
    v_label text;
BEGIN
    PERFORM set_config('app.current_org_id', p_org_id::text, true);

    INSERT INTO oauth_authorizations (
        user_id, org_id, client_id, client_name, scopes, ip_address, user_agent, last_used_at
    )
    VALUES (
        p_user_id, p_org_id, p_client_id, p_client_name, p_scopes,
        p_ip_address, p_user_agent, now()
    )
    RETURNING id INTO v_auth_id;

    v_label := 'OAuth: ' || p_client_name;
    INSERT INTO agent_tokens (
        org_id, user_id, label, token_prefix, secret_hash, scopes, expires_at
    )
    VALUES (
        p_org_id, p_user_id, v_label, p_access_token_prefix, p_access_token_hash,
        p_scopes, p_access_expires_at
    )
    RETURNING id INTO v_agent_id;

    INSERT INTO oauth_tokens (
        authorization_id, agent_token_id, refresh_token_prefix, refresh_token_hash, expires_at
    )
    VALUES (
        v_auth_id, v_agent_id, p_refresh_token_prefix, p_refresh_token_hash, p_refresh_expires_at
    );

    authorization_id := v_auth_id;
    agent_token_id := v_agent_id;
    RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION auth_insert_magic_link_token(text, uuid, text, bytea, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_insert_magic_link_token(text, uuid, text, bytea, timestamptz) TO epure_app;

REVOKE ALL ON FUNCTION auth_consume_magic_link(bytea, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_consume_magic_link(bytea, boolean) TO epure_app;

REVOKE ALL ON FUNCTION oauth_issue_tokens(
    uuid, uuid, text, text, text[], text, text, text, bytea, text, bytea, timestamptz, timestamptz
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION oauth_issue_tokens(
    uuid, uuid, text, text, text[], text, text, text, bytea, text, bytea, timestamptz, timestamptz
) TO epure_app;

REVOKE EXECUTE ON FUNCTION ingest_set_org_context(uuid) FROM epure_app;

REVOKE SELECT, INSERT, UPDATE, DELETE ON subscriptions FROM epure_ingest;
REVOKE SELECT, INSERT, UPDATE, DELETE ON canary_meta FROM epure_ingest;
REVOKE SELECT, INSERT, UPDATE, DELETE ON magic_link_tokens FROM epure_ingest;
