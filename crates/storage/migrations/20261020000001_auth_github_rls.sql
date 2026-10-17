-- GitHub OAuth signup/linking via SECURITY DEFINER (same pattern as Google).

CREATE OR REPLACE FUNCTION auth_lookup_user_by_github_id(p_github_id text)
RETURNS TABLE (
    user_id uuid,
    email text,
    org_id uuid,
    role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id, u.email::text, om.org_id, om.role
    FROM users u
    INNER JOIN org_members om ON om.user_id = u.id
    WHERE u.github_id = p_github_id
    ORDER BY om.created_at ASC
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_insert_user_github(
    p_id uuid,
    p_email text,
    p_github_id text,
    p_github_login text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO users (id, email, github_id, github_login, credential_generation)
    VALUES (p_id, p_email::citext, p_github_id, p_github_login, 1);
END;
$$;

CREATE OR REPLACE FUNCTION auth_link_github_identity(
    p_user_id uuid,
    p_github_id text,
    p_github_login text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE users
    SET github_id = p_github_id,
        github_login = p_github_login
    WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION auth_lookup_user_by_github_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_user_by_github_id(text) TO epure_app;

REVOKE ALL ON FUNCTION auth_insert_user_github(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_insert_user_github(uuid, text, text, text) TO epure_app;

REVOKE ALL ON FUNCTION auth_link_github_identity(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_link_github_identity(uuid, text, text) TO epure_app;
