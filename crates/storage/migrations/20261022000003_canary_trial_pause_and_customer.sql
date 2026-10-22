-- Migration: Canary trial pausing on expiry and DSN ingest enforcement

CREATE OR REPLACE FUNCTION ingest_lookup_dsn(p_public_key text)
RETURNS TABLE (
    project_id uuid,
    org_id uuid,
    secret_key bytea,
    revoked_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        d.project_id,
        p.org_id,
        d.secret_key,
        CASE
            WHEN d.revoked_at IS NOT NULL THEN d.revoked_at
            WHEN o.canary_expires_at IS NOT NULL AND o.canary_expires_at < now() THEN o.canary_expires_at
            WHEN o.subscription_status = 'paused' THEN now()
            ELSE NULL
        END AS revoked_at
    FROM dsn_keys d
    INNER JOIN projects p ON p.id = d.project_id
    INNER JOIN organizations o ON o.id = p.org_id
    WHERE d.public_key = p_public_key
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION ingest_lookup_dsn(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ingest_lookup_dsn(text) TO epure_ingest;
GRANT EXECUTE ON FUNCTION ingest_lookup_dsn(text) TO epure_app;
