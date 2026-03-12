-- Expand built-in alert kinds (automatic engine rules, not user-created).

ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_kind_check;

ALTER TABLE alerts
    ADD CONSTRAINT alerts_kind_check
    CHECK (kind IN (
        'velocity_spike',
        'regression',
        'new_issue',
        'event_milestone',
        'users_affected',
        'ingest_cap_hit'
    ));
