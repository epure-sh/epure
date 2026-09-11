INSERT INTO organizations (id, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'Acme Corp')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO projects (id, org_id, name, slug, ingest_cap_per_hour)
VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    '11111111-1111-1111-1111-111111111111',
    'Acme Web',
    'acme-web',
    5000
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    ingest_cap_per_hour = EXCLUDED.ingest_cap_per_hour;

INSERT INTO projects (id, org_id, name, slug, ingest_cap_per_hour)
VALUES (
    '660e8400-e29b-41d4-a716-446655440001',
    '11111111-1111-1111-1111-111111111111',
    'Acme API',
    'acme-api',
    5000
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    ingest_cap_per_hour = EXCLUDED.ingest_cap_per_hour;

INSERT INTO dsn_keys (id, project_id, public_key, secret_key, label)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    '550e8400-e29b-41d4-a716-446655440000',
    'a1b2c3d4e5f6g7h8i9j0',
    convert_to('supersecretdevkey', 'UTF8'),
    'Production browser'
)
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label;

INSERT INTO dsn_keys (id, project_id, public_key, secret_key, label)
VALUES (
    '22222222-2222-2222-2222-222222222223',
    '660e8400-e29b-41d4-a716-446655440001',
    'b2c3d4e5f6g7h8i9j0k1',
    convert_to('supersecretdevkey', 'UTF8'),
    'API server'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, password_hash)
VALUES (
    '33333333-3333-3333-3333-333333333333',
    'dev@epure.local',
    decode(
        '65707572652d6465762d73616c7421215068a4eddcc0dc4bc8ff20f17ef8b7565ca5bdcc36675b1fe8c9f74fc7c466ac',
        'hex'
    )
)
ON CONFLICT (id) DO UPDATE
SET password_hash = EXCLUDED.password_hash;

INSERT INTO org_members (org_id, user_id, role)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    'owner'
)
ON CONFLICT (org_id, user_id) DO NOTHING;

INSERT INTO users (id, email, password_hash)
VALUES (
    '44444444-4444-4444-4444-444444444444',
    'member@epure.local',
    decode(
        '65707572652d6465762d73616c7421215068a4eddcc0dc4bc8ff20f17ef8b7565ca5bdcc36675b1fe8c9f74fc7c466ac',
        'hex'
    )
)
ON CONFLICT (id) DO UPDATE
SET password_hash = EXCLUDED.password_hash;

INSERT INTO org_members (org_id, user_id, role)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444444',
    'member'
)
ON CONFLICT (org_id, user_id) DO NOTHING;

-- Skip the onboarding wizard for seeded projects (dev@epure.local / member).
INSERT INTO user_setup_progress (
    user_id,
    org_id,
    project_id,
    project_named,
    dsn_copied_at,
    first_issue_seen_at,
    completed_at,
    updated_at
)
SELECT
    u.id,
    '11111111-1111-1111-1111-111111111111',
    p.id,
    true,
    now(),
    now(),
    now(),
    now()
FROM (
    VALUES
        ('33333333-3333-3333-3333-333333333333'::uuid),
        ('44444444-4444-4444-4444-444444444444'::uuid)
) AS u(id)
CROSS JOIN (
    VALUES
        ('550e8400-e29b-41d4-a716-446655440000'::uuid),
        ('660e8400-e29b-41d4-a716-446655440001'::uuid)
) AS p(id)
ON CONFLICT (user_id, org_id, project_id) DO UPDATE SET
    project_named = true,
    completed_at = COALESCE(user_setup_progress.completed_at, EXCLUDED.completed_at),
    first_issue_seen_at = COALESCE(
        user_setup_progress.first_issue_seen_at,
        EXCLUDED.first_issue_seen_at
    ),
    updated_at = EXCLUDED.updated_at;
