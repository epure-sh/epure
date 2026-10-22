-- Email Alert Settings per project + Multi-Org Workspace Switching

-- 1. Add email alert settings columns to projects table
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS email_alerts_enabled BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS email_alert_recipients TEXT[] DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS email_alert_on_regression BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS email_alert_on_spike BOOLEAN NOT NULL DEFAULT true;

-- 2. SECURITY DEFINER function to list all organizations a user belongs to
CREATE OR REPLACE FUNCTION auth_list_user_organizations(p_user_id uuid)
RETURNS TABLE (
    org_id uuid,
    name text,
    role text,
    plan_tier text,
    member_count bigint,
    created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        o.id AS org_id,
        o.name,
        om.role,
        o.plan_tier,
        (SELECT COUNT(*)::bigint FROM org_members m WHERE m.org_id = o.id) AS member_count,
        om.created_at
    FROM organizations o
    INNER JOIN org_members om ON om.org_id = o.id
    WHERE om.user_id = p_user_id
    ORDER BY om.created_at ASC;
$$;

REVOKE ALL ON FUNCTION auth_list_user_organizations(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_list_user_organizations(uuid) TO epure_app;

-- 3. SECURITY DEFINER function to verify membership when switching organization
CREATE OR REPLACE FUNCTION auth_verify_org_membership(p_user_id uuid, p_org_id uuid)
RETURNS TABLE (
    org_id uuid,
    name text,
    role text,
    plan_tier text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        o.id AS org_id,
        o.name,
        om.role,
        o.plan_tier
    FROM organizations o
    INNER JOIN org_members om ON om.org_id = o.id
    WHERE om.user_id = p_user_id AND om.org_id = p_org_id
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION auth_verify_org_membership(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_verify_org_membership(uuid, uuid) TO epure_app;

-- 4. SECURITY DEFINER function to retrieve project email alert settings during ingest or server lifecycle
CREATE OR REPLACE FUNCTION ingest_get_project_email_alert_settings(p_project_id uuid, p_org_id uuid)
RETURNS TABLE (
    email_alerts_enabled boolean,
    email_alert_recipients text[],
    email_alert_on_regression boolean,
    email_alert_on_spike boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        p.email_alerts_enabled,
        p.email_alert_recipients,
        p.email_alert_on_regression,
        p.email_alert_on_spike
    FROM projects p
    WHERE p.id = p_project_id AND p.org_id = p_org_id
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION ingest_get_project_email_alert_settings(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ingest_get_project_email_alert_settings(uuid, uuid) TO epure_ingest, epure_app;

