DROP FUNCTION IF EXISTS auth_lookup_user_by_email(citext);

CREATE OR REPLACE FUNCTION auth_lookup_user_by_email(p_email text)
RETURNS TABLE (
    id uuid,
    email text,
    password_hash bytea,
    google_sub text,
    display_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id, u.email::text, u.password_hash, u.google_sub, u.display_name
    FROM users u
    WHERE u.email = p_email::citext
    LIMIT 1;
$$;

DROP FUNCTION IF EXISTS auth_insert_user(uuid, citext, bytea, text);

CREATE OR REPLACE FUNCTION auth_insert_user(
    p_id uuid,
    p_email text,
    p_password_hash bytea,
    p_google_sub text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO users (id, email, password_hash, google_sub)
    VALUES (p_id, p_email::citext, p_password_hash, p_google_sub);
END;
$$;

REVOKE ALL ON FUNCTION auth_lookup_user_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_user_by_email(text) TO epure_app;

REVOKE ALL ON FUNCTION auth_insert_user(uuid, text, bytea, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_insert_user(uuid, text, bytea, text) TO epure_app;
