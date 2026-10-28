-- Multi-resolution grouping. Existing rows keep their fingerprint; new events
-- fill the locus signatures. Defaults let older INSERT statements keep working.
ALTER TABLE issues
    ADD COLUMN IF NOT EXISTS h_exact BIGINT,
    ADD COLUMN IF NOT EXISTS h_locus BIGINT,
    ADD COLUMN IF NOT EXISTS h_sim BIGINT,
    ADD COLUMN IF NOT EXISTS exception_type TEXT,
    ADD COLUMN IF NOT EXISTS merge_reason TEXT NOT NULL DEFAULT 'exact_stack',
    ADD COLUMN IF NOT EXISTS coalesced_variants JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS spike_coalesced BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS grouping_anchor JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS issues_project_locus_idx
    ON issues (project_id, h_locus)
    WHERE merge_parent_id IS NULL AND h_locus IS NOT NULL;
