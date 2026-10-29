-- Cron monitors: identity, schedule metadata, guardrails, pause, timeout status

ALTER TABLE monitors
    ADD COLUMN IF NOT EXISTS name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) DEFAULT 'UTC',
    ADD COLUMN IF NOT EXISTS checkin_margin_mins INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS max_runtime_mins INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN IF NOT EXISTS failure_issue_threshold INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS paused BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(32),
    ADD COLUMN IF NOT EXISTS next_check_in_at TIMESTAMPTZ;

-- Expand allowed status values (timeout = hung past max_runtime)
ALTER TABLE monitors DROP CONSTRAINT IF EXISTS monitors_status_check;
ALTER TABLE monitors
    ADD CONSTRAINT monitors_status_check
    CHECK (status IN ('ok', 'in_progress', 'error', 'missed', 'timeout'));

ALTER TABLE monitor_check_ins
    ADD COLUMN IF NOT EXISTS release VARCHAR(255),
    ADD COLUMN IF NOT EXISTS issue_id UUID,
    ADD COLUMN IF NOT EXISTS trace_id VARCHAR(128);

UPDATE monitors SET name = slug WHERE name IS NULL;
UPDATE monitors SET timezone = 'UTC' WHERE timezone IS NULL;
UPDATE monitors
SET schedule_type = CASE
    WHEN schedule IS NULL THEN NULL
    WHEN schedule ~* '^every\s+\d+' THEN 'interval'
    ELSE 'crontab'
END
WHERE schedule_type IS NULL AND schedule IS NOT NULL;
