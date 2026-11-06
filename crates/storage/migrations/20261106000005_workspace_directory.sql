-- A billing link never grants access to projects or membership in the billing workspace.
ALTER TABLE organizations ADD COLUMN billing_workspace_id uuid REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE organizations ADD CONSTRAINT organizations_billing_workspace_not_self CHECK (billing_workspace_id<>id);
CREATE INDEX organizations_billing_workspace_idx ON organizations(billing_workspace_id) WHERE billing_workspace_id IS NOT NULL;

CREATE FUNCTION auth_scale_billing_workspace(p_user uuid, p_current uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT o.id FROM org_members m JOIN organizations o ON o.id=m.org_id
    WHERE m.user_id=p_user AND m.role='owner' AND o.billing_workspace_id IS NULL
      AND o.plan_tier='scale' AND o.subscription_status='active'
      AND o.subscription_id IS NOT NULL AND o.canary_expires_at IS NULL
    ORDER BY (o.id=COALESCE((SELECT billing_workspace_id FROM organizations WHERE id=p_current),p_current)) DESC,
        m.created_at, o.id
    LIMIT 1
$$;

CREATE FUNCTION auth_create_workspace(p_user uuid, p_billing_workspace uuid, p_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE workspace_id uuid := gen_random_uuid();
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('workspace-owner:' || p_user::text,0));
    -- Serialize with plan updates and refuse a request for a different billing account.
    PERFORM pg_advisory_xact_lock(hashtextextended('polar:' || p_billing_workspace::text,0));
    IF length(btrim(p_name)) NOT BETWEEN 1 AND 64
        OR auth_scale_billing_workspace(p_user,p_billing_workspace) IS DISTINCT FROM p_billing_workspace
        OR p_billing_workspace IS NULL THEN
        RETURN NULL;
    END IF;
    INSERT INTO organizations(id, name, slug, plan_tier, subscription_status, billing_workspace_id)
    VALUES (workspace_id, btrim(p_name), workspace_id::text, 'oss', 'none', p_billing_workspace);
    INSERT INTO org_members(org_id, user_id, role) VALUES(workspace_id,p_user,'owner');
    RETURN workspace_id;
END;
$$;

CREATE FUNCTION auth_rename_workspace(p_user uuid, p_org uuid, p_name text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
    WITH changed AS (
        UPDATE organizations SET name=btrim(p_name)
        WHERE id=p_org AND length(btrim(p_name)) BETWEEN 1 AND 64 AND EXISTS(
            SELECT 1 FROM org_members WHERE org_id=p_org AND user_id=p_user AND role='owner'
        ) RETURNING id
    )
    SELECT EXISTS(SELECT 1 FROM changed)
$$;

CREATE FUNCTION auth_delete_empty_workspace(p_user uuid, p_current uuid, p_org uuid, p_name text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE workspace organizations%ROWTYPE;
BEGIN
    -- Serialize with checkout and other workspace deletions by this owner.
    PERFORM pg_advisory_xact_lock(hashtextextended('workspace-owner:' || p_user::text,0));
    PERFORM pg_advisory_xact_lock(hashtextextended('polar:' || p_org::text,0));
    SELECT * INTO workspace FROM organizations WHERE id=p_org FOR UPDATE;
    IF NOT FOUND OR NOT EXISTS(
        SELECT 1 FROM org_members WHERE org_id=p_org AND user_id=p_user AND role='owner'
    ) THEN
        RETURN 'forbidden';
    END IF;
    IF workspace.name<>p_name OR p_org=p_current OR NOT EXISTS(
        SELECT 1 FROM org_members WHERE user_id=p_user AND org_id=p_current
    ) OR EXISTS(SELECT 1 FROM projects WHERE org_id=p_org)
      OR EXISTS(SELECT 1 FROM org_members WHERE org_id=p_org AND user_id<>p_user)
      OR EXISTS(SELECT 1 FROM organizations WHERE parent_agency_id=p_org OR billing_workspace_id=p_org)
      OR workspace.subscription_id IS NOT NULL
      OR EXISTS(SELECT 1 FROM subscriptions WHERE org_id=p_org)
      OR EXISTS(SELECT 1 FROM billing_sync_targets WHERE org_id=p_org AND customer_id IS NOT NULL)
    THEN
        RETURN 'blocked';
    END IF;
    DELETE FROM organizations WHERE id=p_org;
    RETURN 'deleted';
END;
$$;

REVOKE ALL ON FUNCTION auth_scale_billing_workspace(uuid,uuid), auth_create_workspace(uuid,uuid,text),
    auth_rename_workspace(uuid,uuid,text), auth_delete_empty_workspace(uuid,uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_scale_billing_workspace(uuid,uuid), auth_create_workspace(uuid,uuid,text),
    auth_rename_workspace(uuid,uuid,text), auth_delete_empty_workspace(uuid,uuid,uuid,text) TO epure_app;

CREATE FUNCTION auth_has_other_owned_workspaces(p_user uuid, p_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS(SELECT 1 FROM org_members WHERE user_id=p_user AND org_id<>p_org AND role='owner')
$$;
REVOKE ALL ON FUNCTION auth_has_other_owned_workspaces(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_has_other_owned_workspaces(uuid,uuid) TO epure_app;

CREATE FUNCTION ingest_billing_workspace(p_org uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT COALESCE(billing_workspace_id,id) FROM organizations WHERE id=p_org
$$;
REVOKE ALL ON FUNCTION ingest_billing_workspace(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ingest_billing_workspace(uuid) TO epure_ingest,epure_app;

CREATE OR REPLACE FUNCTION ingest_org_billing(p_org uuid)
RETURNS TABLE(plan_tier text, subscription_status text, trial_ends_at timestamptz, canary_expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT
        CASE WHEN o.billing_workspace_id IS NULL THEN o.plan_tier
             WHEN b.plan_tier='scale' AND b.subscription_id IS NOT NULL
                 AND b.subscription_status IN ('active','past_due') THEN 'scale' ELSE 'oss' END,
        CASE WHEN o.billing_workspace_id IS NULL THEN o.subscription_status ELSE b.subscription_status END,
        CASE WHEN o.billing_workspace_id IS NULL THEN o.trial_ends_at END,
        CASE WHEN o.billing_workspace_id IS NULL THEN o.canary_expires_at END
    FROM organizations o LEFT JOIN organizations b ON b.id=o.billing_workspace_id
    WHERE o.id=p_org
$$;

CREATE OR REPLACE FUNCTION ingest_org_monthly_stored_events(p_org_id uuid) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT count(*)::bigint FROM organizations o JOIN events e ON e.org_id=o.id
    WHERE (o.id=ingest_billing_workspace(p_org_id) OR o.billing_workspace_id=ingest_billing_workspace(p_org_id))
      AND e.created_at >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      AND e.created_at < (date_trunc('month', now() AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC'
$$;

CREATE OR REPLACE FUNCTION billing_clamp_retention(p_pro_days int, p_scale_days int)
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
    WITH clamped AS (
        UPDATE projects p SET retention_days = CASE WHEN o.plan_tier='scale' THEN p_scale_days ELSE p_pro_days END
        FROM organizations o WHERE o.id=p.org_id AND o.billing_workspace_id IS NULL
          AND p.retention_days > CASE WHEN o.plan_tier='scale' THEN p_scale_days ELSE p_pro_days END
        RETURNING 1
    )
    SELECT count(*) FROM clamped
$$;

CREATE FUNCTION billing_linked_workspaces(p_org uuid) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT id FROM organizations WHERE billing_workspace_id=p_org
$$;
REVOKE ALL ON FUNCTION billing_linked_workspaces(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing_linked_workspaces(uuid) TO epure_app;

CREATE OR REPLACE FUNCTION billing_register_customer(p_org uuid,p_customer text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
    PERFORM set_config('app.current_org_id',p_org::text,true);
    IF EXISTS(SELECT 1 FROM organizations WHERE id=p_org AND billing_workspace_id IS NULL) THEN
        INSERT INTO billing_sync_targets(org_id,customer_id) VALUES(p_org,p_customer)
        ON CONFLICT DO NOTHING;
        UPDATE billing_sync_targets SET customer_id=p_customer,next_sync_at=now()
        WHERE org_id=p_org AND customer_id IS NULL AND NOT EXISTS(
            SELECT 1 FROM billing_sync_targets WHERE customer_id=p_customer
        );
    END IF;
END;
$$;
