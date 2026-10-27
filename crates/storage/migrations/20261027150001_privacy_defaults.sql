-- EU privacy defaults: identifier storage is opt-in, and OAuth grants do not keep client IPs.

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS store_end_user_identifiers BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN projects.store_end_user_identifiers IS
    'When false (default), ingest drops end-user email, username, and precise geo. IP addresses are never stored. Opaque user ids are kept; email-shaped ids are pseudonymized.';

CREATE OR REPLACE FUNCTION ingest_store_end_user_identifiers(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT p.store_end_user_identifiers FROM projects p WHERE p.id = p_project_id),
        false
    );
$$;

REVOKE ALL ON FUNCTION ingest_store_end_user_identifiers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ingest_store_end_user_identifiers(uuid) TO epure_app;
GRANT EXECUTE ON FUNCTION ingest_store_end_user_identifiers(uuid) TO epure_ingest;

UPDATE oauth_authorizations
SET ip_address = NULL
WHERE ip_address IS NOT NULL;

CREATE OR REPLACE FUNCTION auth_export_account(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'user', jsonb_build_object(
            'id', u.id,
            'email', u.email::text,
            'display_name', u.display_name,
            'created_at', u.created_at,
            'has_password', u.password_hash IS NOT NULL,
            'google_linked', u.google_sub IS NOT NULL,
            'github_linked', u.github_id IS NOT NULL
        ),
        'memberships', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'org_id', om.org_id,
                    'org_name', o.name,
                    'role', om.role,
                    'joined_at', om.created_at
                )
                ORDER BY o.name
            )
            FROM org_members om
            INNER JOIN organizations o ON o.id = om.org_id
            WHERE om.user_id = u.id
        ), '[]'::jsonb),
        'excluded', jsonb_build_array(
            'password_hash',
            'session_secrets',
            'oauth_token_hashes',
            'dsn_secrets'
        )
    )
    FROM users u
    WHERE u.id = p_user_id;
$$;

REVOKE ALL ON FUNCTION auth_export_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_export_account(uuid) TO epure_app;
