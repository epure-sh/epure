-- Durable inbox plus service-owned reconciliation registry. No browser route exposes these tables.
ALTER TABLE billing_webhook_events
 ADD COLUMN payload jsonb, ADD COLUMN attempts integer NOT NULL DEFAULT 0,
 ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN last_error text;
CREATE INDEX billing_webhook_pending_idx ON billing_webhook_events(next_attempt_at) WHERE processed_at IS NULL AND payload IS NOT NULL;
GRANT DELETE ON billing_webhook_events TO epure_app;
ALTER TABLE subscriptions ADD COLUMN product_id text, ADD COLUMN current_period_start timestamptz,
 ADD COLUMN pending_update jsonb, ADD COLUMN last_synced_at timestamptz;
CREATE TABLE billing_sync_targets (
 org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
 customer_id text UNIQUE, last_synced_at timestamptz, next_sync_at timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 0, last_error text, drift_count bigint NOT NULL DEFAULT 0
);
-- These are backend service queues, like billing_webhook_events, never tenant API tables.
REVOKE ALL ON billing_sync_targets FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON billing_sync_targets TO epure_app;
INSERT INTO billing_sync_targets(org_id,customer_id)
 SELECT org_id,min(customer_id) FROM subscriptions s WHERE provider='polar' AND customer_id<>''
 AND NOT EXISTS (SELECT 1 FROM subscriptions other WHERE other.customer_id=s.customer_id AND other.org_id<>s.org_id)
 GROUP BY org_id HAVING count(DISTINCT customer_id)=1;

CREATE FUNCTION billing_apply_snapshot(p_org uuid,p_customer text,p_subscriptions jsonb,p_active text,p_plan text,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE item jsonb; sub_id text; old_plan text; old_status text;
BEGIN
 PERFORM set_config('app.current_org_id',p_org::text,true);
 IF NOT EXISTS(SELECT 1 FROM organizations WHERE id=p_org) THEN RAISE EXCEPTION 'unknown billing workspace'; END IF;
 SELECT plan_tier,subscription_status INTO old_plan,old_status FROM organizations WHERE id=p_org FOR UPDATE;
 INSERT INTO billing_sync_targets(org_id,customer_id) VALUES(p_org,p_customer)
 ON CONFLICT(org_id) DO UPDATE SET customer_id=EXCLUDED.customer_id
 WHERE billing_sync_targets.customer_id IS NULL OR billing_sync_targets.customer_id=EXCLUDED.customer_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'billing customer binding conflict'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_subscriptions) LOOP
  sub_id:=item->>'id';
  INSERT INTO subscriptions(org_id,provider,customer_id,subscription_id,plan_tier,status,current_period_end,cancel_at_period_end,product_id,current_period_start,pending_update,last_synced_at)
  VALUES(p_org,'polar',p_customer,sub_id,item->>'epure_plan',item->>'status',(item->>'current_period_end')::timestamptz,
   COALESCE((item->>'cancel_at_period_end')::boolean,false),item->>'product_id',(item->>'current_period_start')::timestamptz,NULLIF(item->'pending_update','null'::jsonb),now())
  ON CONFLICT(subscription_id) DO UPDATE SET plan_tier=EXCLUDED.plan_tier,status=EXCLUDED.status,current_period_end=EXCLUDED.current_period_end,
   cancel_at_period_end=EXCLUDED.cancel_at_period_end,product_id=EXCLUDED.product_id,current_period_start=EXCLUDED.current_period_start,
   pending_update=EXCLUDED.pending_update,last_synced_at=now(),updated_at=now()
  WHERE subscriptions.org_id=p_org AND subscriptions.customer_id=p_customer;
  IF NOT FOUND THEN RAISE EXCEPTION 'billing subscription binding conflict'; END IF;
 END LOOP;
 UPDATE subscriptions SET status=CASE WHEN p_status='deleted' THEN 'deleted' ELSE 'canceled' END,last_synced_at=now(),updated_at=now()
 WHERE org_id=p_org AND provider='polar' AND customer_id=p_customer AND subscription_id NOT LIKE 'trial_%'
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_subscriptions) x WHERE x->>'id'=subscriptions.subscription_id);
 -- Mirror subscriptions independently of access. In particular, past_due stays past_due.
 IF p_active IS NOT NULL THEN
  UPDATE organizations SET plan_tier=p_plan,subscription_id=p_active,subscription_status=p_status,canary_expires_at=NULL WHERE id=p_org;
 ELSIF EXISTS(SELECT 1 FROM subscriptions WHERE org_id=p_org AND provider='polar' AND customer_id=p_customer AND subscription_id NOT LIKE 'trial_%')
    OR EXISTS(SELECT 1 FROM organizations WHERE id=p_org AND subscription_id IS NOT NULL) THEN
  UPDATE organizations SET plan_tier='oss',subscription_id=NULL,subscription_status=p_status WHERE id=p_org;
 END IF;
 UPDATE billing_sync_targets SET last_synced_at=now(),next_sync_at=now()+interval '5 minutes',attempts=0,last_error=NULL,
  drift_count=drift_count+CASE WHEN EXISTS(SELECT 1 FROM organizations WHERE id=p_org AND (plan_tier<>old_plan OR subscription_status<>old_status)) THEN 1 ELSE 0 END WHERE org_id=p_org;
END;
$$;
REVOKE ALL ON FUNCTION billing_apply_snapshot(uuid,text,jsonb,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing_apply_snapshot(uuid,text,jsonb,text,text,text) TO epure_app;
CREATE FUNCTION billing_register_customer(p_org uuid,p_customer text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM organizations WHERE id=p_org) THEN
  INSERT INTO billing_sync_targets(org_id,customer_id) VALUES(p_org,p_customer) ON CONFLICT DO NOTHING;
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION billing_register_customer(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing_register_customer(uuid,text) TO epure_app;
