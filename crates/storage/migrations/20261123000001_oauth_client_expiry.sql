-- Self-registered OAuth clients (RFC 7591, used by MCP clients) that never
-- completed an authorization expire after 7 days. Registration stays open so
-- Claude, Cursor and Codex can still connect; unused registrations don't pile up.
CREATE FUNCTION oauth_expire_unused_registered_clients() RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  WITH gone AS (
    DELETE FROM oauth_clients c
    WHERE c.client_id LIKE 'epure\_registered\_%'
      AND c.verified_at < now() - interval '7 days'
      AND NOT EXISTS (SELECT 1 FROM oauth_authorizations a WHERE a.client_id = c.client_id)
      AND NOT EXISTS (SELECT 1 FROM oauth_codes o WHERE o.client_id = c.client_id)
    RETURNING 1
  )
  SELECT count(*)::integer FROM gone
$$;
REVOKE ALL ON FUNCTION oauth_expire_unused_registered_clients() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION oauth_expire_unused_registered_clients() TO epure_app;
