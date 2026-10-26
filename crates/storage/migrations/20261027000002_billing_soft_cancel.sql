-- Keep paid plan until current_period_end when subscription is canceled early.

CREATE OR REPLACE FUNCTION billing_soft_cancel_subscription(
    p_sub_id text,
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
        SET subscription_status = 'canceled'
        WHERE id = v_org_id;

        UPDATE subscriptions
        SET status = 'canceled',
            cancel_at_period_end = true,
            current_period_end = p_period_end,
            updated_at = now()
        WHERE subscription_id = p_sub_id;
    END IF;

    RETURN v_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION billing_soft_cancel_subscription TO epure_app;
