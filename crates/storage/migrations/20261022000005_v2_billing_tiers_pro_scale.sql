-- Extend plan_tier check constraint on organizations to include 'pro' and 'scale'

ALTER TABLE organizations
    DROP CONSTRAINT IF EXISTS organizations_plan_tier_check;

ALTER TABLE organizations
    ADD CONSTRAINT organizations_plan_tier_check
    CHECK (plan_tier IN (
        'oss',
        'pro',
        'scale',
        'builder_pro',
        'multi_app_studio',
        'boutique_agency',
        'dedicated_sovereign',
        'canary_sandbox'
    ));
