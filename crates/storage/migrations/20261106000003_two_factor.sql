-- TOTP two-factor login. Secrets and recovery-code hashes are reachable only
-- through these SECURITY DEFINER functions (the app role cannot read tables).

CREATE TABLE IF NOT EXISTS user_totp (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    secret bytea NOT NULL,
    enabled_at timestamptz,
    last_counter bigint NOT NULL DEFAULT -1,
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE user_totp ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON user_totp FROM PUBLIC;

CREATE TABLE IF NOT EXISTS user_recovery_codes (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash bytea NOT NULL,
    used_at timestamptz,
    PRIMARY KEY (user_id, code_hash)
);
ALTER TABLE user_recovery_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON user_recovery_codes FROM PUBLIC;

CREATE OR REPLACE FUNCTION auth_totp_state(p_user uuid)
RETURNS TABLE (secret bytea, enabled boolean, last_counter bigint, recovery_left integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT t.secret, t.enabled_at IS NOT NULL, t.last_counter,
           (SELECT count(*)::int FROM user_recovery_codes r WHERE r.user_id = p_user AND r.used_at IS NULL)
    FROM user_totp t WHERE t.user_id = p_user;
$$;

-- Store a pending secret (replaces any pending one; refuses while enabled).
CREATE OR REPLACE FUNCTION auth_totp_begin(p_user uuid, p_secret bytea)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM user_totp WHERE user_id = p_user AND enabled_at IS NOT NULL) THEN
        RETURN false;
    END IF;
    INSERT INTO user_totp (user_id, secret) VALUES (p_user, p_secret)
    ON CONFLICT (user_id) DO UPDATE SET secret = EXCLUDED.secret, last_counter = -1, created_at = now();
    RETURN true;
END;
$$;

-- Enable after the first valid code; stores recovery-code hashes.
CREATE OR REPLACE FUNCTION auth_totp_enable(p_user uuid, p_counter bigint, p_codes bytea[])
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    UPDATE user_totp SET enabled_at = now(), last_counter = p_counter
    WHERE user_id = p_user AND enabled_at IS NULL;
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    DELETE FROM user_recovery_codes WHERE user_id = p_user;
    INSERT INTO user_recovery_codes (user_id, code_hash)
    SELECT p_user, c FROM unnest(p_codes) AS c ON CONFLICT DO NOTHING;
    RETURN true;
END;
$$;

-- Accept a code's counter once (refuses replays of the same or older step).
CREATE OR REPLACE FUNCTION auth_totp_accept(p_user uuid, p_counter bigint)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
    WITH accepted AS (
        UPDATE user_totp SET last_counter = p_counter
        WHERE user_id = p_user AND enabled_at IS NOT NULL AND last_counter < p_counter
        RETURNING 1
    )
    SELECT EXISTS (SELECT 1 FROM accepted);
$$;

CREATE OR REPLACE FUNCTION auth_totp_use_recovery(p_user uuid, p_hash bytea)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
    WITH used AS (
        UPDATE user_recovery_codes SET used_at = now()
        WHERE user_id = p_user AND code_hash = p_hash AND used_at IS NULL
          AND EXISTS (SELECT 1 FROM user_totp t WHERE t.user_id = p_user AND t.enabled_at IS NOT NULL)
        RETURNING 1
    )
    SELECT EXISTS (SELECT 1 FROM used);
$$;

CREATE OR REPLACE FUNCTION auth_totp_disable(p_user uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
    DELETE FROM user_recovery_codes WHERE user_id = p_user;
    DELETE FROM user_totp WHERE user_id = p_user;
$$;

DO $$
DECLARE f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'auth_totp_state(uuid)', 'auth_totp_begin(uuid, bytea)',
        'auth_totp_enable(uuid, bigint, bytea[])', 'auth_totp_accept(uuid, bigint)',
        'auth_totp_use_recovery(uuid, bytea)', 'auth_totp_disable(uuid)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO epure_app', f);
    END LOOP;
END $$;
