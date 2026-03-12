-- Security hardening: no ingest BYPASSRLS, FORCE RLS, identity RLS,
-- membership-bound GUCs, partition helpers, composite FKs, grants.

-- Passwords for epure_ingest / epure_app are NOT set here; they come from env
-- (EPURE_INGEST_DATABASE_URL / EPURE_APP_DATABASE_URL) or local compose.

ALTER ROLE epure_ingest NOBYPASSRLS;

REVOKE CREATE ON SCHEMA public FROM epure_ingest;

ALTER TABLE events OWNER TO epure_app;

DO $$
DECLARE
    child_name text;
BEGIN
    FOR child_name IN
        SELECT c.relname::text
        FROM pg_inherits i
        INNER JOIN pg_class c ON c.oid = i.inhrelid
        INNER JOIN pg_class p ON p.oid = i.inhparent
        WHERE p.relname = 'events'
    LOOP
        EXECUTE format('ALTER TABLE %I OWNER TO epure_app', child_name);
    END LOOP;
END
$$;

-- Postgres 16: RLS on a partitioned table applies to partitions; FORCE on the
-- parent is the supported control. Also FORCE existing children for defense.
ALTER TABLE events FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
    child_name text;
BEGIN
    FOR child_name IN
        SELECT c.relname::text
        FROM pg_inherits i
        INNER JOIN pg_class c ON c.oid = i.inhrelid
        INNER JOIN pg_class p ON p.oid = i.inhparent
        WHERE p.relname = 'events'
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', child_name);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', child_name);
    END LOOP;
END
$$;

ALTER TABLE projects FORCE ROW LEVEL SECURITY;
ALTER TABLE issues FORCE ROW LEVEL SECURITY;
ALTER TABLE releases FORCE ROW LEVEL SECURITY;
ALTER TABLE release_artifacts FORCE ROW LEVEL SECURITY;
ALTER TABLE dsn_keys FORCE ROW LEVEL SECURITY;
ALTER TABLE issue_unique_users FORCE ROW LEVEL SECURITY;
ALTER TABLE webhooks FORCE ROW LEVEL SECURITY;
ALTER TABLE alerts FORCE ROW LEVEL SECURITY;
ALTER TABLE user_feedback FORCE ROW LEVEL SECURITY;
ALTER TABLE user_setup_progress FORCE ROW LEVEL SECURITY;
ALTER TABLE alert_user_states FORCE ROW LEVEL SECURITY;
ALTER TABLE alert_suppressions FORCE ROW LEVEL SECURITY;
ALTER TABLE alert_rules FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Identity + counters RLS
-- ---------------------------------------------------------------------------

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members FORCE ROW LEVEL SECURITY;
ALTER TABLE org_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE issue_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_counters FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_tenant ON organizations;
CREATE POLICY organizations_tenant ON organizations
    FOR ALL
    USING (id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (id = current_setting('app.current_org_id', true)::uuid);

DROP POLICY IF EXISTS users_tenant ON users;
CREATE POLICY users_tenant ON users
    FOR ALL
    USING (
        id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR EXISTS (
            SELECT 1 FROM org_members om
            WHERE om.user_id = users.id
              AND om.org_id = current_setting('app.current_org_id', true)::uuid
        )
    )
    WITH CHECK (
        id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR EXISTS (
            SELECT 1 FROM org_members om
            WHERE om.user_id = users.id
              AND om.org_id = current_setting('app.current_org_id', true)::uuid
        )
    );

DROP POLICY IF EXISTS org_members_tenant ON org_members;
CREATE POLICY org_members_tenant ON org_members
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

DROP POLICY IF EXISTS org_invitations_tenant ON org_invitations;
CREATE POLICY org_invitations_tenant ON org_invitations
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

DROP POLICY IF EXISTS issue_counters_tenant ON issue_counters;
CREATE POLICY issue_counters_tenant ON issue_counters
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = issue_counters.project_id
              AND p.org_id = current_setting('app.current_org_id', true)::uuid
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = issue_counters.project_id
              AND p.org_id = current_setting('app.current_org_id', true)::uuid
        )
    );

