-- Public client registration contains metadata, never credentials. OAuth grants have a fixed local MCP resource audience.
CREATE TABLE oauth_clients(client_id text PRIMARY KEY,client_name text NOT NULL,redirect_uris jsonb NOT NULL,verified_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON oauth_clients FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON oauth_clients TO epure_app;
ALTER TABLE oauth_authorizations ADD COLUMN resource_path text NOT NULL DEFAULT '/mcp' CHECK(resource_path='/mcp');
CREATE FUNCTION oauth_mcp_token_audience(p_token uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT a.resource_path FROM oauth_authorizations a JOIN oauth_tokens t ON t.authorization_id=a.id
 WHERE t.agent_token_id=p_token AND t.revoked_at IS NULL AND a.revoked_at IS NULL AND t.expires_at>now()
$$;
REVOKE ALL ON FUNCTION oauth_mcp_token_audience(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION oauth_mcp_token_audience(uuid) TO epure_app;
