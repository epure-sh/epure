-- One-time billing notices per org and period (quota 80/100%, trial ending/ended).
CREATE TABLE IF NOT EXISTS billing_notices (
    org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period text NOT NULL,
    kind text NOT NULL CHECK (kind IN ('quota_80', 'quota_100', 'trial_ending', 'trial_ended')),
    sent_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (org_id, period, kind)
);
ALTER TABLE billing_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON billing_notices FROM PUBLIC;

-- Owners and admins receive billing notices.
CREATE OR REPLACE FUNCTION billing_org_admin_emails(p_org uuid)
RETURNS TABLE (email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT u.email::text
    FROM org_members m
    JOIN users u ON u.id = m.user_id
    WHERE m.org_id = p_org AND m.role IN ('owner', 'admin') AND u.email IS NOT NULL
    ORDER BY m.role DESC, u.email;
$$;
REVOKE ALL ON FUNCTION billing_org_admin_emails(uuid) FROM PUBLIC;
