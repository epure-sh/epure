-- SDK-safe project for browser @sentry/* DSN parsing.
-- Avoid UUID path segments like 550e8400-... (parsed as scientific notation → project "550").
-- Requires Acme Corp org (from seed-dev.sql) or the INSERT below.

INSERT INTO organizations (id, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'Acme Corp')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO projects (id, org_id, name, slug, ingest_cap_per_hour)
VALUES (
    'a50e8400-e29b-41d4-a716-446655440000',
    '11111111-1111-1111-1111-111111111111',
    'Shop Demo',
    'shop-demo',
    5000
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    ingest_cap_per_hour = EXCLUDED.ingest_cap_per_hour;

INSERT INTO dsn_keys (id, project_id, public_key, secret_key, label)
VALUES (
    '22222222-2222-2222-2222-222222222225',
    'a50e8400-e29b-41d4-a716-446655440000',
    'd4e5f6g7h8i9j0k1l2m3n4',
    convert_to('supersecretdevkey', 'UTF8'),
    'Shop demo browser'
)
ON CONFLICT (id) DO UPDATE
SET project_id = EXCLUDED.project_id,
    public_key = EXCLUDED.public_key,
    secret_key = EXCLUDED.secret_key,
    label = EXCLUDED.label,
    revoked_at = NULL;
