-- Cloud Multi-Tenancy, Agency Workspaces, Subscriptions, and Enhanced RLS

-- 1. Plan Tiers & Agency Hierarchy
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'oss'
        CHECK (plan_tier IN ('oss', 'builder_pro', 'multi_app_studio', 'boutique_agency', 'canary_sandbox')),
    ADD COLUMN IF NOT EXISTS parent_agency_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS canary_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS orgs_parent_agency_idx
    ON organizations(parent_agency_id)
    WHERE parent_agency_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS orgs_canary_expiry_idx
    ON organizations(canary_expires_at)
    WHERE canary_expires_at IS NOT NULL;

-- 2. User Authentication Expansion (GitHub OAuth)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS github_id TEXT,
    ADD COLUMN IF NOT EXISTS github_login TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_github_id_idx
    ON users(github_id)
    WHERE github_id IS NOT NULL;

-- 3. Membership Role Expansion (Client Viewer role for TMA deliverable)
ALTER TABLE org_members
    DROP CONSTRAINT IF EXISTS org_members_role_check;

ALTER TABLE org_members
    ADD CONSTRAINT org_members_role_check
    CHECK (role IN ('owner', 'admin', 'member', 'client_viewer'));

-- 4. Magic Links Reintroduction
CREATE TABLE IF NOT EXISTS magic_link_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT NOT NULL,
    token_hash BYTEA NOT NULL,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT CHECK (role IS NULL OR role IN ('owner', 'admin', 'member', 'client_viewer')),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS magic_link_active_idx
    ON magic_link_tokens (token_hash)
    WHERE used_at IS NULL;

-- 5. Subscriptions Table (Polar.sh / Stripe)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('polar', 'stripe')),
    customer_id TEXT NOT NULL,
    subscription_id TEXT NOT NULL UNIQUE,
    plan_tier TEXT NOT NULL,
    status TEXT NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_org_idx ON subscriptions(org_id);

-- 6. Canary Metadata Table
CREATE TABLE IF NOT EXISTS canary_meta (
    org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    domain TEXT NOT NULL UNIQUE,
    app_name TEXT NOT NULL,
    page_path TEXT NOT NULL,
    seed_error TEXT NOT NULL,
    claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Ironclad PostgreSQL 16 RLS Enforcement
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE canary_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE canary_meta FORCE ROW LEVEL SECURITY;

ALTER TABLE magic_link_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE magic_link_tokens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_tenant ON subscriptions;
CREATE POLICY subscriptions_tenant ON subscriptions
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

DROP POLICY IF EXISTS canary_meta_tenant ON canary_meta;
CREATE POLICY canary_meta_tenant ON canary_meta
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

DROP POLICY IF EXISTS magic_link_tokens_tenant ON magic_link_tokens;
CREATE POLICY magic_link_tokens_tenant ON magic_link_tokens
    FOR ALL
    USING (
        org_id IS NULL
        OR org_id = current_setting('app.current_org_id', true)::uuid
    )
    WITH CHECK (
        org_id IS NULL
        OR org_id = current_setting('app.current_org_id', true)::uuid
    );

-- Agency Hierarchy RLS: Organizations
DROP POLICY IF EXISTS organizations_tenant ON organizations;
CREATE POLICY organizations_tenant ON organizations
    FOR ALL
    USING (
        id = current_setting('app.current_org_id', true)::uuid
        OR parent_agency_id = current_setting('app.current_org_id', true)::uuid
    )
    WITH CHECK (
        id = current_setting('app.current_org_id', true)::uuid
        OR parent_agency_id = current_setting('app.current_org_id', true)::uuid
    );

-- Agency Hierarchy RLS: Projects
DROP POLICY IF EXISTS projects_tenant ON projects;
CREATE POLICY projects_tenant ON projects
    FOR ALL
    USING (
        org_id = current_setting('app.current_org_id', true)::uuid
        OR EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = projects.org_id
              AND o.parent_agency_id = current_setting('app.current_org_id', true)::uuid
        )
    )
    WITH CHECK (
        org_id = current_setting('app.current_org_id', true)::uuid
    );

-- 8. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON subscriptions, canary_meta, magic_link_tokens TO epure_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON subscriptions, canary_meta, magic_link_tokens TO epure_ingest;
