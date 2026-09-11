-- Post-process heavy seed: backdate events, sync issue timestamps, apply lifecycle states,
-- merges, supplemental alerts, and user feedback.

\echo 'Post-processing heavy seed (timestamps, statuses, merges, alerts)...'

-- Spread event timestamps across the last 30 days (per-issue distribution).
WITH ranked AS (
    SELECT
        e.id,
        e.issue_id,
        ROW_NUMBER() OVER (PARTITION BY e.issue_id ORDER BY e.created_at) AS rn,
        COUNT(*) OVER (PARTITION BY e.issue_id) AS cnt,
        COALESCE(
            NULLIF(e.payload_json->'tags'->>'seed_age_days', '')::int,
            7
        ) AS age_days
    FROM events e
    WHERE e.project_id IN (
        '550e8400-e29b-41d4-a716-446655440000',
        '660e8400-e29b-41d4-a716-446655440001',
        '770e8400-e29b-41d4-a716-446655440002'
    )
)
UPDATE events e
SET occurred_at = GREATEST(
    date_trunc('month', now()),
    now()
        - LEAST(r.age_days, 14) * interval '1 day'
        - ((r.cnt - r.rn)::float / GREATEST(r.cnt, 1) * interval '2 days')
        - ((r.rn % 6) * interval '1 hour')
)
FROM ranked r
WHERE e.id = r.id;

-- Sync issue first/last seen from events.
UPDATE issues i
SET
    first_seen_at = stats.first_seen,
    last_seen_at = stats.last_seen
FROM (
    SELECT
        issue_id,
        MIN(occurred_at) AS first_seen,
        MAX(occurred_at) AS last_seen
    FROM events
    GROUP BY issue_id
) stats
WHERE i.id = stats.issue_id;

-- Apply seed_status from event tags.
UPDATE issues i
SET status = tag.status
FROM (
    SELECT DISTINCT ON (e.issue_id)
        e.issue_id,
        e.payload_json->'tags'->>'seed_status' AS status
    FROM events e
    WHERE e.payload_json->'tags'->>'seed_status' IS NOT NULL
    ORDER BY e.issue_id, e.occurred_at DESC
) tag
WHERE i.id = tag.issue_id
  AND tag.status IS NOT NULL
  AND tag.status <> '';

-- Resolved issues need resolved_in_release for regression narrative.
UPDATE issues
SET resolved_in_release = release
WHERE status = 'resolved'
  AND resolved_in_release IS NULL;

-- Snooze auth token cluster until 100 events.
UPDATE issues i
SET
    snooze_until = NULL,
    snooze_until_count = 100,
    snooze_until_users = NULL
FROM events e
WHERE i.id = e.issue_id
  AND e.payload_json->'tags'->>'seed_snooze' = 'until_count:100';

-- Snooze checkout rate-limit for 24 hours.
UPDATE issues i
SET
    snooze_until = now() + interval '24 hours',
    snooze_until_count = NULL,
    snooze_until_users = NULL
FROM events e
WHERE i.id = e.issue_id
  AND e.payload_json->'tags'->>'seed_snooze' = 'until_hours:24';

-- Snooze mobile crash until 50 users.
UPDATE issues i
SET
    snooze_until = NULL,
    snooze_until_count = NULL,
    snooze_until_users = 50
FROM events e
WHERE i.id = e.issue_id
  AND e.payload_json->'tags'->>'seed_snooze' = 'until_users:50';

-- Merge child issues into canonical parent (by seed_merge_into slug).
WITH merge_pairs AS (
    SELECT
        child.id AS child_id,
        parent.id AS parent_id
    FROM issues child
    JOIN events ce ON ce.issue_id = child.id
    JOIN issues parent ON parent.project_id = child.project_id
    JOIN events pe ON pe.issue_id = parent.id
    WHERE child.merge_parent_id IS NULL
      AND parent.merge_parent_id IS NULL
      AND child.id <> parent.id
      AND ce.payload_json->'tags'->>'seed_merge_into' IS NOT NULL
      AND pe.payload_json->'tags'->>'seed_slug'
          = ce.payload_json->'tags'->>'seed_merge_into'
)
UPDATE issues child
SET merge_parent_id = mp.parent_id
FROM merge_pairs mp
WHERE child.id = mp.child_id;

