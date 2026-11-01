-- Mature Acme demo pack for register bootstrap + reusable helpers.
-- Expands auth_bootstrap_workspace: issues across lifecycle, releases, cron monitors,
-- alert channels/rules/history, webhooks, noise policy. Register stays volume-light.

CREATE OR REPLACE FUNCTION demo_seed_issue(
    p_org_id uuid,
    p_project_id uuid,
    p_fingerprint text,
    p_title text,
    p_status text,
    p_level text,
    p_environment text,
    p_release text,
    p_event_count bigint,
    p_unique_users int,
    p_first_seen timestamptz,
    p_last_seen timestamptz,
    p_platform text,
    p_unhandled boolean,
    p_priority text,
    p_priority_score int,
    p_culprit text,
    p_payload jsonb,
    p_frames jsonb,
    p_crumbs jsonb,
    p_snooze_until timestamptz DEFAULT NULL,
    p_snooze_until_count int DEFAULT NULL,
    p_pre_snooze_status text DEFAULT NULL,
    p_resolved_in_release text DEFAULT NULL,
    p_user_id text DEFAULT 'usr_demo',
    p_user_email text DEFAULT 'demo@acme-corp.com',
    p_runtime_name text DEFAULT NULL,
    p_runtime_version text DEFAULT NULL,
    p_browser_name text DEFAULT NULL,
    p_os_name text DEFAULT 'macOS'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $issue$
DECLARE
    v_issue_id uuid := gen_random_uuid();
    v_event_id uuid := gen_random_uuid();
    v_num bigint;
BEGIN
    PERFORM ensure_event_partition(
        EXTRACT(YEAR FROM p_last_seen)::int,
        EXTRACT(MONTH FROM p_last_seen)::int
    );

    v_num := next_issue_number(p_project_id);
    INSERT INTO issues (
        id, org_id, project_id, fingerprint, title, status, level,
        first_seen_at, last_seen_at, event_count, unique_user_count,
        environment, release, platform, is_unhandled, culprit,
        priority, priority_score, issue_number, first_release, last_release,
        resolved_in_release, resolved_at, snooze_until, snooze_until_count,
        pre_snooze_status, environments, latest_event_id, regressed_count
    ) VALUES (
        v_issue_id, p_org_id, p_project_id, p_fingerprint, p_title, p_status, p_level,
        p_first_seen, p_last_seen, p_event_count, p_unique_users,
        p_environment, p_release, p_platform, p_unhandled, p_culprit,
        p_priority, p_priority_score, v_num, p_release, p_release,
        p_resolved_in_release,
        CASE WHEN p_status = 'resolved' THEN p_last_seen ELSE NULL END,
        p_snooze_until, p_snooze_until_count, p_pre_snooze_status,
        jsonb_build_array(p_environment), v_event_id,
        CASE WHEN p_status = 'regression' THEN 1 ELSE 0 END
    );

    INSERT INTO events (
        id, org_id, project_id, issue_id, occurred_at, environment, release,
        platform, runtime_name, runtime_version, browser_name, os_name,
        user_id, user_email, payload_json, stack_frames, breadcrumbs
    ) VALUES (
        v_event_id, p_org_id, p_project_id, v_issue_id, p_last_seen,
        p_environment, p_release, p_platform,
        COALESCE(p_runtime_name, CASE WHEN p_platform = 'javascript' THEN 'browser' WHEN p_platform = 'python' THEN 'CPython' WHEN p_platform = 'go' THEN 'go' ELSE 'node' END),
        COALESCE(p_runtime_version, CASE WHEN p_platform = 'javascript' THEN '128.0' WHEN p_platform = 'python' THEN '3.12.1' WHEN p_platform = 'go' THEN 'go1.22.0' ELSE '20.11.0' END),
        p_browser_name, p_os_name, p_user_id, p_user_email,
        p_payload, p_frames, p_crumbs
    );

    INSERT INTO issue_counters (project_id, fingerprint, window_start, count, bodies_stored)
    VALUES
        (p_project_id, p_fingerprint, date_trunc('hour', p_last_seen), GREATEST(p_event_count / 3, 1), 1),
        (p_project_id, p_fingerprint, date_trunc('hour', p_last_seen) - interval '1 hour', GREATEST(p_event_count / 4, 1), 1),
        (p_project_id, p_fingerprint, date_trunc('hour', p_last_seen) - interval '2 hours', GREATEST(p_event_count / 5, 1), 1)
    ON CONFLICT (project_id, fingerprint, window_start) DO UPDATE
    SET count = EXCLUDED.count, bodies_stored = EXCLUDED.bodies_stored;

    RETURN v_issue_id;
END;
$issue$;

REVOKE ALL ON FUNCTION demo_seed_issue(
    uuid, uuid, text, text, text, text, text, text, bigint, int, timestamptz, timestamptz,
    text, boolean, text, int, text, jsonb, jsonb, jsonb, timestamptz, int, text, text,
    text, text, text, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION demo_seed_issue(
    uuid, uuid, text, text, text, text, text, text, bigint, int, timestamptz, timestamptz,
    text, boolean, text, int, text, jsonb, jsonb, jsonb, timestamptz, int, text, text,
    text, text, text, text, text, text
) TO epure_app;
DROP FUNCTION IF EXISTS auth_bootstrap_workspace(uuid, uuid, text);
DROP FUNCTION IF EXISTS auth_bootstrap_workspace(uuid, uuid, text, text, text);

CREATE OR REPLACE FUNCTION auth_bootstrap_workspace(
    p_user_id uuid,
    p_org_id uuid,
    p_org_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_web_id uuid := gen_random_uuid();
    v_api_id uuid := gen_random_uuid();
    v_slug_suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    v_now timestamptz := now();
    v_parent_id uuid;
    v_child_id uuid;
    v_ch_slack uuid := gen_random_uuid();
    v_ch_discord uuid := gen_random_uuid();
    v_ch_hook uuid := gen_random_uuid();
BEGIN
    INSERT INTO organizations (id, name) VALUES (p_org_id, p_org_name);

    INSERT INTO projects (id, org_id, name, slug, retention_days, ingest_cap_per_hour, is_demo)
    VALUES
        (v_web_id, p_org_id, 'Acme Web', 'acme-web-' || v_slug_suffix, 30, 5000, true),
        (v_api_id, p_org_id, 'Acme API', 'acme-api-' || v_slug_suffix, 30, 5000, true);

    INSERT INTO org_members (org_id, user_id, role)
    VALUES (p_org_id, p_user_id, 'owner');

    INSERT INTO dsn_keys (project_id, public_key, secret_key, label)
    VALUES
        (v_web_id, substr(replace(gen_random_uuid()::text, '-', ''), 1, 20),
         convert_to('demo-preview-key-not-for-prod', 'UTF8'), 'Demo browser'),
        (v_api_id, substr(replace(gen_random_uuid()::text, '-', ''), 1, 20),
         convert_to('demo-preview-key-not-for-prod', 'UTF8'), 'Demo API');

    PERFORM ensure_event_partition(
        EXTRACT(YEAR FROM v_now)::int,
        EXTRACT(MONTH FROM v_now)::int
    );
    PERFORM ensure_event_partition(
        EXTRACT(YEAR FROM (v_now - interval '1 month'))::int,
        EXTRACT(MONTH FROM (v_now - interval '1 month'))::int
    );

    PERFORM demo_seed_issue(
        p_org_id, v_web_id, 'demo-web-checkout-typeerror',
        'TypeError: Cannot read properties of undefined (reading ''price'')', 'unresolved', 'error', 'production', 'web@2.14.0',
        128, 42,
        v_now - interval '72 hours', v_now - interval '1 hours',
        'javascript', true, 'critical', 92, 'CheckoutForm.tsx',
        jsonb_build_object(
            'platform', 'javascript',
            'level', 'error',
            'environment', 'production',
            'release', 'web@2.14.0',
            'exception', jsonb_build_object('values', jsonb_build_array(jsonb_build_object(
                'type', 'TypeError',
                'value', 'Cannot read properties of undefined (reading ''price'')'
            ))),
            'tags', jsonb_build_object('seed', 'bootstrap', 'fingerprint', 'demo-web-checkout-typeerror')
        ),
        '[{"filename":"webpack:///./src/app/Example.tsx","function":"run","lineno":42,"colno":11,"in_app":true,"context_line":"  throw err;"},{"filename":"webpack:///./src/main.tsx","function":"boot","lineno":12,"colno":3,"in_app":true}]'::jsonb,
        '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb,
        NULL, NULL, NULL, NULL,
        'usr_checkout', 'alice@acme-corp.com',
        NULL, NULL, 'Chrome', 'macOS'
    );

    PERFORM demo_seed_issue(
        p_org_id, v_web_id, 'demo-web-payment-failed',
        'Error: Payment failed: card declined (500)', 'unresolved', 'error', 'production', 'web@2.14.0',
        47, 18,
        v_now - interval '120 hours', v_now - interval '3 hours',
        'javascript', false, 'high', 64, 'PaymentForm.tsx',
        jsonb_build_object(
            'platform', 'javascript',
            'level', 'error',
            'environment', 'production',
            'release', 'web@2.14.0',
            'exception', jsonb_build_object('values', jsonb_build_array(jsonb_build_object(
                'type', 'Error',
                'value', 'Payment failed: card declined (500)'
            ))),
            'tags', jsonb_build_object('seed', 'bootstrap', 'fingerprint', 'demo-web-payment-failed')
        ),
        '[{"filename":"webpack:///./src/app/Example.tsx","function":"run","lineno":42,"colno":11,"in_app":true,"context_line":"  throw err;"},{"filename":"webpack:///./src/main.tsx","function":"boot","lineno":12,"colno":3,"in_app":true}]'::jsonb,
        '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb,
        NULL, NULL, NULL, NULL,
        'usr_payment', 'bob@acme-corp.com',
        NULL, NULL, 'Chrome', 'macOS'
    );

    PERFORM demo_seed_issue(
        p_org_id, v_web_id, 'demo-web-hydration',
        'Error: Hydration failed: text content did not match server HTML', 'unresolved', 'error', 'production', 'web@2.13.2',
        22, 9,
        v_now - interval '48 hours', v_now - interval '6 hours',
        'javascript', false, 'medium', 40, 'StatCard.tsx',
        jsonb_build_object(
            'platform', 'javascript',
            'level', 'error',
            'environment', 'production',
            'release', 'web@2.13.2',
            'exception', jsonb_build_object('values', jsonb_build_array(jsonb_build_object(
                'type', 'Error',
                'value', 'Hydration failed: text content did not match server HTML'
            ))),
            'tags', jsonb_build_object('seed', 'bootstrap', 'fingerprint', 'demo-web-hydration')
        ),
        '[{"filename":"webpack:///./src/app/Example.tsx","function":"run","lineno":42,"colno":11,"in_app":true,"context_line":"  throw err;"},{"filename":"webpack:///./src/main.tsx","function":"boot","lineno":12,"colno":3,"in_app":true}]'::jsonb,
        '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb,
        NULL, NULL, NULL, NULL,
        'usr_hydration', 'carol@acme-corp.com',
        NULL, NULL, 'Chrome', 'macOS'
    );

    PERFORM demo_seed_issue(
        p_org_id, v_web_id, 'demo-web-auth-token',
        'Error: Session refresh failed: token expired', 'regression', 'error', 'production', 'web@2.14.0',
        64, 21,
        v_now - interval '240 hours', v_now - interval '0.5 hours',
        'javascript', false, 'critical', 88, 'useAuth.ts',
        jsonb_build_object(
            'platform', 'javascript',
            'level', 'error',
            'environment', 'production',
            'release', 'web@2.14.0',
            'exception', jsonb_build_object('values', jsonb_build_array(jsonb_build_object(
                'type', 'Error',
                'value', 'Session refresh failed: token expired'
            ))),
            'tags', jsonb_build_object('seed', 'bootstrap', 'fingerprint', 'demo-web-auth-token')
        ),
        '[{"filename":"webpack:///./src/app/Example.tsx","function":"run","lineno":42,"colno":11,"in_app":true,"context_line":"  throw err;"},{"filename":"webpack:///./src/main.tsx","function":"boot","lineno":12,"colno":3,"in_app":true}]'::jsonb,
        '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb,
        NULL, NULL, NULL, 'web@2.13.0',
        'usr_auth', 'dave@acme-corp.com',
        NULL, NULL, 'Chrome', 'macOS'
    );

    PERFORM demo_seed_issue(
        p_org_id, v_web_id, 'demo-web-rate-limit',
        'Error: Too many requests: rate limit exceeded', 'unresolved', 'warning', 'production', 'web@2.14.0',
        310, 55,
        v_now - interval '96 hours', v_now - interval '2 hours',
        'javascript', false, 'high', 58, 'apiClient.ts',
        jsonb_build_object(
            'platform', 'javascript',
            'level', 'warning',
            'environment', 'production',
            'release', 'web@2.14.0',
            'exception', jsonb_build_object('values', jsonb_build_array(jsonb_build_object(
                'type', 'Error',
                'value', 'Too many requests: rate limit exceeded'
            ))),
            'tags', jsonb_build_object('seed', 'bootstrap', 'fingerprint', 'demo-web-rate-limit')
        ),
        '[{"filename":"webpack:///./src/app/Example.tsx","function":"run","lineno":42,"colno":11,"in_app":true,"context_line":"  throw err;"},{"filename":"webpack:///./src/main.tsx","function":"boot","lineno":12,"colno":3,"in_app":true}]'::jsonb,
        '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb,
        v_now + interval '24 hours', NULL, NULL, NULL,
        'usr_ratelimit', 'erin@acme-corp.com',
        NULL, NULL, 'Chrome', 'macOS'
    );

    PERFORM demo_seed_issue(
        p_org_id, v_web_id, 'demo-web-null-map',
        'TypeError: Cannot read properties of undefined (reading ''map'')', 'unresolved', 'error', 'production', 'web@2.14.0',
        890, 120,
        v_now - interval '36 hours', v_now - interval '0.2 hours',
        'javascript', true, 'critical', 95, 'OrderList.tsx',
        jsonb_build_object(
            'platform', 'javascript',
            'level', 'error',
            'environment', 'production',
            'release', 'web@2.14.0',
            'exception', jsonb_build_object('values', jsonb_build_array(jsonb_build_object(
                'type', 'TypeError',
                'value', 'Cannot read properties of undefined (reading ''map'')'
            ))),
            'tags', jsonb_build_object('seed', 'bootstrap', 'fingerprint', 'demo-web-null-map')
        ),
        '[{"filename":"webpack:///./src/app/Example.tsx","function":"run","lineno":42,"colno":11,"in_app":true,"context_line":"  throw err;"},{"filename":"webpack:///./src/main.tsx","function":"boot","lineno":12,"colno":3,"in_app":true}]'::jsonb,
        '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb,
        NULL, NULL, NULL, NULL,
        'usr_map', 'frank@acme-corp.com',
        NULL, NULL, 'Chrome', 'macOS'
    );

    PERFORM demo_seed_issue(
        p_org_id, v_web_id, 'demo-web-cors',
        'TypeError: Failed to fetch (CORS blocked)', 'unresolved', 'error', 'staging', 'web@2.14.0',
        33, 7,
        v_now - interval '60 hours', v_now - interval '8 hours',
        'javascript', false, 'medium', 35, 'fetchJson.ts',
        jsonb_build_object(
            'platform', 'javascript',
            'level', 'error',
            'environment', 'staging',
            'release', 'web@2.14.0',
            'exception', jsonb_build_object('values', jsonb_build_array(jsonb_build_object(
                'type', 'TypeError',
                'value', 'Failed to fetch'
            ))),
            'tags', jsonb_build_object('seed', 'bootstrap', 'fingerprint', 'demo-web-cors')
        ),
        '[{"filename":"webpack:///./src/app/Example.tsx","function":"run","lineno":42,"colno":11,"in_app":true,"context_line":"  throw err;"},{"filename":"webpack:///./src/main.tsx","function":"boot","lineno":12,"colno":3,"in_app":true}]'::jsonb,
        '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb,
        NULL, NULL, NULL, NULL,
        'usr_cors', 'grace@acme-corp.com',
        NULL, NULL, 'Chrome', 'macOS'
    );

    PERFORM demo_seed_issue(
        p_org_id, v_web_id, 'demo-web-chunk-load',
        'ChunkLoadError: Loading chunk 14 failed', 'unresolved', 'error', 'production', 'web@2.14.0',
        71, 40,
        v_now - interval '24 hours', v_now - interval '4 hours',
        'javascript', false, 'high', 55, 'lazyImport.ts',
        jsonb_build_object(
            'platform', 'javascript',
            'level', 'error',
            'environment', 'production',
            'release', 'web@2.14.0',
            'exception', jsonb_build_object('values', jsonb_build_array(jsonb_build_object(
                'type', 'ChunkLoadError',
                'value', 'Loading chunk 14 failed'
            ))),
            'tags', jsonb_build_object('seed', 'bootstrap', 'fingerprint', 'demo-web-chunk-load')
        ),
        '[{"filename":"webpack:///./src/app/Example.tsx","function":"run","lineno":42,"colno":11,"in_app":true,"context_line":"  throw err;"},{"filename":"webpack:///./src/main.tsx","function":"boot","lineno":12,"colno":3,"in_app":true}]'::jsonb,
        '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb,
        NULL, NULL, NULL, NULL,
        'usr_chunk', 'hank@acme-corp.com',
        NULL, NULL, 'Chrome', 'macOS'
    );

    PERFORM demo_seed_issue(
        p_org_id, v_web_id, 'demo-web-resize-observer',
        'Error: ResizeObserver loop completed with undelivered notifications', 'ignored', 'warning', 'production', 'web@2.13.2',
        420, 80,
        v_now - interval '200 hours', v_now - interval '12 hours',
        'javascript', false, 'low', 12, 'Chart.tsx',
        jsonb_build_object(
            'platform', 'javascript',
            'level', 'warning',
            'environment', 'production',
            'release', 'web@2.13.2',
            'exception', jsonb_build_object('values', jsonb_build_array(jsonb_build_object(
                'type', 'Error',
                'value', 'ResizeObserver loop completed with undelivered notifications'
            ))),
            'tags', jsonb_build_object('seed', 'bootstrap', 'fingerprint', 'demo-web-resize-observer')
        ),
        '[{"filename":"webpack:///./src/app/Example.tsx","function":"run","lineno":42,"colno":11,"in_app":true,"context_line":"  throw err;"},{"filename":"webpack:///./src/main.tsx","function":"boot","lineno":12,"colno":3,"in_app":true}]'::jsonb,
        '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb,
        NULL, NULL, NULL, NULL,
        'usr_resize', 'iris@acme-corp.com',
        NULL, NULL, 'Chrome', 'macOS'
    );

    PERFORM demo_seed_issue(
        p_org_id, v_web_id, 'demo-web-local-dev',
        'ReferenceError: process is not defined', 'unresolved', 'error', 'local', 'web@2.15.0-dev',
        8, 1,
        v_now - interval '12 hours', v_now - interval '1 hours',
        'javascript', true, 'low', 18, 'env.ts',
        jsonb_build_object(
            'platform', 'javascript',
            'level', 'error',
            'environment', 'local',
            'release', 'web@2.15.0-dev',
            'exception', jsonb_build_object('values', jsonb_build_array(jsonb_build_object(
                'type', 'ReferenceError',
                'value', 'process is not defined'
            ))),
            'tags', jsonb_build_object('seed', 'bootstrap', 'fingerprint', 'demo-web-local-dev')
        ),
        '[{"filename":"webpack:///./src/app/Example.tsx","function":"run","lineno":42,"colno":11,"in_app":true,"context_line":"  throw err;"},{"filename":"webpack:///./src/main.tsx","function":"boot","lineno":12,"colno":3,"in_app":true}]'::jsonb,
        '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb,
        NULL, NULL, NULL, NULL,
        'usr_local', 'dev@acme-corp.com',
        NULL, NULL, 'Chrome', 'macOS'
    );

    PERFORM demo_seed_issue(
        p_org_id, v_web_id, 'demo-web-resolved-cart',
        'TypeError: cart.items is not iterable', 'resolved', 'error', 'production', 'web@2.13.0',
        55, 14,
        v_now - interval '300 hours', v_now - interval '200 hours',
        'javascript', false, 'medium', 30, 'useCart.ts',
        jsonb_build_object(
            'platform', 'javascript',
            'level', 'error',
            'environment', 'production',
            'release', 'web@2.13.0',
            'exception', jsonb_build_object('values', jsonb_build_array(jsonb_build_object(
                'type', 'TypeError',
                'value', 'cart.items is not iterable'
            ))),
            'tags', jsonb_build_object('seed', 'bootstrap', 'fingerprint', 'demo-web-resolved-cart')
        ),
        '[{"filename":"webpack:///./src/app/Example.tsx","function":"run","lineno":42,"colno":11,"in_app":true,"context_line":"  throw err;"},{"filename":"webpack:///./src/main.tsx","function":"boot","lineno":12,"colno":3,"in_app":true}]'::jsonb,
        '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb,
        NULL, NULL, NULL, 'web@2.13.2',
        'usr_cart', 'julia@acme-corp.com',
        NULL, NULL, 'Chrome', 'macOS'
    );

    PERFORM demo_seed_issue(
        p_org_id, v_web_id, 'demo-web-info-analytics',
        'Error: analytics beacon timed out', 'ignored', 'info', 'production', 'web@2.14.0',
        1200, 400,
        v_now - interval '180 hours', v_now - interval '10 hours',
        'javascript', false, 'low', 8, 'analytics.ts',
        jsonb_build_object(
            'platform', 'javascript',
            'level', 'info',
            'environment', 'production',
            'release', 'web@2.14.0',
            'exception', jsonb_build_object('values', jsonb_build_array(jsonb_build_object(
                'type', 'Error',
                'value', 'analytics beacon timed out'
            ))),
            'tags', jsonb_build_object('seed', 'bootstrap', 'fingerprint', 'demo-web-info-analytics')
        ),
        '[{"filename":"webpack:///./src/app/Example.tsx","function":"run","lineno":42,"colno":11,"in_app":true,"context_line":"  throw err;"},{"filename":"webpack:///./src/main.tsx","function":"boot","lineno":12,"colno":3,"in_app":true}]'::jsonb,
        '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb,
        NULL, NULL, NULL, NULL,
        'usr_analytics', 'kate@acme-corp.com',
        NULL, NULL, 'Chrome', 'macOS'
    );

    PERFORM demo_seed_issue(
        p_org_id, v_web_id, 'demo-web-stripe-timeout',
        'GatewayTimeout: Upstream stripe webhook acknowledgement exceeded 5000ms', 'regression', 'error', 'production', 'web@2.14.0',
        96, 31,
        v_now - interval '168 hours', v_now - interval '0.3 hours',
        'javascript', false, 'high', 72, 'webhooks/stripe.ts',
        jsonb_build_object(
            'platform', 'javascript',
            'level', 'error',
            'environment', 'production',
            'release', 'web@2.14.0',
            'exception', jsonb_build_object('values', jsonb_build_array(jsonb_build_object(
                'type', 'GatewayTimeout',
                'value', 'Upstream stripe webhook acknowledgement exceeded 5000ms'
            ))),
            'tags', jsonb_build_object('seed', 'bootstrap', 'fingerprint', 'demo-web-stripe-timeout')
        ),
        '[{"filename":"webpack:///./src/app/Example.tsx","function":"run","lineno":42,"colno":11,"in_app":true,"context_line":"  throw err;"},{"filename":"webpack:///./src/main.tsx","function":"boot","lineno":12,"colno":3,"in_app":true}]'::jsonb,
        '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb,
        NULL, NULL, NULL, 'web@2.12.0',
        'usr_stripe', 'leo@acme-corp.com',
        NULL, NULL, 'Chrome', 'macOS'
    );

    PERFORM demo_seed_issue(
        p_org_id, v_web_id, 'demo-web-snooze-jwt',
        'JsonWebTokenError: invalid signature on bearer verification', 'unresolved', 'warning', 'production', 'web@2.14.0',
        73, 12,
        v_now - interval '140 hours', v_now - interval '20 hours',
        'javascript', false, 'medium', 28, 'auth/jwt.ts',
        jsonb_build_object(
            'platform', 'javascript',
            'level', 'warning',
            'environment', 'production',
            'release', 'web@2.14.0',
            'exception', jsonb_build_object('values', jsonb_build_array(jsonb_build_object(
                'type', 'JsonWebTokenError',
                'value', 'invalid signature on bearer verification'
            ))),
            'tags', jsonb_build_object('seed', 'bootstrap', 'fingerprint', 'demo-web-snooze-jwt')
        ),
        '[{"filename":"webpack:///./src/app/Example.tsx","function":"run","lineno":42,"colno":11,"in_app":true,"context_line":"  throw err;"},{"filename":"webpack:///./src/main.tsx","function":"boot","lineno":12,"colno":3,"in_app":true}]'::jsonb,
        '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb,
        v_now + interval '24 hours', 100, 'unresolved', NULL,
        'usr_jwt', 'demo+jwt@acme-corp.com',
        NULL, NULL, 'Chrome', 'macOS'
    );

    v_parent_id := demo_seed_issue(
        p_org_id, v_web_id, 'demo-web-merge-parent',
        'Error: Inventory sync conflict for SKU-4412', 'unresolved', 'error', 'production', 'web@2.14.0',
        40, 6,
        v_now - interval '80 hours', v_now - interval '5 hours',
        'javascript', false, 'medium', 38, 'inventory.ts',
        jsonb_build_object('platform','javascript','level','error','environment','production','release','web@2.14.0','exception',jsonb_build_object('values',jsonb_build_array(jsonb_build_object('type','Error','value','Inventory sync conflict for SKU-4412'))),'tags',jsonb_build_object('seed','bootstrap')),
        '[{"filename":"webpack:///./src/app/Example.tsx","function":"run","lineno":42,"colno":11,"in_app":true,"context_line":"  throw err;"},{"filename":"webpack:///./src/main.tsx","function":"boot","lineno":12,"colno":3,"in_app":true}]'::jsonb, '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb
    );

    v_child_id := demo_seed_issue(
        p_org_id, v_web_id, 'demo-web-merge-child',
        'Error: Inventory sync conflict (duplicate fingerprint variant)', 'unresolved', 'error', 'production', 'web@2.14.0',
        12, 3,
        v_now - interval '70 hours', v_now - interval '15 hours',
        'javascript', false, 'low', 20, 'inventory.ts',
        jsonb_build_object('platform','javascript','level','error','environment','production','release','web@2.14.0','exception',jsonb_build_object('values',jsonb_build_array(jsonb_build_object('type','Error','value','Inventory sync conflict (duplicate fingerprint variant)'))),'tags',jsonb_build_object('seed','bootstrap')),
        '[{"filename":"webpack:///./src/app/Example.tsx","function":"run","lineno":42,"colno":11,"in_app":true,"context_line":"  throw err;"},{"filename":"webpack:///./src/main.tsx","function":"boot","lineno":12,"colno":3,"in_app":true}]'::jsonb, '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb
    );
    UPDATE issues SET merge_parent_id = v_parent_id WHERE id = v_child_id;

    PERFORM demo_seed_issue(
        p_org_id, v_web_id, 'demo-web-fatal-oom',
        'RangeError: Maximum call stack size exceeded', 'unresolved', 'fatal', 'production', 'web@2.14.0',
        9, 4,
        v_now - interval '40 hours', v_now - interval '7 hours',
        'javascript', true, 'critical', 90, 'recursiveRender.tsx',
        jsonb_build_object(
            'platform', 'javascript',
            'level', 'fatal',
            'environment', 'production',
            'release', 'web@2.14.0',
            'exception', jsonb_build_object('values', jsonb_build_array(jsonb_build_object(
                'type', 'RangeError',
                'value', 'Maximum call stack size exceeded'
            ))),
            'tags', jsonb_build_object('seed', 'bootstrap', 'fingerprint', 'demo-web-fatal-oom')
        ),
        '[{"filename":"webpack:///./src/app/Example.tsx","function":"run","lineno":42,"colno":11,"in_app":true,"context_line":"  throw err;"},{"filename":"webpack:///./src/main.tsx","function":"boot","lineno":12,"colno":3,"in_app":true}]'::jsonb,
        '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb,
        NULL, NULL, NULL, NULL,
        'usr_oom', 'mia@acme-corp.com',
        NULL, NULL, 'Chrome', 'macOS'
    );

    PERFORM demo_seed_issue(
        p_org_id, v_web_id, 'demo-web-staging-ab',
        'Error: Feature flag evaluation failed for experiment checkout_v3', 'unresolved', 'error', 'staging', 'web@2.15.0-rc.1',
        15, 2,
        v_now - interval '20 hours', v_now - interval '2 hours',
        'javascript', false, 'medium', 32, 'flags.ts',
        jsonb_build_object(
            'platform', 'javascript',
            'level', 'error',
            'environment', 'staging',
            'release', 'web@2.15.0-rc.1',
            'exception', jsonb_build_object('values', jsonb_build_array(jsonb_build_object(
                'type', 'Error',
                'value', 'Feature flag evaluation failed'
            ))),
            'tags', jsonb_build_object('seed', 'bootstrap', 'fingerprint', 'demo-web-staging-ab')
        ),
        '[{"filename":"webpack:///./src/app/Example.tsx","function":"run","lineno":42,"colno":11,"in_app":true,"context_line":"  throw err;"},{"filename":"webpack:///./src/main.tsx","function":"boot","lineno":12,"colno":3,"in_app":true}]'::jsonb,
        '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb,
        NULL, NULL, NULL, NULL,
        'usr_ab', 'nina@acme-corp.com',
        NULL, NULL, 'Chrome', 'macOS'
    );

    PERFORM demo_seed_issue(
        p_org_id, v_api_id, 'demo-api-unhandled-rejection',
        'Error: connect ECONNREFUSED 10.0.4.12:5432', 'unresolved', 'error', 'production', 'api@1.8.0',
        210, 1,
        v_now - interval '90 hours', v_now - interval '2 hours',
        'node', true, 'critical', 91, 'db/pool.ts',
        jsonb_build_object('platform','node','level','error','environment','production','release','api@1.8.0','exception',jsonb_build_object('values',jsonb_build_array(jsonb_build_object('type','Error','value','connect ECONNREFUSED 10.0.4.12:5432'))),'tags',jsonb_build_object('seed','bootstrap')),
        '[{"filename":"/app/src/server.ts","function":"handler","lineno":88,"colno":5,"in_app":true,"context_line":"  await work();"},{"filename":"/app/src/index.ts","function":"main","lineno":10,"colno":1,"in_app":true}]'::jsonb, '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb,
        NULL, NULL, NULL, NULL,
        'svc_ection', 'api+ection@acme-corp.com',
        NULL, NULL, NULL, 'Linux'
    );

    PERFORM demo_seed_issue(
        p_org_id, v_api_id, 'demo-api-db-timeout',
        'OperationalError: database connection timed out', 'unresolved', 'error', 'production', 'api@1.8.0',
        44, 1,
        v_now - interval '100 hours', v_now - interval '5 hours',
        'python', false, 'high', 60, 'tasks/inventory.py',
        jsonb_build_object('platform','python','level','error','environment','production','release','api@1.8.0','exception',jsonb_build_object('values',jsonb_build_array(jsonb_build_object('type','Error','value','database connection timed out'))),'tags',jsonb_build_object('seed','bootstrap')),
        '[{"filename":"/app/src/tasks.py","function":"run","lineno":54,"in_app":true,"context_line":"    raise"},{"filename":"/app/src/worker.py","function":"process","lineno":21,"in_app":true}]'::jsonb, '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb,
        NULL, NULL, NULL, NULL,
        'svc_imeout', 'api+imeout@acme-corp.com',
        NULL, NULL, NULL, 'Linux'
    );

    PERFORM demo_seed_issue(
        p_org_id, v_api_id, 'demo-api-nil-pointer',
        'runtime error: invalid memory address or nil pointer dereference', 'unresolved', 'fatal', 'production', 'api@1.7.4',
        11, 1,
        v_now - interval '144 hours', v_now - interval '8 hours',
        'go', true, 'critical', 93, 'handlers/invoices.go',
        jsonb_build_object('platform','go','level','fatal','environment','production','release','api@1.7.4','exception',jsonb_build_object('values',jsonb_build_array(jsonb_build_object('type','Error','value','nil pointer dereference'))),'tags',jsonb_build_object('seed','bootstrap')),
        '[{"filename":"/app/internal/handlers/h.go","function":"Serve","lineno":67,"in_app":true,"context_line":"\t_ = ptr.X"},{"filename":"/app/cmd/api/main.go","function":"main","lineno":41,"in_app":true}]'::jsonb, '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb,
        NULL, NULL, NULL, NULL,
        'svc_ointer', 'api+ointer@acme-corp.com',
        NULL, NULL, NULL, 'Linux'
    );

    PERFORM demo_seed_issue(
        p_org_id, v_api_id, 'demo-api-queue-backlog',
        'Error: Redis BRPOP timed out on queue orders', 'unresolved', 'error', 'production', 'api@1.8.0',
        88, 1,
        v_now - interval '50 hours', v_now - interval '1 hours',
        'node', false, 'high', 57, 'queues/orders.ts',
        jsonb_build_object('platform','node','level','error','environment','production','release','api@1.8.0','exception',jsonb_build_object('values',jsonb_build_array(jsonb_build_object('type','Error','value','Redis BRPOP timed out'))),'tags',jsonb_build_object('seed','bootstrap')),
        '[{"filename":"/app/src/server.ts","function":"handler","lineno":88,"colno":5,"in_app":true,"context_line":"  await work();"},{"filename":"/app/src/index.ts","function":"main","lineno":10,"colno":1,"in_app":true}]'::jsonb, '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb,
        NULL, NULL, NULL, NULL,
        'svc_acklog', 'api+acklog@acme-corp.com',
        NULL, NULL, NULL, 'Linux'
    );

    PERFORM demo_seed_issue(
        p_org_id, v_api_id, 'demo-api-resolved-authz',
        'ForbiddenError: missing scope invoices:write', 'resolved', 'warning', 'production', 'api@1.8.0',
        30, 5,
        v_now - interval '200 hours', v_now - interval '150 hours',
        'node', false, 'low', 15, 'middleware/authz.ts',
        jsonb_build_object('platform','node','level','warning','environment','production','release','api@1.8.0','exception',jsonb_build_object('values',jsonb_build_array(jsonb_build_object('type','Error','value','missing scope invoices:write'))),'tags',jsonb_build_object('seed','bootstrap')),
        '[{"filename":"/app/src/server.ts","function":"handler","lineno":88,"colno":5,"in_app":true,"context_line":"  await work();"},{"filename":"/app/src/index.ts","function":"main","lineno":10,"colno":1,"in_app":true}]'::jsonb, '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb,
        NULL, NULL, NULL, 'api@1.8.3',
        'svc_-authz', 'api+-authz@acme-corp.com',
        NULL, NULL, NULL, 'Linux'
    );

    PERFORM demo_seed_issue(
        p_org_id, v_api_id, 'demo-api-ignored-health',
        'Error: healthcheck probe failed (transient)', 'ignored', 'info', 'staging', 'api@1.8.3',
        500, 1,
        v_now - interval '300 hours', v_now - interval '24 hours',
        'node', false, 'low', 5, 'health.ts',
        jsonb_build_object('platform','node','level','info','environment','staging','release','api@1.8.3','exception',jsonb_build_object('values',jsonb_build_array(jsonb_build_object('type','Error','value','healthcheck probe failed'))),'tags',jsonb_build_object('seed','bootstrap')),
        '[{"filename":"/app/src/server.ts","function":"handler","lineno":88,"colno":5,"in_app":true,"context_line":"  await work();"},{"filename":"/app/src/index.ts","function":"main","lineno":10,"colno":1,"in_app":true}]'::jsonb, '[{"timestamp":1726214400.0,"category":"navigation","level":"info","message":"Navigated to /app"},{"timestamp":1726214401.0,"category":"console","level":"error","message":"seed error"}]'::jsonb,
        NULL, NULL, NULL, NULL,
        'svc_health', 'api+health@acme-corp.com',
        NULL, NULL, NULL, 'Linux'
    );

    -- Releases
    INSERT INTO releases (project_id, version, created_at) VALUES
        (v_web_id, 'web@2.15.0', v_now - interval '2 days'),
        (v_web_id, 'web@2.14.0', v_now - interval '9 days'),
        (v_web_id, 'web@2.13.2', v_now - interval '20 days'),
        (v_web_id, 'web@2.13.0', v_now - interval '35 days'),
        (v_web_id, 'web@2.12.0', v_now - interval '50 days'),
        (v_api_id, 'api@1.8.3', v_now - interval '5 days'),
        (v_api_id, 'api@1.8.0', v_now - interval '18 days'),
        (v_api_id, 'api@1.7.4', v_now - interval '40 days')
    ON CONFLICT (project_id, version) DO NOTHING;

    -- Cron monitors (Web)
    INSERT INTO monitors (id, project_id, org_id, slug, name, schedule, schedule_type, status, last_check_in_at, last_duration_ms, environment, timezone, checkin_margin_mins, max_runtime_mins, paused, next_check_in_at)
    VALUES
        (gen_random_uuid(), v_web_id, p_org_id, 'nightly-backup', 'Nightly Stripe Payouts', '0 2 * * *', 'crontab', 'ok', v_now - interval '90 minutes', 1240, 'production', 'UTC', 5, 30, false, v_now + interval '22 hours'),
        (gen_random_uuid(), v_web_id, p_org_id, 'billing-sync', 'Billing Sync', 'every 15 minute', 'interval', 'missed', v_now - interval '3 hours', 820, 'production', 'UTC', 5, 15, false, v_now - interval '10 minutes'),
        (gen_random_uuid(), v_web_id, p_org_id, 'stripe-reconcile', 'Stripe reconcile', '0 3 * * *', 'crontab', 'error', v_now - interval '20 hours', 0, 'production', 'UTC', 10, 60, false, v_now + interval '4 hours'),
        (gen_random_uuid(), v_web_id, p_org_id, 'session-gc', 'Session garbage collect', '*/15 * * * *', 'crontab', 'in_progress', v_now - interval '2 minutes', NULL, 'production', 'UTC', 5, 10, false, v_now + interval '13 minutes'),
        (gen_random_uuid(), v_web_id, p_org_id, 'staging-warmup', 'Staging warmup', '0 9 * * 1-5', 'crontab', 'ok', v_now - interval '1 day', 8000, 'staging', 'UTC', 5, 15, true, NULL),
        (gen_random_uuid(), v_web_id, p_org_id, 'cdn-purge-audit', 'CDN purge audit', '0 */12 * * *', 'crontab', 'timeout', v_now - interval '12 hours', 1900000, 'production', 'UTC', 5, 20, false, v_now + interval '30 minutes');

    INSERT INTO monitors (id, project_id, org_id, slug, name, schedule, schedule_type, status, last_check_in_at, last_duration_ms, environment, timezone, checkin_margin_mins, max_runtime_mins, paused, next_check_in_at)
    VALUES
        (gen_random_uuid(), v_api_id, p_org_id, 'orders-outbox-drain', 'Orders outbox drain', 'every 5 minutes', 'interval', 'ok', v_now - interval '4 minutes', 1200, 'production', 'UTC', 2, 5, false, v_now + interval '1 minutes'),
        (gen_random_uuid(), v_api_id, p_org_id, 'inventory-sync', 'Inventory sync', '0 * * * *', 'crontab', 'missed', v_now - interval '2 hours', 60000, 'production', 'UTC', 5, 30, false, v_now - interval '10 minutes');

    -- Check-ins for a couple of monitors
    INSERT INTO monitor_check_ins (monitor_id, project_id, org_id, check_in_id, status, duration_ms, environment, created_at)
    SELECT m.id, m.project_id, m.org_id, 'ci-' || g, CASE WHEN g = 1 THEN 'ok' ELSE m.status END, COALESCE(m.last_duration_ms, 1000), m.environment, v_now - (g || ' hours')::interval
    FROM monitors m
    CROSS JOIN generate_series(1, 3) g
    WHERE m.project_id IN (v_web_id, v_api_id);

    -- Alert channels
    INSERT INTO alert_channels (id, org_id, project_id, provider, label, config, is_enabled)
    VALUES
        (v_ch_slack, p_org_id, v_web_id, 'slack', 'Eng on-call', '{"webhook_url":"https://hooks.slack.com/services/T000/B000/XXXX","channel":"#eng-oncall"}'::jsonb, true),
        (v_ch_discord, p_org_id, v_web_id, 'discord', 'Product alerts', '{"webhook_url":"https://discord.com/api/webhooks/000/demo"}'::jsonb, true),
        (v_ch_hook, p_org_id, v_api_id, 'webhook', 'Pager relay', '{"url":"https://hooks.acme-corp.com/epure"}'::jsonb, true);

    -- Alert rules
    INSERT INTO alert_rules (org_id, project_id, name, enabled, kind, environment, threshold, triggers, condition_match, conditions, channel_ids, cooldown_mins)
    VALUES
        (p_org_id, v_web_id, 'New production errors', true, 'issue_created', 'production', NULL,
         '[{"type":"issue_new"}]'::jsonb, 'all', '[]'::jsonb, ARRAY[v_ch_slack], 30),
        (p_org_id, v_web_id, 'Production regressions', true, 'regression', 'production', NULL,
         '[{"type":"issue_new"}]'::jsonb, 'all', '[{"field":"came_back","op":"is","value":"yes"}]'::jsonb, ARRAY[v_ch_slack, v_ch_discord], 60),
        (p_org_id, v_web_id, 'Production error spike', true, 'velocity_spike', 'production', 5,
         '[{"type":"event_frequency"}]'::jsonb, 'all', '[]'::jsonb, ARRAY[v_ch_slack], 30),
        (p_org_id, v_web_id, 'New staging errors', false, 'issue_created', 'staging', NULL,
         '[{"type":"issue_new"}]'::jsonb, 'all', '[]'::jsonb, ARRAY[v_ch_discord], 120),
        (p_org_id, v_api_id, 'New production errors', true, 'issue_created', 'production', NULL,
         '[{"type":"issue_new"}]'::jsonb, 'all', '[]'::jsonb, ARRAY[v_ch_hook], 30);

    -- Alert history (link to a few issues)
    INSERT INTO alerts (org_id, project_id, issue_id, kind, fired_at, payload_json)
    SELECT p_org_id, v_web_id, i.id, k.kind, v_now - k.ago, k.payload
    FROM (
        VALUES
            ('velocity_spike', interval '2 hours', '{"title":"Checkout TypeError","current_window":47,"previous_window":8,"ratio":5.875}'::jsonb),
            ('regression', interval '5 hours', '{"title":"Session refresh failed","resolved_in_release":"web@2.13.0"}'::jsonb),
            ('new_issue', interval '8 hours', '{"title":"ChunkLoadError"}'::jsonb),
            ('users_affected', interval '12 hours', '{"title":"map undefined","threshold":20,"unique_user_count":120}'::jsonb),
            ('event_milestone', interval '1 day', '{"title":"map undefined","threshold":100,"event_count":890}'::jsonb),
            ('noise_spike', interval '2 days', '{"title":"ResizeObserver","filtered":180}'::jsonb)
    ) AS k(kind, ago, payload)
    JOIN LATERAL (
        SELECT id FROM issues WHERE project_id = v_web_id AND merge_parent_id IS NULL ORDER BY event_count DESC LIMIT 1
    ) i ON true;

    INSERT INTO alerts (org_id, project_id, issue_id, kind, fired_at, payload_json)
    SELECT p_org_id, v_api_id, i.id, 'new_issue', v_now - interval '6 hours',
           jsonb_build_object('title', i.title)
    FROM issues i
    WHERE i.project_id = v_api_id
    ORDER BY i.last_seen_at DESC
    LIMIT 2;

    -- Mark recent alerts read for the owner
    INSERT INTO alert_user_states (user_id, alert_id, read_at, ignored)
    SELECT p_user_id, a.id, v_now - interval '1 hour', false
    FROM alerts a
    WHERE a.org_id = p_org_id
    ORDER BY a.fired_at DESC
    LIMIT 2
    ON CONFLICT (user_id, alert_id) DO NOTHING;

    INSERT INTO alert_user_states (user_id, alert_id, read_at, ignored)
    SELECT p_user_id, a.id, v_now - interval '3 hours', true
    FROM alerts a
    WHERE a.org_id = p_org_id AND a.kind = 'noise_spike'
    ON CONFLICT (user_id, alert_id) DO UPDATE
    SET ignored = EXCLUDED.ignored, read_at = EXCLUDED.read_at;

    -- Webhooks
    INSERT INTO webhooks (project_id, url, format, events, signing_secret, secret_prefix)
    VALUES
        (
            v_web_id,
            'https://hooks.slack.com/services/T000/B000/XXXX',
            'slack',
            ARRAY['issue_created','regression'],
            convert_to('whsec_demo_bootstrap_web', 'UTF8'),
            'whsec_demo'
        ),
        (
            v_api_id,
            'https://hooks.acme-corp.com/epure/api',
            'generic',
            ARRAY['issue_created','regression'],
            convert_to('whsec_demo_bootstrap_api', 'UTF8'),
            'whsec_api'
        );

    -- Noise policy (Web filters on; API mostly off)
    INSERT INTO project_noise_policies (project_id, org_id, extensions, crawlers, localhost, legacy_browsers, resize_observer, chunk_load, message_patterns)
    VALUES
        (v_web_id, p_org_id, true, true, true, false, true, false, '["ResizeObserver loop"]'::jsonb),
        (v_api_id, p_org_id, false, false, false, false, false, false, '[]'::jsonb);

    INSERT INTO ingest_outcomes (project_id, org_id, window_start, reason, count)
    VALUES
        (v_web_id, p_org_id, date_trunc('hour', v_now) - interval '1 hour', 'noise_resize_observer', 42),
        (v_web_id, p_org_id, date_trunc('hour', v_now) - interval '2 hours', 'noise_crawler', 11),
        (v_web_id, p_org_id, date_trunc('hour', v_now) - interval '3 hours', 'accepted', 180);

    -- Setup complete
    INSERT INTO user_setup_progress (
        user_id, org_id, project_id, project_named,
        dsn_copied_at, first_issue_seen_at, completed_at, updated_at
    ) VALUES
        (p_user_id, p_org_id, v_web_id, true, v_now, v_now, v_now, v_now),
        (p_user_id, p_org_id, v_api_id, true, v_now, v_now, v_now, v_now);
END;
$fn$;

REVOKE ALL ON FUNCTION auth_bootstrap_workspace(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_bootstrap_workspace(uuid, uuid, text) TO epure_app;
