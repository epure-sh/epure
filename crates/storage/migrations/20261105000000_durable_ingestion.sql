-- Durable admission, seven-day SDK-ID receipts, bounded backlog and leased recovery.
CREATE TABLE ingest_inbox (
 org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 event_id uuid NOT NULL, job jsonb, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','done','dead')),
 created_at timestamptz NOT NULL DEFAULT now(), available_at timestamptz NOT NULL DEFAULT now(),
 lease_token uuid, leased_until timestamptz, attempts integer NOT NULL DEFAULT 0,
 last_error text, bytes bigint NOT NULL,
 PRIMARY KEY(project_id,event_id)
);
CREATE INDEX ingest_inbox_pending ON ingest_inbox(available_at,created_at) WHERE status IN ('pending','processing');
CREATE INDEX ingest_inbox_expiry ON ingest_inbox(created_at) WHERE status='done';
ALTER TABLE ingest_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_inbox FORCE ROW LEVEL SECURITY;
CREATE POLICY ingest_inbox_tenant ON ingest_inbox USING(org_id=NULLIF(current_setting('app.current_org_id',true),'')::uuid);
GRANT SELECT, UPDATE ON ingest_inbox TO epure_ingest;
CREATE TABLE ingest_backlog_budget(org_id uuid PRIMARY KEY, pending_count bigint NOT NULL DEFAULT 0 CHECK(pending_count>=0), pending_bytes bigint NOT NULL DEFAULT 0 CHECK(pending_bytes>=0));
CREATE TABLE ingest_group_aliases(org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, raw_key text NOT NULL, fingerprint text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(project_id,raw_key));
ALTER TABLE ingest_group_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_group_aliases FORCE ROW LEVEL SECURITY;
CREATE POLICY ingest_group_aliases_tenant ON ingest_group_aliases USING(org_id=NULLIF(current_setting('app.current_org_id',true),'')::uuid);
GRANT SELECT,INSERT ON ingest_group_aliases TO epure_ingest;

CREATE FUNCTION ingest_enqueue(p_org uuid,p_project uuid,p_event uuid,p_job jsonb,p_global_bytes bigint,p_org_bytes bigint) RETURNS text
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
 INSERT INTO ingest_inbox(org_id,project_id,event_id,job,bytes) VALUES(p_org,p_project,p_event,p_job,sz);
 UPDATE ingest_backlog_budget SET pending_count=pending_count+1,pending_bytes=pending_bytes+sz WHERE org_id IN(z,p_org);
 RETURN 'accepted';
END $$;
CREATE FUNCTION ingest_claim(p_limit integer) RETURNS SETOF ingest_inbox
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 WITH selected AS (
 SELECT project_id,event_id FROM ingest_inbox WHERE (status='pending' AND available_at<=now()) OR (status='processing' AND leased_until<=now())
 ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT LEAST(GREATEST(p_limit,1),64)
 ) UPDATE ingest_inbox i SET status='processing',lease_token=gen_random_uuid(),leased_until=now()+interval '2 minutes',attempts=attempts+1
 FROM selected s WHERE i.project_id=s.project_id AND i.event_id=s.event_id RETURNING i.*;
$$;
CREATE FUNCTION ingest_finish(p_project uuid,p_event uuid,p_token uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r ingest_inbox; z uuid:='00000000-0000-0000-0000-000000000000';
BEGIN
 -- Budget locks always precede receipt locks, matching admission lock order.
 PERFORM 1 FROM ingest_backlog_budget WHERE org_id=z FOR UPDATE;
 SELECT * INTO r FROM ingest_inbox WHERE project_id=p_project AND event_id=p_event FOR UPDATE;
 IF r.status<>'processing' OR r.lease_token IS DISTINCT FROM p_token THEN RETURN false; END IF;
 UPDATE ingest_backlog_budget SET pending_count=pending_count-1,pending_bytes=pending_bytes-r.bytes WHERE org_id IN(z,r.org_id);
 UPDATE ingest_inbox SET status='done',job=NULL,bytes=0,lease_token=NULL,leased_until=NULL,last_error=NULL WHERE project_id=p_project AND event_id=p_event;
 RETURN true;
END $$;
CREATE FUNCTION ingest_retry(p_project uuid,p_event uuid,p_token uuid,p_error text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE ingest_inbox SET status=CASE WHEN attempts>=20 THEN 'dead' ELSE 'pending' END,
 available_at=now()+make_interval(secs=>LEAST(300,power(2,LEAST(attempts,8))::integer)),leased_until=NULL,lease_token=NULL,last_error=left(p_error,200)
 WHERE project_id=p_project AND event_id=p_event AND lease_token=p_token AND status='processing';
$$;
CREATE FUNCTION ingest_backlog_stats() RETURNS TABLE(pending bigint,bytes bigint,dead bigint,oldest_ms bigint)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE((SELECT pending_count FROM ingest_backlog_budget WHERE org_id='00000000-0000-0000-0000-000000000000'),0),
 COALESCE((SELECT pending_bytes FROM ingest_backlog_budget WHERE org_id='00000000-0000-0000-0000-000000000000'),0),
 (SELECT count(*) FROM ingest_inbox WHERE status='dead'),
 COALESCE((SELECT (extract(epoch FROM now()-min(created_at))*1000)::bigint FROM ingest_inbox WHERE status IN('pending','processing')),0);
$$;
REVOKE ALL ON FUNCTION ingest_enqueue(uuid,uuid,uuid,jsonb,bigint,bigint),ingest_claim(integer),ingest_finish(uuid,uuid,uuid),ingest_retry(uuid,uuid,uuid,text),ingest_backlog_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ingest_enqueue(uuid,uuid,uuid,jsonb,bigint,bigint),ingest_claim(integer),ingest_finish(uuid,uuid,uuid),ingest_retry(uuid,uuid,uuid,text),ingest_backlog_stats() TO epure_ingest;
CREATE FUNCTION ingest_lock_budget() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT 1 FROM ingest_backlog_budget WHERE org_id='00000000-0000-0000-0000-000000000000' FOR UPDATE; $$;
REVOKE ALL ON FUNCTION ingest_lock_budget() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ingest_lock_budget() TO epure_ingest;
