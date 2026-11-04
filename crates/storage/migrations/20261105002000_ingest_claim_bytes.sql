CREATE OR REPLACE FUNCTION ingest_claim(p_limit integer) RETURNS SETOF ingest_inbox
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 WITH candidates AS MATERIALIZED (
 SELECT project_id,event_id,bytes,available_at,created_at FROM ingest_inbox WHERE
 (status='pending' AND available_at<=now()) OR (status='processing' AND leased_until<=now())
 ORDER BY available_at,created_at,project_id,event_id LIMIT LEAST(GREATEST(p_limit,1),64)
 ), bounded AS (
 SELECT *,sum(bytes) OVER(ORDER BY available_at,created_at,project_id,event_id) total_bytes,
 row_number() OVER(ORDER BY available_at,created_at,project_id,event_id) seq FROM candidates
 ), selected AS (
 SELECT i.project_id,i.event_id FROM ingest_inbox i JOIN bounded b USING(project_id,event_id)
 WHERE (b.total_bytes<=8*1024*1024 OR b.seq=1)
 AND ((i.status='pending' AND i.available_at<=now()) OR (i.status='processing' AND i.leased_until<=now()))
 FOR UPDATE OF i SKIP LOCKED
 ) UPDATE ingest_inbox i SET status='processing',lease_token=gen_random_uuid(),leased_until=now()+interval '2 minutes',attempts=attempts+1
 FROM selected s WHERE i.project_id=s.project_id AND i.event_id=s.event_id RETURNING i.*;
$$;
