GRANT CREATE ON SCHEMA public TO epure_ingest;

ALTER TABLE events OWNER TO epure_ingest;

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
        EXECUTE format('ALTER TABLE %I OWNER TO epure_ingest', child_name);
    END LOOP;
END
$$;
