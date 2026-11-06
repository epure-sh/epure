-- Keep verified customer bindings usable even before the first subscription.
CREATE OR REPLACE FUNCTION billing_org_for_polar_customer(p_customer text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
    SELECT CASE WHEN count(DISTINCT org_id)=1 THEN min(org_id::text)::uuid END
    FROM (
        SELECT org_id FROM billing_sync_targets WHERE customer_id=p_customer
        UNION ALL
        SELECT org_id FROM subscriptions WHERE provider='polar' AND customer_id=p_customer
    ) bindings
$$;

CREATE OR REPLACE FUNCTION billing_register_customer(p_org uuid,p_customer text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
    PERFORM set_config('app.current_org_id',p_org::text,true);
    IF EXISTS(SELECT 1 FROM organizations WHERE id=p_org) THEN
        INSERT INTO billing_sync_targets(org_id,customer_id) VALUES(p_org,p_customer)
        ON CONFLICT DO NOTHING;
        UPDATE billing_sync_targets SET customer_id=p_customer,next_sync_at=now()
        WHERE org_id=p_org AND customer_id IS NULL AND NOT EXISTS(
            SELECT 1 FROM billing_sync_targets WHERE customer_id=p_customer
        );
    END IF;
END;
$$;

ALTER TABLE subscriptions
    ADD COLUMN pause_at_period_end boolean NOT NULL DEFAULT false,
    ADD COLUMN provider_modified_at timestamptz;

CREATE INDEX billing_sync_due_idx ON billing_sync_targets(next_sync_at);
CREATE INDEX subscriptions_polar_customer_idx ON subscriptions(customer_id) WHERE provider='polar';

CREATE OR REPLACE FUNCTION billing_apply_snapshot(p_org uuid,p_customer text,p_subscriptions jsonb,p_active text,p_plan text,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
    item jsonb;
    old_org organizations%ROWTYPE;
    provider_trial_end timestamptz;
BEGIN
    PERFORM set_config('app.current_org_id',p_org::text,true);
    SELECT * INTO STRICT old_org FROM organizations WHERE id=p_org FOR UPDATE;

    INSERT INTO billing_sync_targets(org_id,customer_id) VALUES(p_org,p_customer)
    ON CONFLICT(org_id) DO UPDATE SET customer_id=EXCLUDED.customer_id
    WHERE billing_sync_targets.customer_id IS NULL OR billing_sync_targets.customer_id=EXCLUDED.customer_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'billing customer binding conflict'; END IF;

    FOR item IN SELECT value FROM jsonb_array_elements(p_subscriptions) LOOP
        INSERT INTO subscriptions(org_id,provider,customer_id,subscription_id,plan_tier,status,current_period_end,
            cancel_at_period_end,pause_at_period_end,product_id,current_period_start,pending_update,last_synced_at,provider_modified_at)
        VALUES(p_org,'polar',p_customer,item->>'id',item->>'epure_plan',item->>'status',(item->>'current_period_end')::timestamptz,
            COALESCE((item->>'cancel_at_period_end')::boolean,false),COALESCE((item->>'pause_at_period_end')::boolean,false),
            item->>'product_id',(item->>'current_period_start')::timestamptz,
            NULLIF(item->'pending_update','null'::jsonb),now(),
            COALESCE((item->>'modified_at')::timestamptz,(item->>'created_at')::timestamptz))
        ON CONFLICT(subscription_id) DO UPDATE SET plan_tier=EXCLUDED.plan_tier,status=EXCLUDED.status,
            current_period_end=EXCLUDED.current_period_end,cancel_at_period_end=EXCLUDED.cancel_at_period_end,
            pause_at_period_end=EXCLUDED.pause_at_period_end,
            product_id=EXCLUDED.product_id,current_period_start=EXCLUDED.current_period_start,
            pending_update=EXCLUDED.pending_update,last_synced_at=now(),updated_at=now(),
            provider_modified_at=EXCLUDED.provider_modified_at
        WHERE subscriptions.org_id=p_org AND subscriptions.customer_id=p_customer AND subscriptions.provider='polar'
            AND (subscriptions.provider_modified_at IS NULL OR EXCLUDED.provider_modified_at>=subscriptions.provider_modified_at);
        IF NOT FOUND THEN RAISE EXCEPTION 'billing subscription binding conflict or stale provider revision'; END IF;
        IF item->>'id'=p_active AND p_status='trialing' THEN
            provider_trial_end:=COALESCE((item->>'trial_end')::timestamptz,(item->>'current_period_end')::timestamptz);
        END IF;
    END LOOP;

    UPDATE subscriptions SET status=CASE WHEN p_status='deleted' THEN 'deleted' ELSE 'canceled' END,
        cancel_at_period_end=false,pause_at_period_end=false,pending_update=NULL,last_synced_at=now(),updated_at=now()
    WHERE org_id=p_org AND provider='polar' AND customer_id=p_customer AND left(subscription_id,6)<>'trial_'
      AND status NOT IN ('deleted','canceled')
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_subscriptions) x WHERE x->>'id'=subscriptions.subscription_id);

    IF p_active IS NOT NULL THEN
        UPDATE organizations SET plan_tier=p_plan,subscription_id=p_active,subscription_status=p_status,
            trial_ends_at=provider_trial_end,canary_expires_at=NULL WHERE id=p_org;
    ELSIF old_org.subscription_id IS NOT NULL
        OR NOT (
            (old_org.subscription_status='trialing' AND old_org.trial_ends_at IS NOT NULL)
            OR old_org.canary_expires_at IS NOT NULL
        ) THEN
        UPDATE organizations SET plan_tier='oss',subscription_id=NULL,subscription_status=p_status,
            trial_ends_at=NULL,canary_expires_at=NULL WHERE id=p_org;
    END IF;

    UPDATE billing_sync_targets SET last_synced_at=now(),next_sync_at=now()+interval '5 minutes',attempts=0,last_error=NULL,
        drift_count=drift_count+CASE WHEN EXISTS(
            SELECT 1 FROM organizations WHERE id=p_org AND
                (plan_tier,subscription_id,subscription_status,trial_ends_at)
                IS DISTINCT FROM (old_org.plan_tier,old_org.subscription_id,old_org.subscription_status,old_org.trial_ends_at)
        ) THEN 1 ELSE 0 END
    WHERE org_id=p_org;
END;
$$;