DROP POLICY IF EXISTS alert_user_states_tenant ON alert_user_states;
CREATE POLICY alert_user_states_tenant ON alert_user_states
    FOR ALL
    USING (
        user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND EXISTS (
            SELECT 1 FROM alerts a
            WHERE a.id = alert_user_states.alert_id
              AND a.org_id = current_setting('app.current_org_id', true)::uuid
        )
    )
    WITH CHECK (
        user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND EXISTS (
            SELECT 1 FROM alerts a
            WHERE a.id = alert_user_states.alert_id
              AND a.org_id = current_setting('app.current_org_id', true)::uuid
        )
    );

-- ---------------------------------------------------------------------------
-- Composite FKs (cannot bind another org's project)
-- ---------------------------------------------------------------------------

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_org_id_id_key;
ALTER TABLE projects ADD CONSTRAINT projects_org_id_id_key UNIQUE (org_id, id);

ALTER TABLE alert_rules DROP CONSTRAINT IF EXISTS alert_rules_org_project_fk;
ALTER TABLE alert_rules
    ADD CONSTRAINT alert_rules_org_project_fk
    FOREIGN KEY (org_id, project_id) REFERENCES projects (org_id, id)
    ON DELETE CASCADE;

ALTER TABLE user_setup_progress DROP CONSTRAINT IF EXISTS user_setup_progress_org_project_fk;
ALTER TABLE user_setup_progress
    ADD CONSTRAINT user_setup_progress_org_project_fk
    FOREIGN KEY (org_id, project_id) REFERENCES projects (org_id, id)
    ON DELETE CASCADE;

DROP POLICY IF EXISTS alert_rules_tenant ON alert_rules;
CREATE POLICY alert_rules_tenant ON alert_rules
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (
        org_id = current_setting('app.current_org_id', true)::uuid
        AND EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = alert_rules.project_id
              AND p.org_id = alert_rules.org_id
              AND p.org_id = current_setting('app.current_org_id', true)::uuid
        )
    );

DROP POLICY IF EXISTS user_setup_progress_tenant ON user_setup_progress;
CREATE POLICY user_setup_progress_tenant ON user_setup_progress
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::uuid)
    WITH CHECK (
        org_id = current_setting('app.current_org_id', true)::uuid
        AND EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = user_setup_progress.project_id
              AND p.org_id = user_setup_progress.org_id
              AND p.org_id = current_setting('app.current_org_id', true)::uuid
        )
    );

