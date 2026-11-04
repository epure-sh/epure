-- Migration: Elite Ingest and Full-Stack Product Surface
-- 1. Unconditional unique index and rich grouping metadata on issues
-- 2. Project grouping configuration
-- 3. Debug IDs on release_artifacts and chunk upload table for sentry-cli
-- 4. In-RAM tag facet sink and release health aggregation tables

-- 1. Issues schema & unconditional unique index
DROP INDEX IF EXISTS issues_project_fingerprint_idx;
DROP INDEX IF EXISTS uq_issues_project_fingerprint_unresolved;

-- Disambiguate historical merged rows if any duplicate fingerprints exist
UPDATE issues
SET fingerprint = fingerprint || ':merged:' || id::text
WHERE merge_parent_id IS NOT NULL
  AND id IN (
    SELECT i1.id FROM issues i1
    JOIN issues i2 ON i1.project_id = i2.project_id AND i1.fingerprint = i2.fingerprint AND i1.id <> i2.id
    WHERE i1.merge_parent_id IS NOT NULL
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_issues_project_fingerprint
    ON issues (project_id, fingerprint);

ALTER TABLE issues
    ADD COLUMN IF NOT EXISTS grouping_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS user_hll BYTEA NOT NULL DEFAULT '\x'::bytea;

-- Resilient RLS policies with NULLIF
DROP POLICY IF EXISTS issues_tenant ON issues;
CREATE POLICY issues_tenant ON issues
    FOR ALL
    USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

DROP POLICY IF EXISTS events_tenant ON events;
CREATE POLICY events_tenant ON events
    FOR ALL
    USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

DROP POLICY IF EXISTS issue_counters_tenant ON issue_counters;
CREATE POLICY issue_counters_tenant ON issue_counters
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = issue_counters.project_id
              AND p.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = issue_counters.project_id
              AND p.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
        )
    );

DROP POLICY IF EXISTS issue_unique_users_tenant ON issue_unique_users;
CREATE POLICY issue_unique_users_tenant ON issue_unique_users
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM issues i
            WHERE i.id = issue_unique_users.issue_id
              AND i.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM issues i
            WHERE i.id = issue_unique_users.issue_id
              AND i.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
        )
    );

DROP POLICY IF EXISTS releases_tenant ON releases;
CREATE POLICY releases_tenant ON releases
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = releases.project_id
              AND p.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = releases.project_id
              AND p.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
        )
    );

DROP POLICY IF EXISTS release_artifacts_tenant ON release_artifacts;
CREATE POLICY release_artifacts_tenant ON release_artifacts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM releases r
            INNER JOIN projects p ON p.id = r.project_id
            WHERE r.id = release_artifacts.release_id
              AND p.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM releases r
            INNER JOIN projects p ON p.id = r.project_id
            WHERE r.id = release_artifacts.release_id
              AND p.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
        )
    );

-- 2. Projects grouping configuration
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS grouping_config JSONB NOT NULL DEFAULT '{"in_app_include":[],"fan_in_threshold":8,"simhash_threshold":3}'::jsonb;

-- 3. Release artifacts debug_id and chunk uploads for sentry-cli / bundlers
ALTER TABLE release_artifacts
    ADD COLUMN IF NOT EXISTS debug_id TEXT;

CREATE INDEX IF NOT EXISTS release_artifacts_debug_id_idx
    ON release_artifacts (debug_id)
    WHERE debug_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS artifact_upload_chunks (
    org_id UUID NOT NULL,
    sha1 TEXT NOT NULL,
    data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (org_id, sha1)
);

-- 4. High-Performance Tag Facet Table
CREATE TABLE IF NOT EXISTS issue_tag_facets (
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    tag_key TEXT NOT NULL,
    tag_value TEXT NOT NULL,
    count BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (issue_id, tag_key, tag_value)
);

CREATE INDEX IF NOT EXISTS issue_tag_facets_key_count_idx
    ON issue_tag_facets (issue_id, tag_key, count DESC);

-- 5. Session Release Health Aggregation Buckets
CREATE TABLE IF NOT EXISTS release_health_buckets (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    release TEXT NOT NULL,
    environment TEXT NOT NULL,
    bucket_minute TIMESTAMPTZ NOT NULL,
    sessions_started BIGINT NOT NULL DEFAULT 0,
    sessions_crashed BIGINT NOT NULL DEFAULT 0,
    sessions_errored BIGINT NOT NULL DEFAULT 0,
    duration_ms_p50 INTEGER,
    PRIMARY KEY (project_id, release, environment, bucket_minute)
);

CREATE INDEX IF NOT EXISTS release_health_buckets_lookup_idx
    ON release_health_buckets (project_id, release, environment, bucket_minute DESC);

-- RLS & Security Policies
ALTER TABLE artifact_upload_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_tag_facets ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_health_buckets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'artifact_upload_chunks_tenant' AND tablename = 'artifact_upload_chunks'
    ) THEN
        CREATE POLICY artifact_upload_chunks_tenant ON artifact_upload_chunks
            FOR ALL
            USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'issue_tag_facets_tenant' AND tablename = 'issue_tag_facets'
    ) THEN
        CREATE POLICY issue_tag_facets_tenant ON issue_tag_facets
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM issues i
                    WHERE i.id = issue_tag_facets.issue_id
                      AND i.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'release_health_buckets_tenant' AND tablename = 'release_health_buckets'
    ) THEN
        CREATE POLICY release_health_buckets_tenant ON release_health_buckets
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM projects p
                    WHERE p.id = release_health_buckets.project_id
                      AND p.org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
                )
            );
    END IF;
END $$;

-- Role grants
DO $$
BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE ON artifact_upload_chunks, issue_tag_facets, release_health_buckets TO epure_ingest, epure_app;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION ingest_lookup_org_id(p_org_slug text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM organizations
    WHERE NULLIF(p_org_slug, '') IS NULL
       OR id::text = p_org_slug
       OR LOWER(name) = LOWER(p_org_slug)
       OR LOWER(REPLACE(name, ' ', '-')) = LOWER(p_org_slug)
       OR LOWER(REPLACE(name, '_', '-')) = LOWER(p_org_slug)
    ORDER BY created_at ASC
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION ingest_lookup_project_by_slug(p_org_id uuid, p_project_slug text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM projects
    WHERE org_id = p_org_id
      AND (
           NULLIF(p_project_slug, '') IS NULL
           OR id::text = p_project_slug
           OR LOWER(slug) = LOWER(p_project_slug)
           OR LOWER(name) = LOWER(p_project_slug)
           OR LOWER(REPLACE(name, ' ', '-')) = LOWER(p_project_slug)
      )
    ORDER BY created_at ASC
    LIMIT 1;
$$;

DO $$
BEGIN
    REVOKE ALL ON FUNCTION ingest_lookup_org_id(text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION ingest_lookup_org_id(text) TO epure_ingest, epure_app;

    REVOKE ALL ON FUNCTION ingest_lookup_project_by_slug(uuid, text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION ingest_lookup_project_by_slug(uuid, text) TO epure_ingest, epure_app;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;
