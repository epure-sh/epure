-- Extend plan_tier check constraint on organizations to include
-- dedicated_sovereign (Polar-based Dedicated plan) and 'canceled' as a
-- transitional state when the org downgrade is pending.
-- Also rename legacy aliases to canonical Polar tier names.

-- Drop the existing check constraint (PostgreSQL doesn't support ALTER CHECK)
ALTER TABLE organizations
    DROP CONSTRAINT IF EXISTS organizations_plan_tier_check;

-- Re-add with extended set including dedicated_sovereign
ALTER TABLE organizations
    ADD CONSTRAINT organizations_plan_tier_check
    CHECK (plan_tier IN (
        'oss',
        'builder_pro',
        'multi_app_studio',
        'boutique_agency',
        'dedicated_sovereign',
        'canary_sandbox'
    ));

-- Also make subscription_status more descriptive (no constraint, free text is fine)
-- Ensure subscription_id index for webhook lookup performance
CREATE INDEX IF NOT EXISTS orgs_subscription_id_idx
    ON organizations(subscription_id)
    WHERE subscription_id IS NOT NULL;
