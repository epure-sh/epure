-- Heavy seed scaffold: org, 3 projects, DSN keys, releases, webhooks, invitations.
-- No users / passwords. Idempotent — safe to re-run. Issues/events reset by seed.sh.

\echo 'Applying heavy seed (org, projects, DSN, releases)...'

INSERT INTO organizations (id, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'Acme Corp')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO projects (id, org_id, name, slug, ingest_cap_per_hour, is_demo)
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440000',
        '11111111-1111-1111-1111-111111111111',
        'Acme Web',
        'acme-web',
        50000,
        true
    ),
    (
        '660e8400-e29b-41d4-a716-446655440001',
        '11111111-1111-1111-1111-111111111111',
        'Acme API',
        'acme-api',
        50000,
        true
    ),
    (
        '770e8400-e29b-41d4-a716-446655440002',
        '11111111-1111-1111-1111-111111111111',
        'Acme Mobile',
        'acme-mobile',
        50000,
        true
    )
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    ingest_cap_per_hour = EXCLUDED.ingest_cap_per_hour,
    is_demo = true;

INSERT INTO dsn_keys (id, project_id, public_key, secret_key, label)
VALUES
    (
        '22222222-2222-2222-2222-222222222222',
        '550e8400-e29b-41d4-a716-446655440000',
        'a1b2c3d4e5f6g7h8i9j0',
        convert_to('supersecretdevkey', 'UTF8'),
        'Production browser'
    ),
    (
        '22222222-2222-2222-2222-222222222223',
        '660e8400-e29b-41d4-a716-446655440001',
        'b2c3d4e5f6g7h8i9j0k1',
        convert_to('supersecretdevkey', 'UTF8'),
        'API server'
    ),
    (
        '22222222-2222-2222-2222-222222222224',
        '770e8400-e29b-41d4-a716-446655440002',
        'c3d4e5f6g7h8i9j0k1l2',
        convert_to('supersecretdevkey', 'UTF8'),
        'iOS + Android'
    )
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label;

-- Accounts are never seeded with passwords. Attach a user after ingest:
--   ./scripts/seed.sh --email you@example.com --password '…'
--   ./scripts/seed.sh --link-user you@example.com

-- Releases (artifacts optional — versions drive release health UI)
INSERT INTO releases (project_id, version)
VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 'web@2.15.0'),
    ('550e8400-e29b-41d4-a716-446655440000', 'web@2.14.0'),
    ('550e8400-e29b-41d4-a716-446655440000', 'web@2.13.2'),
    ('550e8400-e29b-41d4-a716-446655440000', 'web@2.13.0'),
    ('550e8400-e29b-41d4-a716-446655440000', 'web@2.12.0'),
    ('660e8400-e29b-41d4-a716-446655440001', 'api@1.9.0'),
    ('660e8400-e29b-41d4-a716-446655440001', 'api@1.8.3'),
    ('660e8400-e29b-41d4-a716-446655440001', 'api@1.8.2'),
    ('770e8400-e29b-41d4-a716-446655440002', 'mobile@3.2.0'),
    ('770e8400-e29b-41d4-a716-446655440002', 'mobile@3.1.4'),
    ('770e8400-e29b-41d4-a716-446655440002', 'mobile@3.1.0')
ON CONFLICT (project_id, version) DO NOTHING;

