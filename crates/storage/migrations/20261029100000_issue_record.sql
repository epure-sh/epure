-- Issue rollup used by the inbox, plus a closed set of workflow statuses.
-- Snooze stays an overlay (snooze_until / pre_snooze_status) and is not a status.

ALTER TABLE issues
    ADD COLUMN IF NOT EXISTS culprit TEXT,
    ADD COLUMN IF NOT EXISTS platform TEXT,
    ADD COLUMN IF NOT EXISTS is_unhandled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS first_release TEXT,
    ADD COLUMN IF NOT EXISTS last_release TEXT,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS regressed_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS latest_event_id UUID,
    ADD COLUMN IF NOT EXISTS environments JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS issue_number BIGINT,
    ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'low',
    ADD COLUMN IF NOT EXISTS priority_score INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS priority_locked BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check;
ALTER TABLE issues
    ADD CONSTRAINT issues_status_check
    CHECK (status IN ('unresolved', 'resolved', 'ignored', 'regression'));

CREATE TABLE IF NOT EXISTS project_issue_seq (
    project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    last_number BIGINT NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE, DELETE ON project_issue_seq TO epure_ingest, epure_app;

ALTER TABLE project_issue_seq ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_issue_seq FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_issue_seq_tenant ON project_issue_seq;
CREATE POLICY project_issue_seq_tenant ON project_issue_seq
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_issue_seq.project_id
              AND p.org_id = current_setting('app.current_org_id', true)::uuid
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = project_issue_seq.project_id
              AND p.org_id = current_setting('app.current_org_id', true)::uuid
        )
    );

ALTER TABLE issue_unique_users
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS event_count INT NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION next_issue_number(p_project_id uuid)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
    allocated bigint;
BEGIN
    INSERT INTO project_issue_seq (project_id, last_number)
    VALUES (p_project_id, 1)
    ON CONFLICT (project_id) DO UPDATE
        SET last_number = project_issue_seq.last_number + 1
    RETURNING last_number INTO allocated;
    RETURN allocated;
END;
$$;

REVOKE ALL ON FUNCTION next_issue_number(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION next_issue_number(uuid) TO epure_ingest, epure_app;

CREATE OR REPLACE FUNCTION issue_priority_score(
    p_level text,
    p_unhandled boolean,
    p_status text,
    p_events bigint,
    p_users integer
) RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT LEAST(100, GREATEST(0,
        CASE COALESCE(p_level, 'error')
            WHEN 'fatal' THEN 40
            WHEN 'error' THEN 25
            WHEN 'warning' THEN 10
            ELSE 0
        END
        + CASE WHEN COALESCE(p_unhandled, false) THEN 20 ELSE 0 END
        + CASE WHEN p_status = 'regression' THEN 15 ELSE 0 END
        + LEAST(GREATEST(COALESCE(p_events, 0), 0), 100)::integer / 5
        + LEAST(GREATEST(COALESCE(p_users, 0), 0), 20)
    ));
$$;

CREATE OR REPLACE FUNCTION issue_priority_label(p_score integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_score >= 80 THEN 'critical'
        WHEN p_score >= 50 THEN 'high'
        WHEN p_score >= 25 THEN 'medium'
        ELSE 'low'
    END;
$$;

REVOKE ALL ON FUNCTION issue_priority_score(text, boolean, text, bigint, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION issue_priority_label(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION issue_priority_score(text, boolean, text, bigint, integer) TO epure_ingest, epure_app;
GRANT EXECUTE ON FUNCTION issue_priority_label(integer) TO epure_ingest, epure_app;
