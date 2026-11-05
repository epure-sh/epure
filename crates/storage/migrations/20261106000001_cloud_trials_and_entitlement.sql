-- Cloud no-card trial, one per user, and the billing columns ingest needs to
-- resolve entitlement (see epure_core::entitlement). Self-hosted deployments
-- never call billing_start_trial, so nothing changes for them.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

CREATE TABLE IF NOT EXISTS trial_grants (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    org_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
    granted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE trial_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON trial_grants FROM PUBLIC;

-- Grant the user's first Cloud workspace a trial on Pro. Later workspaces of
-- the same user start without a plan and must subscribe.
CREATE OR REPLACE FUNCTION billing_start_trial(p_user uuid, p_org uuid, p_days int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE granted boolean;
BEGIN
    IF p_days < 1 OR p_days > 60 THEN
        RAISE EXCEPTION 'trial length out of range';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM org_members
        WHERE org_id = p_org AND user_id = p_user AND role = 'owner'
    ) THEN
        RAISE EXCEPTION 'trial requires workspace owner';
    END IF;

    INSERT INTO trial_grants (user_id, org_id) VALUES (p_user, p_org)
    ON CONFLICT (user_id) DO NOTHING;
    granted := FOUND;

    IF granted THEN
        UPDATE organizations
        SET plan_tier = 'pro',
            subscription_status = 'trialing',
            trial_ends_at = now() + make_interval(days => p_days)
        WHERE id = p_org AND subscription_id IS NULL;
    ELSE
        UPDATE organizations
        SET subscription_status = 'none'
        WHERE id = p_org AND subscription_id IS NULL AND plan_tier = 'oss';
    END IF;
    RETURN granted;
END;
$$;
REVOKE ALL ON FUNCTION billing_start_trial(uuid, uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing_start_trial(uuid, uuid, int) TO epure_app;

-- Billing columns for ingest (epure_ingest has no dashboard RLS context).
CREATE OR REPLACE FUNCTION ingest_org_billing(p_org uuid)
RETURNS TABLE (
    plan_tier text,
    subscription_status text,
    trial_ends_at timestamptz,
    canary_expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT o.plan_tier, o.subscription_status, o.trial_ends_at, o.canary_expires_at
    FROM organizations o
    WHERE o.id = p_org;
$$;
REVOKE ALL ON FUNCTION ingest_org_billing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ingest_org_billing(uuid) TO epure_ingest;
GRANT EXECUTE ON FUNCTION ingest_org_billing(uuid) TO epure_app;

-- Clamp project retention to the plan ceiling (Cloud only; called by the TTL job).
CREATE OR REPLACE FUNCTION billing_clamp_retention(p_pro_days int, p_scale_days int)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    WITH clamped AS (
        UPDATE projects p
        SET retention_days = CASE WHEN o.plan_tier IN ('scale','team_plus','plus','studio','multi_app_studio','agency','boutique_agency','dedicated','enterprise','dedicated_sovereign') THEN p_scale_days ELSE p_pro_days END
        FROM organizations o
        WHERE o.id = p.org_id
          AND p.retention_days > CASE WHEN o.plan_tier IN ('scale','team_plus','plus','studio','multi_app_studio','agency','boutique_agency','dedicated','enterprise','dedicated_sovereign') THEN p_scale_days ELSE p_pro_days END
        RETURNING 1
    )
    SELECT count(*) FROM clamped;
$$;
REVOKE ALL ON FUNCTION billing_clamp_retention(int, int) FROM PUBLIC;
