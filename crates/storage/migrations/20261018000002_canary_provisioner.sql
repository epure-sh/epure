-- Canary Workspace Provisioner & Claiming Functions

CREATE OR REPLACE FUNCTION canary_provision_workspace(
    p_domain text,
    p_app_name text,
    p_page_path text,
    p_seed_error text,
    p_public_key text,
    p_secret_key bytea
)
RETURNS TABLE (
    r_org_id uuid,
    r_project_id uuid,
    r_dsn_project_id bigint,
    r_user_id uuid,
    r_public_key text,
    r_is_new boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_org_id uuid;
    v_user_id uuid;
    v_project_id uuid;
    v_dsn_proj_id bigint;
    v_pub_key text;
    v_now timestamptz := now();
    v_issue_id uuid;
    v_fingerprint text;
    v_slug_suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    v_domain_slug text;
BEGIN
    -- Check if domain already provisioned
    SELECT cm.org_id INTO v_org_id
    FROM canary_meta cm
    WHERE cm.domain = p_domain;

    IF v_org_id IS NOT NULL THEN
        SELECT p.id, p.dsn_project_id INTO v_project_id, v_dsn_proj_id
        FROM projects p
        WHERE p.org_id = v_org_id
        ORDER BY p.created_at ASC
        LIMIT 1;

        SELECT om.user_id INTO v_user_id
        FROM org_members om
        WHERE om.org_id = v_org_id
        ORDER BY om.created_at ASC
        LIMIT 1;

        SELECT dk.public_key INTO v_pub_key
        FROM dsn_keys dk
        WHERE dk.project_id = v_project_id AND dk.revoked_at IS NULL
        LIMIT 1;

        RETURN QUERY SELECT v_org_id, v_project_id, v_dsn_proj_id, v_user_id, COALESCE(v_pub_key, p_public_key), false;
        RETURN;
    END IF;

    -- New canary provisioning
    v_org_id := gen_random_uuid();
    v_user_id := gen_random_uuid();
    v_project_id := gen_random_uuid();
    v_domain_slug := lower(regexp_replace(p_domain, '[^a-zA-Z0-9]', '-', 'g'));

    -- 1. Create canary org with 14-day expiry
    INSERT INTO organizations (id, name, slug, plan_tier, canary_expires_at)
    VALUES (v_org_id, p_app_name, v_domain_slug || '-' || v_slug_suffix, 'canary_sandbox', v_now + interval '14 days');

    -- 2. Create guest user & membership
    INSERT INTO users (id, email, credential_generation)
    VALUES (v_user_id, 'guest+' || v_domain_slug || '-' || v_slug_suffix || '@epure.sh', 1);

    INSERT INTO org_members (org_id, user_id, role)
    VALUES (v_org_id, v_user_id, 'owner');

    -- 3. Record canary metadata
    INSERT INTO canary_meta (org_id, domain, app_name, page_path, seed_error)
    VALUES (v_org_id, p_domain, p_app_name, p_page_path, p_seed_error);

    -- 4. Create project
    INSERT INTO projects (id, org_id, name, slug, retention_days, ingest_cap_per_hour, is_demo)
    VALUES (v_project_id, v_org_id, p_app_name, 'production', 14, 5000, false)
    RETURNING dsn_project_id INTO v_dsn_proj_id;

    -- 5. Create DSN key
    INSERT INTO dsn_keys (id, project_id, public_key, secret_key, label)
    VALUES (gen_random_uuid(), v_project_id, p_public_key, p_secret_key, 'Canary Ingest Key');

    -- 6. Ensure event partition exists for current month
    PERFORM ensure_event_partition(
        EXTRACT(YEAR FROM v_now)::int,
        EXTRACT(MONTH FROM v_now)::int
    );

    -- 7. Seed initial issue & event from seed_error
    v_issue_id := gen_random_uuid();
    v_fingerprint := 'canary-' || md5(p_seed_error || p_page_path);

    INSERT INTO issues (
        id, org_id, project_id, fingerprint, title, status, level,
        first_seen_at, last_seen_at, event_count, unique_user_count,
        environment, release
    ) VALUES (
        v_issue_id, v_org_id, v_project_id, v_fingerprint,
        p_seed_error, 'unresolved', 'error',
        v_now - interval '10 minutes', v_now, 1, 1,
        'production', 'web@latest'
    );

    INSERT INTO events (
        id, org_id, project_id, issue_id, occurred_at, environment, release,
        platform, runtime_name, runtime_version, browser_name, os_name,
        user_id, user_email, payload_json, stack_frames, breadcrumbs
    ) VALUES (
        gen_random_uuid(), v_org_id, v_project_id, v_issue_id, v_now,
        'production', 'web@latest', 'javascript', 'browser', 'Chrome 125',
        'Chrome', 'macOS', 'usr_canary_pilot', 'user@' || p_domain,
        jsonb_build_object(
            'message', p_seed_error,
            'page', p_page_path,
            'domain', p_domain,
            'canary', true
        ),
        jsonb_build_array(
            jsonb_build_object(
                'filename', 'src/app' || p_page_path || '/page.tsx',
                'function', 'handleAction',
                'lineno', 42,
                'colno', 15,
                'in_app', true
            )
        ),
        jsonb_build_array(
            jsonb_build_object('category', 'navigation', 'message', 'Navigated to ' || p_page_path, 'timestamp', v_now - interval '30 seconds'),
            jsonb_build_object('category', 'ui.click', 'message', 'button[type="submit"]', 'timestamp', v_now - interval '5 seconds')
        )
    );

    RETURN QUERY SELECT v_org_id, v_project_id, v_dsn_proj_id, v_user_id, p_public_key, true;
END;
$fn$;

CREATE OR REPLACE FUNCTION canary_claim_workspace(
    p_org_id uuid,
    p_user_id uuid,
    p_claimed_email text,
    p_plan_tier text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
    UPDATE organizations
    SET plan_tier = p_plan_tier,
        canary_expires_at = NULL
    WHERE id = p_org_id;

    UPDATE users
    SET email = p_claimed_email
    WHERE id = p_user_id;

    UPDATE canary_meta
    SET claimed_at = now()
    WHERE org_id = p_org_id;
END;
$fn$;

REVOKE ALL ON FUNCTION canary_provision_workspace(text, text, text, text, text, bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION canary_provision_workspace(text, text, text, text, text, bytea) TO epure_app;

REVOKE ALL ON FUNCTION canary_claim_workspace(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION canary_claim_workspace(uuid, uuid, text, text) TO epure_app;
