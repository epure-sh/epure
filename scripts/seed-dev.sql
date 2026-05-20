-- Fixed-UUID scaffold for local curl / integration tests (no users, no passwords).
-- Demo error data for new accounts comes from auth_bootstrap_workspace on register.
-- Heavy dashboard volume: ./scripts/seed.sh

INSERT INTO organizations (id, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'Acme Corp')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO projects (id, org_id, name, slug, ingest_cap_per_hour, is_demo)
VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    '11111111-1111-1111-1111-111111111111',
    'Acme Web',
    'acme-web',
    5000,
    true
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    ingest_cap_per_hour = EXCLUDED.ingest_cap_per_hour,
    is_demo = true;

INSERT INTO projects (id, org_id, name, slug, ingest_cap_per_hour, is_demo)
VALUES (
    '660e8400-e29b-41d4-a716-446655440001',
    '11111111-1111-1111-1111-111111111111',
    'Acme API',
    'acme-api',
    5000,
    true
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    ingest_cap_per_hour = EXCLUDED.ingest_cap_per_hour,
    is_demo = true;

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
