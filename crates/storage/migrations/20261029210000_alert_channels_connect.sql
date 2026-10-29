-- Output-channel connect: test metadata + richer config for linked webhooks / email.

ALTER TABLE alert_channels
    ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_test_status TEXT;

ALTER TABLE alert_channels DROP CONSTRAINT IF EXISTS alert_channels_last_test_status_check;
ALTER TABLE alert_channels
    ADD CONSTRAINT alert_channels_last_test_status_check
    CHECK (
        last_test_status IS NULL
        OR last_test_status IN ('ok', 'fail')
    );
