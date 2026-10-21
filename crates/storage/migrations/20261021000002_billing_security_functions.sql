-- Security definer functions for billing webhook handlers to operate with audited system authority
-- while respecting Row-Level Security.

CREATE OR REPLACE FUNCTION billing_activate_subscription(
    p_org_id uuid,
    p_plan_tier text,
    p_sub_id text,
    p_customer_id text,
    p_status text,
    p_period_end timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM set_config('app.current_org_id', p_org_id::text, true);

    UPDATE organizations
    SET plan_tier = p_plan_tier,
        subscription_id = p_sub_id,
        subscription_status = p_status,
        canary_expires_at = NULL
    WHERE id = p_org_id;

    INSERT INTO subscriptions
        (org_id, provider, customer_id, subscription_id, plan_tier, status, current_period_end)
    VALUES (p_org_id, 'polar', p_customer_id, p_sub_id, p_plan_tier, p_status, p_period_end)
    ON CONFLICT (subscription_id) DO UPDATE SET
        plan_tier = EXCLUDED.plan_tier,
        status = EXCLUDED.status,
        current_period_end = EXCLUDED.current_period_end,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION billing_update_subscription(
    p_sub_id text,
    p_status text,
    p_plan_tier text,
    p_cancel_at_period_end boolean,
    p_period_end timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id uuid;
BEGIN
    SELECT org_id INTO v_org_id
    FROM subscriptions
    WHERE subscription_id = p_sub_id
    LIMIT 1;

    IF v_org_id IS NULL THEN
        SELECT id INTO v_org_id
        FROM organizations
        WHERE subscription_id = p_sub_id
        LIMIT 1;
    END IF;

    IF v_org_id IS NOT NULL THEN
        PERFORM set_config('app.current_org_id', v_org_id::text, true);

        UPDATE organizations
        SET subscription_status = p_status,
            plan_tier = p_plan_tier
        WHERE id = v_org_id;

        UPDATE subscriptions
        SET status = p_status,
            plan_tier = p_plan_tier,
            cancel_at_period_end = p_cancel_at_period_end,
            current_period_end = p_period_end,
            updated_at = now()
        WHERE subscription_id = p_sub_id;
    END IF;

    RETURN v_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION billing_cancel_subscription(
    p_sub_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id uuid;
BEGIN
    SELECT org_id INTO v_org_id
    FROM subscriptions
    WHERE subscription_id = p_sub_id
    LIMIT 1;

    IF v_org_id IS NULL THEN
        SELECT id INTO v_org_id
        FROM organizations
        WHERE subscription_id = p_sub_id
        LIMIT 1;
    END IF;

    IF v_org_id IS NOT NULL THEN
        PERFORM set_config('app.current_org_id', v_org_id::text, true);

        UPDATE organizations
        SET plan_tier = 'oss',
            subscription_status = 'canceled'
        WHERE id = v_org_id;

        UPDATE subscriptions
        SET status = 'canceled',
            updated_at = now()
        WHERE subscription_id = p_sub_id;
    END IF;

    RETURN v_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION billing_order_paid(
    p_org_id uuid,
    p_plan_tier text,
    p_sub_id text,
    p_customer_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM set_config('app.current_org_id', p_org_id::text, true);

    IF p_sub_id IS NOT NULL AND p_sub_id != '' THEN
        UPDATE organizations
        SET plan_tier = p_plan_tier,
            subscription_id = p_sub_id,
            subscription_status = 'active',
            canary_expires_at = NULL
        WHERE id = p_org_id;

        INSERT INTO subscriptions
            (org_id, provider, customer_id, subscription_id, plan_tier, status, current_period_end)
        VALUES (p_org_id, 'polar', p_customer_id, p_sub_id, p_plan_tier, 'active', now() + interval '30 days')
        ON CONFLICT (subscription_id) DO UPDATE SET
            plan_tier = EXCLUDED.plan_tier,
            status = 'active',
            current_period_end = EXCLUDED.current_period_end,
            updated_at = now();
    ELSE
        UPDATE organizations
        SET plan_tier = p_plan_tier,
            subscription_status = 'active',
            canary_expires_at = NULL
        WHERE id = p_org_id;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION billing_activate_subscription TO epure_app;
GRANT EXECUTE ON FUNCTION billing_update_subscription TO epure_app;
GRANT EXECUTE ON FUNCTION billing_cancel_subscription TO epure_app;
GRANT EXECUTE ON FUNCTION billing_order_paid TO epure_app;