-- ---------------------------------------------------------------------------
-- Session store (tower-sessions-sqlx-store)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tower_sessions (
    id TEXT PRIMARY KEY,
    data BYTEA NOT NULL,
    expiry_date TIMESTAMPTZ NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON tower_sessions TO epure_app;

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_set_org_context(p_user_id uuid, p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM org_members
        WHERE user_id = p_user_id AND org_id = p_org_id
    ) THEN
        RAISE EXCEPTION 'membership required' USING ERRCODE = '42501';
    END IF;
    PERFORM set_config('app.current_org_id', p_org_id::text, true);
    PERFORM set_config('app.current_user_id', p_user_id::text, true);
END;
$$;

CREATE OR REPLACE FUNCTION ingest_set_org_context(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = p_org_id) THEN
        RAISE EXCEPTION 'unknown org' USING ERRCODE = '42501';
    END IF;
    PERFORM set_config('app.current_org_id', p_org_id::text, true);
    PERFORM set_config('app.current_user_id', '', true);
END;
$$;

CREATE OR REPLACE FUNCTION ingest_lookup_dsn(p_public_key text)
RETURNS TABLE (
    project_id uuid,
    org_id uuid,
    secret_key bytea,
    revoked_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT d.project_id, p.org_id, d.secret_key, d.revoked_at
    FROM dsn_keys d
    INNER JOIN projects p ON p.id = d.project_id
    WHERE d.public_key = p_public_key
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION ingest_project_meta(p_project_id uuid)
RETURNS TABLE (
    org_id uuid,
    name text,
    ingest_cap_per_hour int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p.org_id, p.name, p.ingest_cap_per_hour
    FROM projects p
    WHERE p.id = p_project_id;
$$;

CREATE OR REPLACE FUNCTION auth_lookup_user_by_email(p_email citext)
RETURNS TABLE (
    id uuid,
    email text,
    password_hash bytea,
    google_sub text,
    display_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id, u.email::text, u.password_hash, u.google_sub, u.display_name
    FROM users u
    WHERE u.email = p_email
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_lookup_user_by_id(p_id uuid)
RETURNS TABLE (
    id uuid,
    email text,
    password_hash bytea,
    google_sub text,
    display_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id, u.email::text, u.password_hash, u.google_sub, u.display_name
    FROM users u
    WHERE u.id = p_id
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_lookup_user_by_google_sub(p_sub text)
RETURNS TABLE (
    user_id uuid,
    email text,
    org_id uuid,
    role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id, u.email::text, om.org_id, om.role
    FROM users u
    INNER JOIN org_members om ON om.user_id = u.id
    WHERE u.google_sub = p_sub
    ORDER BY om.created_at ASC
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_lookup_membership(p_user_id uuid)
RETURNS TABLE (org_id uuid, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT om.org_id, om.role
    FROM org_members om
    WHERE om.user_id = p_user_id
    ORDER BY om.created_at ASC
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_lookup_invitation(p_token_hash bytea)
RETURNS TABLE (
    id uuid,
    org_id uuid,
    role text,
    email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT i.id, i.org_id, i.role, i.email::text
    FROM org_invitations i
    WHERE i.token_hash = p_token_hash
      AND i.accepted_at IS NULL
      AND i.expires_at > now()
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_insert_user(
    p_id uuid,
    p_email citext,
    p_password_hash bytea,
    p_google_sub text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO users (id, email, password_hash, google_sub)
    VALUES (p_id, p_email, p_password_hash, p_google_sub);
END;
$$;

CREATE OR REPLACE FUNCTION auth_link_google_sub(p_user_id uuid, p_sub text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE users SET google_sub = p_sub WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION auth_set_password(p_user_id uuid, p_password_hash bytea)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE users SET password_hash = p_password_hash WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION auth_set_display_name(p_user_id uuid, p_display_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE users SET display_name = p_display_name WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION auth_bootstrap_workspace(
    p_user_id uuid,
    p_org_id uuid,
    p_org_name text,
    p_project_name text,
    p_slug text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO organizations (id, name) VALUES (p_org_id, p_org_name);
    INSERT INTO projects (id, org_id, name, slug, retention_days)
    VALUES (gen_random_uuid(), p_org_id, p_project_name, p_slug, 30);
    INSERT INTO org_members (org_id, user_id, role)
    VALUES (p_org_id, p_user_id, 'owner');
END;
$$;

CREATE OR REPLACE FUNCTION auth_accept_invitation(
    p_invitation_id uuid,
    p_user_id uuid,
    p_org_id uuid,
    p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO org_members (org_id, user_id, role)
    VALUES (p_org_id, p_user_id, p_role)
    ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;
    UPDATE org_invitations SET accepted_at = now() WHERE id = p_invitation_id;
END;
$$;

CREATE OR REPLACE FUNCTION auth_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM users WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION ensure_event_partition(p_year int, p_month int)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    start_d date;
    end_d date;
    part_name text;
BEGIN
    IF p_month < 1 OR p_month > 12 OR p_year < 1990 OR p_year > 2100 THEN
        RAISE EXCEPTION 'invalid partition month';
    END IF;
    start_d := make_date(p_year, p_month, 1);
    end_d := (start_d + INTERVAL '1 month')::date;
    part_name := format('events_%s_%s', p_year::text, lpad(p_month::text, 2, '0'));
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF events FOR VALUES FROM (%L) TO (%L)',
        part_name,
        start_d,
        end_d
    );
    EXECUTE format('ALTER TABLE %I OWNER TO epure_app', part_name);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', part_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', part_name);
    RETURN part_name;
END;
$$;

CREATE OR REPLACE FUNCTION drop_event_partition(p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_name IS NULL OR p_name !~ '^events_[0-9]{4}_[0-9]{2}$' THEN
        RAISE EXCEPTION 'invalid partition name';
    END IF;
    EXECUTE format('DROP TABLE IF EXISTS %I', p_name);
END;
$$;

REVOKE ALL ON FUNCTION app_set_org_context(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_set_org_context(uuid, uuid) TO epure_app;

REVOKE ALL ON FUNCTION ingest_set_org_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ingest_set_org_context(uuid) TO epure_ingest;

REVOKE ALL ON FUNCTION ingest_lookup_dsn(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ingest_lookup_dsn(text) TO epure_ingest;

REVOKE ALL ON FUNCTION ingest_project_meta(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ingest_project_meta(uuid) TO epure_ingest;

REVOKE ALL ON FUNCTION auth_lookup_user_by_email(citext) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_user_by_email(citext) TO epure_app;

REVOKE ALL ON FUNCTION auth_lookup_user_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_user_by_id(uuid) TO epure_app;

REVOKE ALL ON FUNCTION auth_lookup_user_by_google_sub(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_user_by_google_sub(text) TO epure_app;

REVOKE ALL ON FUNCTION auth_lookup_membership(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_membership(uuid) TO epure_app;

REVOKE ALL ON FUNCTION auth_lookup_invitation(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_invitation(bytea) TO epure_app;

REVOKE ALL ON FUNCTION auth_insert_user(uuid, citext, bytea, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_insert_user(uuid, citext, bytea, text) TO epure_app;

REVOKE ALL ON FUNCTION auth_link_google_sub(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_link_google_sub(uuid, text) TO epure_app;

REVOKE ALL ON FUNCTION auth_set_password(uuid, bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_set_password(uuid, bytea) TO epure_app;

REVOKE ALL ON FUNCTION auth_set_display_name(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_set_display_name(uuid, text) TO epure_app;

REVOKE ALL ON FUNCTION auth_bootstrap_workspace(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_bootstrap_workspace(uuid, uuid, text, text, text) TO epure_app;

REVOKE ALL ON FUNCTION auth_accept_invitation(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_accept_invitation(uuid, uuid, uuid, text) TO epure_app;

REVOKE ALL ON FUNCTION auth_delete_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_delete_user(uuid) TO epure_app;

REVOKE ALL ON FUNCTION ensure_event_partition(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ensure_event_partition(int, int) TO epure_ingest, epure_app;

REVOKE ALL ON FUNCTION drop_event_partition(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION drop_event_partition(text) TO epure_ingest, epure_app;

-- ---------------------------------------------------------------------------
-- Default privileges: stop auto-granting future tables to ingest
-- ---------------------------------------------------------------------------

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM epure_ingest;

REVOKE SELECT, INSERT, UPDATE, DELETE ON
    users, org_members, org_invitations, organizations, tower_sessions
    FROM epure_ingest;

GRANT SELECT, INSERT, UPDATE, DELETE ON
    projects, issues, events, releases, release_artifacts, dsn_keys,
    issue_unique_users, issue_counters, webhooks, alerts, user_feedback,
    alert_rules, alert_suppressions
    TO epure_ingest;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO epure_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO epure_app, epure_ingest;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS issues_org_last_seen_idx
    ON issues (org_id, last_seen_at DESC)
    WHERE merge_parent_id IS NULL;

CREATE INDEX IF NOT EXISTS dsn_keys_project_id_idx ON dsn_keys (project_id);

CREATE INDEX IF NOT EXISTS org_invitations_token_hash_pending_idx
    ON org_invitations (token_hash)
    WHERE accepted_at IS NULL;

CREATE INDEX IF NOT EXISTS events_issue_user_email_idx ON events (issue_id, user_email);
