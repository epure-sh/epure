-- Migration: Helper for canary workspace to record Polar customer and trial subscription

CREATE OR REPLACE FUNCTION canary_record_polar_customer(p_org_id uuid, p_customer_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM set_config('app.current_org_id', p_org_id::text, true);

    INSERT INTO subscriptions (org_id, provider, customer_id, subscription_id, plan_tier, status, current_period_end)
    VALUES (p_org_id, 'polar', p_customer_id, 'trial_' || replace(p_org_id::text, '-', ''), 'canary_sandbox', 'trialing', now() + interval '7 days')
    ON CONFLICT (subscription_id) DO UPDATE SET customer_id = EXCLUDED.customer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION canary_record_polar_customer(uuid, text) TO epure_app;
