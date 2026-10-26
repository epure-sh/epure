-- Monthly stored-event count for ingest plan enforcement (epure_ingest cannot rely on RLS context).

CREATE OR REPLACE FUNCTION ingest_org_monthly_stored_events(p_org_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COUNT(*)::bigint
    FROM events
    WHERE org_id = p_org_id
      AND created_at >= date_trunc('month', timezone('UTC', now()))
      AND created_at < date_trunc('month', timezone('UTC', now())) + interval '1 month';
$$;

REVOKE ALL ON FUNCTION ingest_org_monthly_stored_events(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ingest_org_monthly_stored_events(uuid) TO epure_ingest;
