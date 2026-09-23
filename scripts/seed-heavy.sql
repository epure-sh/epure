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
