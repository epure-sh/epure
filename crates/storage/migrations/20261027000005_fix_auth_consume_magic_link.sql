-- Fix ambiguous `email` in auth_consume_magic_link (RETURNS TABLE column vs magic_link_tokens.email).

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
    SELECT mlt.id, mlt.email::text, mlt.org_id, mlt.role
    INTO v_id, v_email, v_org_id, v_role
    FROM magic_link_tokens mlt
    WHERE mlt.token_hash = p_token_hash
      AND mlt.used_at IS NULL
      AND mlt.expires_at > now()
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

REVOKE ALL ON FUNCTION auth_consume_magic_link(bytea, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_consume_magic_link(bytea, boolean) TO epure_app;
