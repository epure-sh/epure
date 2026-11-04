CREATE TABLE ingest_body_budget(project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,hour timestamptz NOT NULL,stored bigint NOT NULL,PRIMARY KEY(project_id,hour));
CREATE OR REPLACE FUNCTION ingest_enqueue(p_org uuid,p_project uuid,p_event uuid,p_job jsonb,p_global_bytes bigint,p_org_bytes bigint) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n bigint; sz bigint:=octet_length(p_job::text); z uuid:='00000000-0000-0000-0000-000000000000';
BEGIN
 IF NOT EXISTS(SELECT 1 FROM projects WHERE id=p_project AND org_id=p_org) THEN RAISE EXCEPTION 'invalid ingest project'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_project::text||p_event::text,73));
 IF EXISTS(SELECT 1 FROM ingest_inbox WHERE project_id=p_project AND event_id=p_event) THEN RETURN 'duplicate'; END IF;
 INSERT INTO ingest_backlog_budget(org_id) VALUES(z),(p_org) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM ingest_backlog_budget WHERE org_id=z FOR UPDATE;
 PERFORM 1 FROM ingest_backlog_budget WHERE org_id=p_org FOR UPDATE;
 IF EXISTS(SELECT 1 FROM ingest_backlog_budget WHERE (org_id=z AND (pending_bytes+sz>p_global_bytes OR pending_count>=100000)) OR (org_id=p_org AND (pending_bytes+sz>p_org_bytes OR pending_count>=25000))) THEN RETURN 'full'; END IF;
 IF p_job ? 'StoreEvent' THEN
   INSERT INTO ingest_body_budget(project_id,hour,stored) SELECT p_project,date_trunc('hour',now()),COALESCE(sum(bodies_stored),0) FROM issue_counters WHERE project_id=p_project AND window_start=date_trunc('hour',now()) ON CONFLICT DO NOTHING;
   IF (SELECT stored FROM ingest_body_budget WHERE project_id=p_project AND hour=date_trunc('hour',now())) >= (SELECT ingest_cap_per_hour FROM projects WHERE id=p_project) THEN RETURN 'cap'; END IF;
   UPDATE ingest_body_budget SET stored=stored+1 WHERE project_id=p_project AND hour=date_trunc('hour',now());
 END IF;
 INSERT INTO ingest_inbox(org_id,project_id,event_id,job,bytes) VALUES(p_org,p_project,p_event,p_job,sz);
 UPDATE ingest_backlog_budget SET pending_count=pending_count+1,pending_bytes=pending_bytes+sz WHERE org_id IN(z,p_org);
 RETURN 'accepted';
END $$;

CREATE FUNCTION ingest_deleted_job_budget() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.status<>'done' THEN PERFORM ingest_lock_budget();PERFORM ingest_release_budget(OLD.org_id,1,OLD.bytes); END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION ingest_deleted_job_budget() FROM PUBLIC;
CREATE TRIGGER ingest_deleted_job_budget AFTER DELETE ON ingest_inbox FOR EACH ROW EXECUTE FUNCTION ingest_deleted_job_budget();
CREATE INDEX ingest_inbox_dead ON ingest_inbox(created_at) WHERE status='dead';
