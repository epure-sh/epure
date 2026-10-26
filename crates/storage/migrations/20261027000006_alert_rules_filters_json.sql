-- Optional rule filters (level, first-seen) for custom alert rules UI.
ALTER TABLE alert_rules
    ADD COLUMN IF NOT EXISTS filters_json JSONB NOT NULL DEFAULT '{}'::jsonb;
