-- The priority score is computed in the ingest worker from the last 24 hourly
-- buckets. Drop the earlier flat SQL formula so there is one definition.

ALTER TABLE issues
    ADD COLUMN IF NOT EXISTS priority_pattern TEXT;

DROP FUNCTION IF EXISTS issue_priority_score(text, boolean, text, bigint, integer);
DROP FUNCTION IF EXISTS issue_priority_label(integer);