-- Rebuild issue_counters hourly buckets from backdated events.
DELETE FROM issue_counters
WHERE project_id IN (
    '550e8400-e29b-41d4-a716-446655440000',
    '660e8400-e29b-41d4-a716-446655440001',
    '770e8400-e29b-41d4-a716-446655440002'
);

INSERT INTO issue_counters (project_id, fingerprint, window_start, count, bodies_stored)
SELECT
    i.project_id,
    i.fingerprint,
    date_trunc('hour', e.occurred_at) AS window_start,
    COUNT(*)::bigint,
    COUNT(*)::bigint
FROM events e
JOIN issues i ON i.id = e.issue_id
WHERE i.merge_parent_id IS NULL
GROUP BY i.project_id, i.fingerprint, date_trunc('hour', e.occurred_at)
ON CONFLICT (project_id, fingerprint, window_start)
DO UPDATE SET
    count = EXCLUDED.count,
    bodies_stored = EXCLUDED.bodies_stored;

-- Supplemental alerts for dashboard UX (velocity, milestones, users affected).
INSERT INTO alerts (org_id, project_id, issue_id, kind, fired_at, payload_json)
SELECT
    i.org_id,
    i.project_id,
    i.id,
    'velocity_spike',
    i.last_seen_at - interval '2 hours',
    jsonb_build_object(
        'title', i.title,
        'current_window', 47,
        'previous_window', 8,
        'ratio', 5.875
    )
FROM issues i
WHERE i.project_id = '550e8400-e29b-41d4-a716-446655440000'
  AND i.title LIKE 'TypeError: Cannot read properties of undefined (reading ''price'')%'
  AND i.merge_parent_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM alerts a
      WHERE a.issue_id = i.id AND a.kind = 'velocity_spike'
  );

INSERT INTO alerts (org_id, project_id, issue_id, kind, fired_at, payload_json)
SELECT
    i.org_id,
    i.project_id,
    i.id,
    'event_milestone',
    i.last_seen_at - interval '4 hours',
    jsonb_build_object(
        'title', i.title,
        'threshold', 100,
        'event_count', i.event_count
    )
FROM issues i
WHERE i.event_count >= 100
  AND i.merge_parent_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM alerts a
      WHERE a.issue_id = i.id AND a.kind = 'event_milestone'
  )
LIMIT 5;

INSERT INTO alerts (org_id, project_id, issue_id, kind, fired_at, payload_json)
SELECT
    i.org_id,
    i.project_id,
    i.id,
    'users_affected',
    i.last_seen_at - interval '6 hours',
    jsonb_build_object(
        'title', i.title,
        'threshold', 20,
        'unique_user_count', i.unique_user_count
    )
FROM issues i
WHERE i.unique_user_count >= 20
  AND i.merge_parent_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM alerts a
      WHERE a.issue_id = i.id AND a.kind = 'users_affected'
  )
LIMIT 5;

-- User feedback on high-traffic checkout/payment issues.
DELETE FROM user_feedback
WHERE project_id IN (
    '550e8400-e29b-41d4-a716-446655440000',
    '660e8400-e29b-41d4-a716-446655440001',
    '770e8400-e29b-41d4-a716-446655440002'
);

INSERT INTO user_feedback (event_id, project_id, name, email, comments)
SELECT
    e.id,
    e.project_id,
    'Alice Chen',
    'alice@acme-corp.com',
    'Checkout broke right after I clicked Place order — cart showed items but total was blank.'
FROM events e
WHERE e.payload_json->'tags'->>'seed_feedback' = 'true'
ORDER BY e.occurred_at DESC
LIMIT 1;

INSERT INTO user_feedback (event_id, project_id, name, email, comments)
SELECT
    e.id,
    e.project_id,
    'Bob Martinez',
    'bob@acme-corp.com',
    'Card was charged twice according to my bank app. Payment screen showed a spinner forever.'
FROM events e
WHERE e.payload_json->'tags'->>'seed_slug' = 'browser-payment-api-failed'
ORDER BY e.occurred_at DESC
LIMIT 1;