INSERT INTO webhooks (id, project_id, url, format, events, signing_secret, secret_prefix)
VALUES (
    'a1000001-0000-4000-8000-000000000101',
    '550e8400-e29b-41d4-a716-446655440000',
    'https://hooks.slack.com/services/T000/B000/XXXX',
    'slack',
    ARRAY['issue_created', 'regression'],
    convert_to('whsec_dev_seed_secret_not_for_prod', 'UTF8'),
    'whsec_a1b2'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO org_invitations (id, org_id, email, role, token_hash, expires_at)
VALUES (
    'a1000001-0000-4000-8000-000000000102',
    '11111111-1111-1111-1111-111111111111',
    'qa@acme-corp.com',
    'member',
    decode('deadbeef', 'hex'),
    now() + interval '7 days'
)
ON CONFLICT (id) DO NOTHING;

-- Cron monitors (aligned with register bootstrap + playground labels)
INSERT INTO monitors (
    id, project_id, org_id, slug, name, schedule, schedule_type, status,
    last_check_in_at, last_duration_ms, environment, timezone,
    checkin_margin_mins, max_runtime_mins, paused, next_check_in_at
)
VALUES
    (
        'a1000001-0000-4000-8000-000000000201',
        '550e8400-e29b-41d4-a716-446655440000',
        '11111111-1111-1111-1111-111111111111',
        'nightly-backup', 'Nightly Stripe Payouts', '0 2 * * *', 'crontab', 'ok',
        now() - interval '90 minutes', 1240, 'production', 'UTC',
        5, 30, false, now() + interval '22 hours'
    ),
    (
        'a1000001-0000-4000-8000-000000000202',
        '550e8400-e29b-41d4-a716-446655440000',
        '11111111-1111-1111-1111-111111111111',
        'billing-sync', 'Billing Sync', 'every 15 minute', 'interval', 'missed',
        now() - interval '3 hours', 820, 'production', 'UTC',
        5, 15, false, now() - interval '10 minutes'
    ),
    (
        'a1000001-0000-4000-8000-000000000203',
        '550e8400-e29b-41d4-a716-446655440000',
        '11111111-1111-1111-1111-111111111111',
        'stripe-reconcile', 'Stripe reconcile', '0 3 * * *', 'crontab', 'error',
        now() - interval '20 hours', 0, 'production', 'UTC',
        10, 60, false, now() + interval '4 hours'
    ),
    (
        'a1000001-0000-4000-8000-000000000204',
        '550e8400-e29b-41d4-a716-446655440000',
        '11111111-1111-1111-1111-111111111111',
        'session-gc', 'Session garbage collect', '*/15 * * * *', 'crontab', 'in_progress',
        now() - interval '2 minutes', NULL, 'production', 'UTC',
        5, 10, false, now() + interval '13 minutes'
    ),
    (
        'a1000001-0000-4000-8000-000000000205',
        '550e8400-e29b-41d4-a716-446655440000',
        '11111111-1111-1111-1111-111111111111',
        'staging-warmup', 'Staging warmup', '0 9 * * 1-5', 'crontab', 'ok',
        now() - interval '1 day', 8000, 'staging', 'UTC',
        5, 15, true, NULL
    ),
    (
        'a1000001-0000-4000-8000-000000000206',
        '550e8400-e29b-41d4-a716-446655440000',
        '11111111-1111-1111-1111-111111111111',
        'cdn-purge-audit', 'CDN purge audit', '0 */12 * * *', 'crontab', 'timeout',
        now() - interval '12 hours', 1900000, 'production', 'UTC',
        5, 20, false, now() + interval '30 minutes'
    ),
    (
        'a1000001-0000-4000-8000-000000000207',
        '660e8400-e29b-41d4-a716-446655440001',
        '11111111-1111-1111-1111-111111111111',
        'orders-outbox-drain', 'Orders outbox drain', 'every 5 minutes', 'interval', 'ok',
        now() - interval '4 minutes', 1200, 'production', 'UTC',
        2, 5, false, now() + interval '1 minutes'
    ),
    (
        'a1000001-0000-4000-8000-000000000208',
        '660e8400-e29b-41d4-a716-446655440001',
        '11111111-1111-1111-1111-111111111111',
        'inventory-sync', 'Inventory sync', '0 * * * *', 'crontab', 'missed',
        now() - interval '2 hours', 60000, 'production', 'UTC',
        5, 30, false, now() - interval '10 minutes'
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    schedule = EXCLUDED.schedule,
    schedule_type = EXCLUDED.schedule_type,
    status = EXCLUDED.status,
    last_check_in_at = EXCLUDED.last_check_in_at,
    last_duration_ms = EXCLUDED.last_duration_ms,
    environment = EXCLUDED.environment,
    paused = EXCLUDED.paused,
    next_check_in_at = EXCLUDED.next_check_in_at,
    updated_at = now();

DELETE FROM monitor_check_ins
WHERE monitor_id IN (
    SELECT id FROM monitors
    WHERE project_id IN (
        '550e8400-e29b-41d4-a716-446655440000',
        '660e8400-e29b-41d4-a716-446655440001'
    )
);

INSERT INTO monitor_check_ins (monitor_id, project_id, org_id, check_in_id, status, duration_ms, environment, created_at)
SELECT
    m.id,
    m.project_id,
    m.org_id,
    'seed-ci-' || m.slug || '-' || g::text,
    CASE WHEN g = 1 THEN 'ok' ELSE m.status END,
    COALESCE(m.last_duration_ms, 1000),
    m.environment,
    now() - (g || ' hours')::interval
FROM monitors m
CROSS JOIN generate_series(1, 3) g
WHERE m.project_id IN (
    '550e8400-e29b-41d4-a716-446655440000',
    '660e8400-e29b-41d4-a716-446655440001'
);

-- Alert channels + rules
INSERT INTO alert_channels (id, org_id, project_id, provider, label, config, is_enabled)
VALUES
    (
        'a1000001-0000-4000-8000-000000000301',
        '11111111-1111-1111-1111-111111111111',
        '550e8400-e29b-41d4-a716-446655440000',
        'slack',
        'Eng on-call',
        '{"webhook_url":"https://hooks.slack.com/services/T000/B000/XXXX","channel":"#eng-oncall"}'::jsonb,
        true
    ),
    (
        'a1000001-0000-4000-8000-000000000302',
        '11111111-1111-1111-1111-111111111111',
        '550e8400-e29b-41d4-a716-446655440000',
        'discord',
        'Product alerts',
        '{"webhook_url":"https://discord.com/api/webhooks/000/demo"}'::jsonb,
        true
    ),
    (
        'a1000001-0000-4000-8000-000000000303',
        '11111111-1111-1111-1111-111111111111',
        '660e8400-e29b-41d4-a716-446655440001',
        'webhook',
        'Pager relay',
        '{"url":"https://hooks.acme-corp.com/epure"}'::jsonb,
        true
    )
ON CONFLICT (id) DO UPDATE SET
    label = EXCLUDED.label,
    config = EXCLUDED.config,
    is_enabled = EXCLUDED.is_enabled;

INSERT INTO alert_rules (
    id, org_id, project_id, name, enabled, kind, environment, threshold,
    triggers, condition_match, conditions, channel_ids, cooldown_mins
)
VALUES
    (
        'a1000001-0000-4000-8000-000000000401',
        '11111111-1111-1111-1111-111111111111',
        '550e8400-e29b-41d4-a716-446655440000',
        'New production errors', true, 'issue_created', 'production', NULL,
        '[{"type":"issue_new"}]'::jsonb, 'all', '[]'::jsonb,
        ARRAY['a1000001-0000-4000-8000-000000000301'::uuid], 30
    ),
    (
        'a1000001-0000-4000-8000-000000000402',
        '11111111-1111-1111-1111-111111111111',
        '550e8400-e29b-41d4-a716-446655440000',
        'Production regressions', true, 'regression', 'production', NULL,
        '[{"type":"issue_new"}]'::jsonb, 'all',
        '[{"field":"came_back","op":"is","value":"yes"}]'::jsonb,
        ARRAY[
            'a1000001-0000-4000-8000-000000000301'::uuid,
            'a1000001-0000-4000-8000-000000000302'::uuid
        ],
        60
    ),
    (
        'a1000001-0000-4000-8000-000000000403',
        '11111111-1111-1111-1111-111111111111',
        '550e8400-e29b-41d4-a716-446655440000',
        'Production error spike', true, 'velocity_spike', 'production', 5,
        '[{"type":"event_frequency"}]'::jsonb, 'all', '[]'::jsonb,
        ARRAY['a1000001-0000-4000-8000-000000000301'::uuid], 30
    ),
    (
        'a1000001-0000-4000-8000-000000000404',
        '11111111-1111-1111-1111-111111111111',
        '550e8400-e29b-41d4-a716-446655440000',
        'New staging errors', false, 'issue_created', 'staging', NULL,
        '[{"type":"issue_new"}]'::jsonb, 'all', '[]'::jsonb,
        ARRAY['a1000001-0000-4000-8000-000000000302'::uuid], 120
    ),
    (
        'a1000001-0000-4000-8000-000000000405',
        '11111111-1111-1111-1111-111111111111',
        '660e8400-e29b-41d4-a716-446655440001',
        'New production errors', true, 'issue_created', 'production', NULL,
        '[{"type":"issue_new"}]'::jsonb, 'all', '[]'::jsonb,
        ARRAY['a1000001-0000-4000-8000-000000000303'::uuid], 30
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    enabled = EXCLUDED.enabled,
    kind = EXCLUDED.kind,
    environment = EXCLUDED.environment,
    threshold = EXCLUDED.threshold,
    channel_ids = EXCLUDED.channel_ids,
    cooldown_mins = EXCLUDED.cooldown_mins;

-- Noise policy + sample ingest outcomes
INSERT INTO project_noise_policies (
    project_id, org_id, extensions, crawlers, localhost, legacy_browsers,
    resize_observer, chunk_load, message_patterns, updated_at
)
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440000',
        '11111111-1111-1111-1111-111111111111',
        true, true, true, false, true, false,
        '["ResizeObserver loop"]'::jsonb,
        now()
    ),
    (
        '660e8400-e29b-41d4-a716-446655440001',
        '11111111-1111-1111-1111-111111111111',
        false, false, false, false, false, false,
        '[]'::jsonb,
        now()
    )
ON CONFLICT (project_id) DO UPDATE SET
    extensions = EXCLUDED.extensions,
    crawlers = EXCLUDED.crawlers,
    localhost = EXCLUDED.localhost,
    resize_observer = EXCLUDED.resize_observer,
    message_patterns = EXCLUDED.message_patterns,
    updated_at = now();

INSERT INTO ingest_outcomes (project_id, org_id, window_start, reason, count)
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440000',
        '11111111-1111-1111-1111-111111111111',
        date_trunc('hour', now()) - interval '1 hour',
        'noise_resize_observer',
        42
    ),
    (
        '550e8400-e29b-41d4-a716-446655440000',
        '11111111-1111-1111-1111-111111111111',
        date_trunc('hour', now()) - interval '2 hours',
        'noise_crawler',
        11
    ),
    (
        '550e8400-e29b-41d4-a716-446655440000',
        '11111111-1111-1111-1111-111111111111',
        date_trunc('hour', now()) - interval '3 hours',
        'accepted',
        180
    )
ON CONFLICT (project_id, window_start, reason) DO UPDATE SET count = EXCLUDED.count;
