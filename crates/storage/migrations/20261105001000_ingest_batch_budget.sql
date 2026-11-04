CREATE FUNCTION ingest_release_budget(p_org uuid,p_count bigint,p_bytes bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_count<0 OR p_bytes<0 THEN RAISE EXCEPTION 'invalid budget decrement'; END IF;
 UPDATE ingest_backlog_budget SET pending_count=pending_count-p_count,pending_bytes=pending_bytes-p_bytes
 WHERE org_id IN ('00000000-0000-0000-0000-000000000000'::uuid,p_org);
END $$;
REVOKE ALL ON FUNCTION ingest_release_budget(uuid,bigint,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ingest_release_budget(uuid,bigint,bigint) TO epure_ingest;
