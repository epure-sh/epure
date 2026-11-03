-- A failed handler must remain retryable; recording receipt alone is not success.
ALTER TABLE billing_webhook_events ADD COLUMN processed_at timestamptz, ADD COLUMN processing_started_at timestamptz;
UPDATE billing_webhook_events SET processed_at = received_at;
GRANT UPDATE ON billing_webhook_events TO epure_app;

CREATE FUNCTION billing_org_for_polar_customer(p_customer text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
    SELECT CASE WHEN count(DISTINCT org_id)=1 THEN min(org_id::text)::uuid ELSE NULL END
    FROM subscriptions WHERE provider='polar' AND customer_id=p_customer
$$;
REVOKE ALL ON FUNCTION billing_org_for_polar_customer(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing_org_for_polar_customer(text) TO epure_app;

CREATE FUNCTION billing_clear_customer_subscription(p_org uuid, p_customer text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
    PERFORM set_config('app.current_org_id',p_org::text,true);
    UPDATE organizations o SET plan_tier='oss',subscription_status='canceled',subscription_id=NULL
    WHERE o.id=p_org AND EXISTS (
        SELECT 1 FROM subscriptions s WHERE s.org_id=p_org AND s.provider='polar'
        AND s.customer_id=p_customer AND s.subscription_id=o.subscription_id
    );
    UPDATE subscriptions SET status='canceled',updated_at=now()
    WHERE org_id=p_org AND provider='polar' AND customer_id=p_customer;
END;
$$;
REVOKE ALL ON FUNCTION billing_clear_customer_subscription(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing_clear_customer_subscription(uuid,text) TO epure_app;
