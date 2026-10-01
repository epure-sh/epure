-- Bump this when a password changes so older dashboard sessions stop matching.
-- Agent tokens for that user are revoked in the same statement.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS credential_generation bigint NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION auth_credential_generation(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.credential_generation
    FROM users u
    WHERE u.id = p_user_id;
$$;

REVOKE ALL ON FUNCTION auth_credential_generation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_credential_generation(uuid) TO epure_app;

CREATE OR REPLACE FUNCTION auth_bump_credential_generation(p_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_gen bigint;
BEGIN
    UPDATE users
    SET credential_generation = credential_generation + 1
    WHERE id = p_user_id
    RETURNING credential_generation INTO next_gen;

    IF next_gen IS NULL THEN
        RAISE EXCEPTION 'user not found' USING ERRCODE = '42501';
    END IF;

    UPDATE agent_tokens
    SET revoked_at = now()
    WHERE user_id = p_user_id
      AND revoked_at IS NULL;

    RETURN next_gen;
END;
$$;

REVOKE ALL ON FUNCTION auth_bump_credential_generation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_bump_credential_generation(uuid) TO epure_app;
