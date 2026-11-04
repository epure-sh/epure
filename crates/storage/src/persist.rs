use chrono::{DateTime, Timelike, Utc};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::counters::SyncCounterParams;
use crate::events::InsertEventParams;
use crate::issues::{IssueLifecycleState, UpsertIssueParams};
use crate::rls;
use crate::StorageError;

pub struct PersistCounterOnly {
    pub org_id: Uuid,
    pub project_id: Uuid,
    pub fingerprint: String,
    pub occurred_at: DateTime<Utc>,
    pub window_start: DateTime<Utc>,
}

pub struct PersistStoreEvent {
    pub upsert: UpsertIssueParams,
    pub event: InsertEventParams,
    pub user_key: Option<String>,
    pub counter: SyncCounterParams,
}

pub struct PersistOutcome {
    pub issue_id: Uuid,
    pub prior: Option<IssueLifecycleState>,
    pub prior_user_count: i32,
    pub new_unique_user: bool,
}

pub async fn persist_counter_only(
    pool: &PgPool,
    params: PersistCounterOnly,
) -> Result<(Option<IssueLifecycleState>, Uuid), sqlx::Error> {
    let mut tx = rls::begin_ingest_transaction(pool, params.org_id).await?;
    let prior =
        get_issue_by_fingerprint_in_tx(&mut tx, params.project_id, &params.fingerprint).await?;
    let issue_id = upsert_issue_in_tx(
        &mut tx,
        UpsertIssueParams {
            org_id: params.org_id,
            project_id: params.project_id,
            fingerprint: params.fingerprint.clone(),
            title: None,
            level: None,
            environment: None,
            release: None,
            occurred_at: params.occurred_at,
            increment_by: 1,
            grouping: None,
            rollup: crate::issues::IssueRollup::default(),
        },
    )
    .await?;
    sync_counter_in_tx(
        &mut tx,
        SyncCounterParams {
            project_id: params.project_id,
            fingerprint: params.fingerprint,
            window_start: params.window_start,
            count_delta: 1,
            bodies_stored_delta: 0,
        },
    )
    .await?;
    refresh_issue_priority_in_tx(&mut tx, issue_id, Utc::now()).await?;
    tx.commit().await?;
    Ok((prior, issue_id))
}

pub struct PersistCounterDelta {
    pub org_id: Uuid,
    pub project_id: Uuid,
    pub fingerprint: String,
    pub count_delta: i64,
    pub occurred_at: DateTime<Utc>,
    pub window_start: DateTime<Utc>,
    pub variants: Vec<String>,
}

pub async fn persist_counter_delta(
    pool: &PgPool,
    params: PersistCounterDelta,
) -> Result<Uuid, sqlx::Error> {
    let mut tx = rls::begin_ingest_transaction(pool, params.org_id).await?;
    let issue_id = upsert_issue_in_tx(
        &mut tx,
        UpsertIssueParams {
            org_id: params.org_id,
            project_id: params.project_id,
            fingerprint: params.fingerprint.clone(),
            title: None,
            level: None,
            environment: None,
            release: None,
            occurred_at: params.occurred_at,
            increment_by: params.count_delta,
            grouping: Some(crate::issues::IssueGrouping {
                h_exact: None,
                h_locus: None,
                h_sim: None,
                exception_type: None,
                merge_reason: None,
                grouping_anchor: None,
                variants: serde_json::Value::Array(
                    params
                        .variants
                        .iter()
                        .map(|label| serde_json::Value::String(label.clone()))
                        .collect(),
                ),
                spike_coalesced_delta: params.count_delta,
            }),
            rollup: crate::issues::IssueRollup::default(),
        },
    )
    .await?;
    sync_counter_in_tx(
        &mut tx,
        SyncCounterParams {
            project_id: params.project_id,
            fingerprint: params.fingerprint,
            window_start: params.window_start,
            count_delta: params.count_delta,
            bodies_stored_delta: 0,
        },
    )
    .await?;
    refresh_issue_priority_in_tx(&mut tx, issue_id, Utc::now()).await?;
    tx.commit().await?;
    Ok(issue_id)
}

pub async fn persist_store_event(
    pool: &PgPool,
    params: PersistStoreEvent,
) -> Result<PersistOutcome, sqlx::Error> {
    let mut tx = rls::begin_ingest_transaction(pool, params.upsert.org_id).await?;
    let prior = get_issue_by_fingerprint_in_tx(
        &mut tx,
        params.upsert.project_id,
        &params.upsert.fingerprint,
    )
    .await?;
    let issue_id = upsert_issue_in_tx(&mut tx, params.upsert).await?;

    let mut prior_user_count = 0;
    let mut new_unique_user = false;
    if let Some(user_key) = params.user_key.as_deref() {
        prior_user_count = sqlx::query_scalar::<_, i32>(
            "SELECT unique_user_count FROM issues WHERE id = $1 AND merge_parent_id IS NULL",
        )
        .bind(issue_id)
        .fetch_optional(&mut *tx)
        .await?
        .unwrap_or(0);
        new_unique_user = record_unique_user_in_tx(&mut tx, issue_id, user_key).await?;
    }

    let mut event = params.event;
    event.issue_id = issue_id;
    insert_event_in_tx(&mut tx, &event).await?;
    sync_counter_in_tx(&mut tx, params.counter).await?;
    refresh_issue_priority_in_tx(&mut tx, issue_id, Utc::now()).await?;
    tx.commit().await?;

    Ok(PersistOutcome {
        issue_id,
        prior,
        prior_user_count,
        new_unique_user,
    })
}

pub async fn upsert_issue_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    params: UpsertIssueParams,
) -> Result<Uuid, sqlx::Error> {
    if let Some(ref version) = params.release {
        let trimmed = version.trim();
        if !trimmed.is_empty() {
            sqlx::query(
                r#"
                INSERT INTO releases (project_id, version)
                VALUES ($1, $2)
                ON CONFLICT (project_id, version) DO NOTHING
                "#,
            )
            .bind(params.project_id)
            .bind(trimmed)
            .execute(&mut **tx)
            .await?;
        }
    }

    let grouping = params.grouping.unwrap_or(crate::issues::IssueGrouping {
        h_exact: None,
        h_locus: None,
        h_sim: None,
        exception_type: None,
        merge_reason: None,
        grouping_anchor: None,
        variants: serde_json::Value::Array(Vec::new()),
        spike_coalesced_delta: 0,
    });
    let existing_number = sqlx::query_scalar::<_, Option<i64>>(
        r#"
        SELECT issue_number
        FROM issues
        WHERE project_id = $1 AND fingerprint = $2 AND merge_parent_id IS NULL
        "#,
    )
    .bind(params.project_id)
    .bind(&params.fingerprint)
    .fetch_optional(&mut **tx)
    .await?;
    let issue_number = if matches!(existing_number, None | Some(None)) {
        Some(
            sqlx::query_scalar::<_, i64>("SELECT next_issue_number($1)")
                .bind(params.project_id)
                .fetch_one(&mut **tx)
                .await?,
        )
    } else {
        None
    };
    let merge_reason = grouping.merge_reason.unwrap_or_default();
    let anchor = grouping
        .grouping_anchor
        .unwrap_or_else(|| serde_json::json!({}));

    sqlx::query_scalar(
        r#"
        INSERT INTO issues (
            org_id,
            project_id,
            fingerprint,
            title,
            level,
            environment,
            release,
            first_seen_at,
            last_seen_at,
            event_count,
            h_exact,
            h_locus,
            h_sim,
            exception_type,
            merge_reason,
            grouping_anchor,
            coalesced_variants,
            spike_coalesced,
            culprit,
            platform,
            is_unhandled,
            first_release,
            last_release,
            latest_event_id,
            environments,
            issue_number,
            priority,
            priority_score
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $8, $9,
            $10, $11, $12, $13,
            COALESCE(NULLIF($14, ''), 'exact_stack'),
            COALESCE($15, '{}'::jsonb),
            COALESCE($16, '[]'::jsonb),
            $17,
            $18, $19, $20, $7, $7, $21,
            CASE WHEN $6 IS NULL THEN '[]'::jsonb ELSE jsonb_build_array($6) END,
            $22,
            'low',
            0
        )
        ON CONFLICT (project_id, fingerprint)
        DO UPDATE SET
            title = COALESCE(EXCLUDED.title, issues.title),
            level = COALESCE(EXCLUDED.level, issues.level),
            environment = COALESCE(EXCLUDED.environment, issues.environment),
            release = COALESCE(EXCLUDED.release, issues.release),
            last_seen_at = GREATEST(issues.last_seen_at, EXCLUDED.last_seen_at),
            event_count = issues.event_count + EXCLUDED.event_count,
            h_exact = COALESCE(issues.h_exact, EXCLUDED.h_exact),
            h_locus = COALESCE(issues.h_locus, EXCLUDED.h_locus),
            h_sim = COALESCE(issues.h_sim, EXCLUDED.h_sim),
            exception_type = COALESCE(issues.exception_type, EXCLUDED.exception_type),
            merge_reason = CASE
                WHEN issues.merge_reason IN ('', 'exact_stack') THEN EXCLUDED.merge_reason
                ELSE issues.merge_reason
            END,
            grouping_anchor = CASE
                WHEN issues.grouping_anchor = '{}'::jsonb THEN EXCLUDED.grouping_anchor
                ELSE issues.grouping_anchor
            END,
            spike_coalesced = issues.spike_coalesced + EXCLUDED.spike_coalesced,
            culprit = COALESCE(issues.culprit, EXCLUDED.culprit),
            platform = COALESCE(issues.platform, EXCLUDED.platform),
            is_unhandled = issues.is_unhandled OR EXCLUDED.is_unhandled,
            first_release = COALESCE(issues.first_release, EXCLUDED.first_release),
            last_release = COALESCE(EXCLUDED.last_release, issues.last_release),
            latest_event_id = COALESCE(EXCLUDED.latest_event_id, issues.latest_event_id),
            environments = CASE
                WHEN EXCLUDED.environment IS NULL OR issues.environments ? EXCLUDED.environment
                    THEN issues.environments
                ELSE issues.environments || jsonb_build_array(EXCLUDED.environment)
            END,
            issue_number = COALESCE(issues.issue_number, EXCLUDED.issue_number),
            coalesced_variants = (
                SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
                FROM (
                    SELECT DISTINCT elem
                    FROM jsonb_array_elements(
                        CASE
                            WHEN EXCLUDED.coalesced_variants = '[]'::jsonb THEN issues.coalesced_variants
                            ELSE issues.coalesced_variants || EXCLUDED.coalesced_variants
                        END
                    ) AS elem
                    LIMIT 5
                ) AS sampled
            )
        RETURNING id
        "#,
    )
    .bind(params.org_id)
    .bind(params.project_id)
    .bind(&params.fingerprint)
    .bind(&params.title)
    .bind(&params.level)
    .bind(&params.environment)
    .bind(&params.release)
    .bind(params.occurred_at)
    .bind(params.increment_by)
    .bind(grouping.h_exact)
    .bind(grouping.h_locus)
    .bind(grouping.h_sim)
    .bind(&grouping.exception_type)
    .bind(&merge_reason)
    .bind(&anchor)
    .bind(&grouping.variants)
    .bind(grouping.spike_coalesced_delta)
    .bind(&params.rollup.culprit)
    .bind(&params.rollup.platform)
    .bind(params.rollup.is_unhandled)
    .bind(params.rollup.latest_event_id)
    .bind(issue_number)
    .fetch_one(&mut **tx)
    .await
}

pub async fn get_issue_by_fingerprint_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    project_id: Uuid,
    fingerprint: &str,
) -> Result<Option<IssueLifecycleState>, sqlx::Error> {
    sqlx::query_as::<_, IssueLifecycleState>(
        r#"
        SELECT
            id, org_id, project_id, title, level, status, release, environment,
            event_count, unique_user_count,
            resolved_in_release, snooze_until, snooze_until_count, snooze_until_users,
            pre_snooze_status, is_unhandled, priority, culprit, exception_type, platform,
            regressed_count
        FROM issues
        WHERE project_id = $1 AND fingerprint = $2 AND merge_parent_id IS NULL
        "#,
    )
    .bind(project_id)
    .bind(fingerprint)
    .fetch_optional(&mut **tx)
    .await
}

async fn insert_event_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    params: &InsertEventParams,
) -> Result<(), sqlx::Error> {
    if let Some(ref version) = params.release {
        let trimmed = version.trim();
        if !trimmed.is_empty() {
            sqlx::query(
                r#"
                INSERT INTO releases (project_id, version)
                VALUES ($1, $2)
                ON CONFLICT (project_id, version) DO NOTHING
                "#,
            )
            .bind(params.project_id)
            .bind(trimmed)
            .execute(&mut **tx)
            .await?;
        }
    }

    sqlx::query(
        r#"
        INSERT INTO events (
            id, org_id, project_id, issue_id, occurred_at,
            environment, release, platform, runtime_name, runtime_version,
            browser_name, os_name, country_code, user_id, user_email,
            payload_json, stack_frames, breadcrumbs
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        "#,
    )
    .bind(params.id)
    .bind(params.org_id)
    .bind(params.project_id)
    .bind(params.issue_id)
    .bind(params.occurred_at)
    .bind(&params.environment)
    .bind(&params.release)
    .bind(&params.platform)
    .bind(&params.runtime_name)
    .bind(&params.runtime_version)
    .bind(&params.browser_name)
    .bind(&params.os_name)
    .bind(&params.country_code)
    .bind(&params.user_id)
    .bind(&params.user_email)
    .bind(&params.payload_json)
    .bind(&params.stack_frames)
    .bind(&params.breadcrumbs)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub(crate) async fn sync_counter_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    params: SyncCounterParams,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO issue_counters (project_id, fingerprint, window_start, count, bodies_stored)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (project_id, fingerprint, window_start)
        DO UPDATE SET
            count = issue_counters.count + EXCLUDED.count,
            bodies_stored = issue_counters.bodies_stored + EXCLUDED.bodies_stored
        "#,
    )
    .bind(params.project_id)
    .bind(&params.fingerprint)
    .bind(params.window_start)
    .bind(params.count_delta)
    .bind(params.bodies_stored_delta)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn record_unique_user_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    issue_id: Uuid,
    user_key: &str,
) -> Result<bool, sqlx::Error> {
    let inserted = sqlx::query_scalar::<_, bool>(
        r#"
        INSERT INTO issue_unique_users (issue_id, user_key, first_seen_at, last_seen_at, event_count)
        VALUES ($1, $2, now(), now(), 1)
        ON CONFLICT (issue_id, user_key) DO UPDATE
        SET last_seen_at = now(),
            event_count = issue_unique_users.event_count + 1
        RETURNING (xmax = 0)
        "#,
    )
    .bind(issue_id)
    .bind(user_key)
    .fetch_one(&mut **tx)
    .await?;

    if inserted {
        sqlx::query(
            r#"
            UPDATE issues
            SET unique_user_count = unique_user_count + 1
            WHERE id = $1
            "#,
        )
        .bind(issue_id)
        .execute(&mut **tx)
        .await?;
        Ok(true)
    } else {
        Ok(false)
    }
}

pub(crate) async fn refresh_issue_priority_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    issue_id: Uuid,
    now: DateTime<Utc>,
) -> Result<(), sqlx::Error> {
    #[derive(sqlx::FromRow)]
    struct PriorityRow {
        level: Option<String>,
        is_unhandled: bool,
        status: String,
        event_count: i64,
        unique_user_count: i32,
        environment: Option<String>,
        environment_count: i32,
        first_seen_at: Option<DateTime<Utc>>,
        last_seen_at: Option<DateTime<Utc>>,
        regressed_count: i32,
        priority_locked: bool,
        project_id: Uuid,
        fingerprint: String,
    }

    let Some(row) = sqlx::query_as::<_, PriorityRow>(
        r#"
        SELECT
            level,
            is_unhandled,
            status,
            event_count,
            unique_user_count,
            environment,
            jsonb_array_length(environments)::int AS environment_count,
            first_seen_at,
            last_seen_at,
            regressed_count,
            priority_locked,
            project_id,
            fingerprint
        FROM issues
        WHERE id = $1
        "#,
    )
    .bind(issue_id)
    .fetch_optional(&mut **tx)
    .await?
    else {
        return Ok(());
    };
    if row.priority_locked {
        return Ok(());
    }

    let points: Vec<(DateTime<Utc>, i64)> = sqlx::query_as(
        r#"
        SELECT window_start, count
        FROM issue_counters
        WHERE project_id = $1 AND fingerprint = $2 AND window_start >= $3
        ORDER BY window_start ASC
        "#,
    )
    .bind(row.project_id)
    .bind(&row.fingerprint)
    .bind(now - chrono::Duration::hours(24))
    .fetch_all(&mut **tx)
    .await?;
    let hours = dense_hours(&points, now);
    let assessment = crate::issue_state::assess_priority(&crate::issue_state::PrioritySignals {
        level: row.level.as_deref(),
        unhandled: row.is_unhandled,
        status: &row.status,
        event_count: row.event_count,
        user_count: row.unique_user_count,
        environment: row.environment.as_deref(),
        environment_count: row.environment_count,
        first_seen: row.first_seen_at,
        last_seen: row.last_seen_at,
        regressed_count: row.regressed_count,
        hourly_counts: &hours,
        now,
    });

    sqlx::query(
        r#"
        UPDATE issues
        SET priority_score = $2,
            priority = $3,
            priority_pattern = $4
        WHERE id = $1 AND priority_locked = false
        "#,
    )
    .bind(issue_id)
    .bind(assessment.score)
    .bind(assessment.label)
    .bind(assessment.pattern)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

fn dense_hours(points: &[(DateTime<Utc>, i64)], now: DateTime<Utc>) -> Vec<i64> {
    let end = hour_floor(now);
    let mut counts = vec![0_i64; 24];
    for (start, count) in points {
        let ago = (end - hour_floor(*start)).num_hours();
        if (0..24).contains(&ago) {
            let index = (23 - ago) as usize;
            counts[index] = counts[index].saturating_add(*count);
        }
    }
    counts
}

fn hour_floor(time: DateTime<Utc>) -> DateTime<Utc> {
    time.date_naive()
        .and_hms_opt(time.hour(), 0, 0)
        .map(|naive| naive.and_utc())
        .unwrap_or(time)
}

/// Zero Sequence Burn on Issue Conflict:
/// Checks if an issue exists first without burning sequence numbers.
/// Follows merge_parent_id so merged issues route directly to their parent.
pub async fn resolve_or_create_issue(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    fingerprint: &str,
    params: &UpsertIssueParams,
) -> Result<(Uuid, bool), StorageError> {
    let mut tx = rls::begin_ingest_transaction(pool, org_id).await?;

    // 1. Fast read without sequence generation
    let existing = sqlx::query_as::<_, (Uuid, Option<Uuid>, String)>(
        r#"
        SELECT id, merge_parent_id, status
        FROM issues
        WHERE project_id = $1 AND fingerprint = $2
        "#,
    )
    .bind(project_id)
    .bind(fingerprint)
    .fetch_optional(&mut *tx)
    .await?;

    if let Some((id, merge_parent_id, _status)) = existing {
        tx.commit().await?;
        let final_id = merge_parent_id.unwrap_or(id);
        return Ok((final_id, false));
    }

    let id = upsert_issue_in_tx(
        &mut tx,
        UpsertIssueParams {
            org_id,
            project_id,
            fingerprint: fingerprint.to_string(),
            title: params.title.clone(),
            level: params.level.clone(),
            environment: params.environment.clone(),
            release: params.release.clone(),
            occurred_at: params.occurred_at,
            increment_by: 0,
            grouping: params.grouping.clone(),
            rollup: params.rollup.clone(),
        },
    )
    .await?;
    tx.commit().await?;
    Ok((id, true))
}

pub type IngestedEvent = InsertEventParams;

/// Batched Partitioned Event Insert using PostgreSQL UNNEST
pub async fn persist_event_batch(
    pool: &PgPool,
    events: &[IngestedEvent],
) -> Result<Vec<Uuid>, StorageError> {
    if events.is_empty() {
        return Ok(Vec::new());
    }

    let mut inserted_ids = Vec::new();
    let mut by_org: std::collections::HashMap<Uuid, Vec<&IngestedEvent>> =
        std::collections::HashMap::new();
    for ev in events {
        by_org.entry(ev.org_id).or_default().push(ev);
    }

    for (org_id, org_events) in by_org {
        let mut ids = Vec::with_capacity(org_events.len());
        let mut org_ids = Vec::with_capacity(org_events.len());
        let mut project_ids = Vec::with_capacity(org_events.len());
        let mut issue_ids = Vec::with_capacity(org_events.len());
        let mut occurred_ats = Vec::with_capacity(org_events.len());
        let mut environments = Vec::with_capacity(org_events.len());
        let mut releases = Vec::with_capacity(org_events.len());
        let mut platforms = Vec::with_capacity(org_events.len());
        let mut runtime_names = Vec::with_capacity(org_events.len());
        let mut runtime_versions = Vec::with_capacity(org_events.len());
        let mut browser_names = Vec::with_capacity(org_events.len());
        let mut os_names = Vec::with_capacity(org_events.len());
        let mut country_codes = Vec::with_capacity(org_events.len());
        let mut user_ids = Vec::with_capacity(org_events.len());
        let mut user_emails = Vec::with_capacity(org_events.len());
        let mut payload_jsons = Vec::with_capacity(org_events.len());
        let mut stack_frames = Vec::with_capacity(org_events.len());
        let mut breadcrumbs = Vec::with_capacity(org_events.len());

        for ev in org_events {
            ids.push(ev.id);
            org_ids.push(ev.org_id);
            project_ids.push(ev.project_id);
            issue_ids.push(ev.issue_id);
            occurred_ats.push(ev.occurred_at);
            environments.push(ev.environment.clone());
            releases.push(ev.release.clone());
            platforms.push(ev.platform.clone());
            runtime_names.push(ev.runtime_name.clone());
            runtime_versions.push(ev.runtime_version.clone());
            browser_names.push(ev.browser_name.clone());
            os_names.push(ev.os_name.clone());
            country_codes.push(ev.country_code.clone());
            user_ids.push(ev.user_id.clone());
            user_emails.push(ev.user_email.clone());
            payload_jsons.push(ev.payload_json.clone());
            stack_frames.push(ev.stack_frames.clone());
            breadcrumbs.push(ev.breadcrumbs.clone());
        }

        let mut tx = rls::begin_ingest_transaction(pool, org_id).await?;

        let inserted = sqlx::query_scalar::<_, Uuid>(
            r#"
            WITH inserted AS (INSERT INTO events (
                id, org_id, project_id, issue_id, occurred_at,
                environment, release, platform, runtime_name, runtime_version,
                browser_name, os_name, country_code, user_id, user_email,
                payload_json, stack_frames, breadcrumbs
            )
            SELECT * FROM UNNEST(
                $1::uuid[], $2::uuid[], $3::uuid[], $4::uuid[], $5::timestamptz[],
                $6::text[], $7::text[], $8::text[], $9::text[], $10::text[],
                $11::text[], $12::text[], $13::text[], $14::text[], $15::text[],
                $16::jsonb[], $17::jsonb[], $18::jsonb[]
            )
            ON CONFLICT (id, occurred_at) DO NOTHING
            RETURNING issue_id, project_id, occurred_at, id, environment, release, platform, browser_name, os_name, payload_json
            ), counts AS (
                SELECT issue_id, count(*)::bigint AS n, max(occurred_at) AS seen,
                       min(occurred_at) AS first_seen
                FROM inserted GROUP BY issue_id
            ), latest AS (
                SELECT DISTINCT ON (issue_id) * FROM inserted ORDER BY issue_id, occurred_at DESC, id
            ), updated AS (
                UPDATE issues i SET event_count = i.event_count + c.n,
                    last_seen_at = GREATEST(i.last_seen_at, c.seen),
                    first_seen_at = LEAST(i.first_seen_at, c.first_seen),
                    latest_event_id = CASE WHEN l.occurred_at >= i.last_seen_at THEN l.id ELSE i.latest_event_id END,
                    last_release = CASE WHEN l.occurred_at >= i.last_seen_at THEN COALESCE(l.release, i.last_release) ELSE i.last_release END,
                    release = CASE WHEN l.occurred_at >= i.last_seen_at THEN COALESCE(l.release, i.release) ELSE i.release END,
                    platform = COALESCE(i.platform, l.platform),
                    environments = CASE WHEN l.environment IS NULL OR i.environments ? l.environment THEN i.environments ELSE i.environments || jsonb_build_array(l.environment) END
                FROM counts c JOIN latest l ON l.issue_id = c.issue_id WHERE i.id = c.issue_id RETURNING i.id
            ), counters AS (
                INSERT INTO issue_counters (project_id, fingerprint, window_start, count, bodies_stored)
                SELECT e.project_id, i.fingerprint, date_trunc('hour', e.occurred_at), count(*), count(*)
                FROM inserted e JOIN issues i ON i.id = e.issue_id
                GROUP BY e.project_id, i.fingerprint, date_trunc('hour', e.occurred_at)
                ON CONFLICT (project_id, fingerprint, window_start) DO UPDATE
                SET count = issue_counters.count + EXCLUDED.count,
                    bodies_stored = issue_counters.bodies_stored + EXCLUDED.bodies_stored
            ), releases_inserted AS (
                INSERT INTO releases (project_id, version)
                SELECT DISTINCT project_id, release FROM inserted WHERE release IS NOT NULL AND release <> ''
                ON CONFLICT (project_id, version) DO NOTHING
            )
            , facets AS (INSERT INTO issue_tag_facets (issue_id, tag_key, tag_value, count)
            SELECT e.issue_id, t.key, t.value, count(*)
            FROM inserted e CROSS JOIN LATERAL jsonb_each_text(
                CASE WHEN jsonb_typeof(e.payload_json->'tags') = 'object'
                     THEN e.payload_json->'tags' ELSE '{}'::jsonb END
                || jsonb_strip_nulls(jsonb_build_object('environment', e.environment, 'release', e.release, 'browser.name', e.browser_name, 'os.name', e.os_name))
            ) t
            WHERE t.key <> '' AND t.value <> ''
            GROUP BY e.issue_id, t.key, t.value
            ON CONFLICT (issue_id, tag_key, tag_value) DO UPDATE SET
                count = issue_tag_facets.count + EXCLUDED.count, updated_at = NOW()
            ) SELECT id FROM inserted
            "#,
        )
        .bind(&ids)
        .bind(&org_ids)
        .bind(&project_ids)
        .bind(&issue_ids)
        .bind(&occurred_ats)
        .bind(&environments)
        .bind(&releases)
        .bind(&platforms)
        .bind(&runtime_names)
        .bind(&runtime_versions)
        .bind(&browser_names)
        .bind(&os_names)
        .bind(&country_codes)
        .bind(&user_ids)
        .bind(&user_emails)
        .bind(&payload_jsons)
        .bind(&stack_frames)
        .bind(&breadcrumbs)
        .fetch_all(&mut *tx)
        .await?;

        if !inserted.is_empty() {
            let mut affected = issue_ids;
            affected.sort_unstable();
            affected.dedup();
            for issue_id in affected {
                refresh_issue_priority_in_tx(&mut tx, issue_id, Utc::now()).await?;
            }
        }
        tx.commit().await?;
        inserted_ids.extend(inserted);
    }

    Ok(inserted_ids)
}

#[derive(Debug, Default, Clone)]
pub struct TelemetryDeltas {
    pub issue_counts: Vec<IssueCountDelta>,
    pub tag_facets: Vec<TagFacetDelta>,
    pub sessions: Vec<SessionBucketDelta>,
}

#[derive(Debug, Clone)]
pub struct IssueCountDelta {
    pub org_id: Uuid,
    pub project_id: Uuid,
    pub issue_id: Uuid,
    pub fingerprint: String,
    pub window_start: DateTime<Utc>,
    pub count_delta: i64,
}

#[derive(Debug, Clone)]
pub struct TagFacetDelta {
    pub org_id: Uuid,
    pub issue_id: Uuid,
    pub tag_key: String,
    pub tag_value: String,
    pub count: i64,
}

#[derive(Debug, Clone)]
pub struct SessionBucketDelta {
    pub org_id: Uuid,
    pub project_id: Uuid,
    pub release: String,
    pub environment: String,
    pub bucket_minute: DateTime<Utc>,
    pub sessions_started: i64,
    pub sessions_crashed: i64,
    pub sessions_errored: i64,
    pub duration_ms_p50: Option<i32>,
}

/// Bulk flusher for micro-batched telemetry counters, tag facets, and session health buckets
pub async fn flush_all_telemetry_deltas(
    pool: &PgPool,
    deltas: &TelemetryDeltas,
) -> Result<(), StorageError> {
    let mut tx = pool.begin().await?;
    // 1. Bulk update issues event_count and issue_counters per org
    if !deltas.issue_counts.is_empty() {
        let mut by_org: std::collections::HashMap<Uuid, Vec<&IssueCountDelta>> =
            std::collections::HashMap::new();
        for item in &deltas.issue_counts {
            by_org.entry(item.org_id).or_default().push(item);
        }

        for (org_id, org_items) in by_org {
            let mut issue_ids = Vec::with_capacity(org_items.len());
            let mut count_deltas = Vec::with_capacity(org_items.len());
            let mut project_ids = Vec::with_capacity(org_items.len());
            let mut fingerprints = Vec::with_capacity(org_items.len());
            let mut window_starts = Vec::with_capacity(org_items.len());

            for item in org_items {
                issue_ids.push(item.issue_id);
                count_deltas.push(item.count_delta);
                project_ids.push(item.project_id);
                fingerprints.push(item.fingerprint.clone());
                window_starts.push(item.window_start);
            }

            sqlx::query("SELECT ingest_set_org_context($1)")
                .bind(org_id)
                .execute(&mut *tx)
                .await?;

            sqlx::query(
                r#"
                UPDATE issues AS i
                SET event_count = i.event_count + u.delta,
                    last_seen_at = GREATEST(i.last_seen_at, NOW())
                FROM (SELECT id, SUM(delta)::bigint AS delta FROM UNNEST($1::uuid[], $2::bigint[]) AS d(id, delta) GROUP BY id) AS u
                WHERE i.id = u.id
                "#,
            )
            .bind(&issue_ids)
            .bind(&count_deltas)
            .execute(&mut *tx)
            .await?;

            sqlx::query(
                r#"
                INSERT INTO issue_counters (project_id, fingerprint, window_start, count, bodies_stored)
                SELECT u.project_id, u.fingerprint, u.window_start, SUM(u.count_delta)::bigint, 0
                FROM UNNEST($1::uuid[], $2::text[], $3::timestamptz[], $4::bigint[])
                    AS u(project_id, fingerprint, window_start, count_delta)
                GROUP BY u.project_id, u.fingerprint, u.window_start
                ON CONFLICT (project_id, fingerprint, window_start)
                DO UPDATE SET count = issue_counters.count + EXCLUDED.count
                "#,
            )
            .bind(&project_ids)
            .bind(&fingerprints)
            .bind(&window_starts)
            .bind(&count_deltas)
            .execute(&mut *tx)
            .await?;
        }
    }

    // 2. Bulk upsert tag facets per org
    if !deltas.tag_facets.is_empty() {
        let mut by_org: std::collections::HashMap<Uuid, Vec<&TagFacetDelta>> =
            std::collections::HashMap::new();
        for f in &deltas.tag_facets {
            by_org.entry(f.org_id).or_default().push(f);
        }

        for (org_id, org_facets) in by_org {
            let mut issue_ids = Vec::with_capacity(org_facets.len());
            let mut tag_keys = Vec::with_capacity(org_facets.len());
            let mut tag_values = Vec::with_capacity(org_facets.len());
            let mut counts = Vec::with_capacity(org_facets.len());

            for f in org_facets {
                issue_ids.push(f.issue_id);
                tag_keys.push(f.tag_key.clone());
                tag_values.push(f.tag_value.clone());
                counts.push(f.count);
            }

            sqlx::query("SELECT ingest_set_org_context($1)")
                .bind(org_id)
                .execute(&mut *tx)
                .await?;

            sqlx::query(
                r#"
                INSERT INTO issue_tag_facets (issue_id, tag_key, tag_value, count, updated_at)
                SELECT u.issue_id, u.tag_key, u.tag_value, u.count, NOW()
                FROM UNNEST($1::uuid[], $2::text[], $3::text[], $4::bigint[])
                    AS u(issue_id, tag_key, tag_value, count)
                ON CONFLICT (issue_id, tag_key, tag_value)
                DO UPDATE SET
                    count = issue_tag_facets.count + EXCLUDED.count,
                    updated_at = NOW()
                "#,
            )
            .bind(&issue_ids)
            .bind(&tag_keys)
            .bind(&tag_values)
            .bind(&counts)
            .execute(&mut *tx)
            .await?;
        }
    }

    // 3. Bulk upsert release health buckets per org
    if !deltas.sessions.is_empty() {
        let mut by_org: std::collections::HashMap<Uuid, Vec<&SessionBucketDelta>> =
            std::collections::HashMap::new();
        for s in &deltas.sessions {
            by_org.entry(s.org_id).or_default().push(s);
        }

        for (org_id, org_sessions) in by_org {
            let mut project_ids = Vec::with_capacity(org_sessions.len());
            let mut releases = Vec::with_capacity(org_sessions.len());
            let mut environments = Vec::with_capacity(org_sessions.len());
            let mut bucket_minutes = Vec::with_capacity(org_sessions.len());
            let mut starteds = Vec::with_capacity(org_sessions.len());
            let mut crasheds = Vec::with_capacity(org_sessions.len());
            let mut erroreds = Vec::with_capacity(org_sessions.len());
            let mut p50s = Vec::with_capacity(org_sessions.len());

            for s in org_sessions {
                project_ids.push(s.project_id);
                releases.push(s.release.clone());
                environments.push(s.environment.clone());
                bucket_minutes.push(s.bucket_minute);
                starteds.push(s.sessions_started);
                crasheds.push(s.sessions_crashed);
                erroreds.push(s.sessions_errored);
                p50s.push(s.duration_ms_p50);
            }

            sqlx::query("SELECT ingest_set_org_context($1)")
                .bind(org_id)
                .execute(&mut *tx)
                .await?;

            sqlx::query(
                r#"
                INSERT INTO release_health_buckets (
                    project_id, release, environment, bucket_minute,
                    sessions_started, sessions_crashed, sessions_errored, duration_ms_p50
                )
                SELECT u.project_id, u.release, u.environment, u.bucket_minute,
                       u.started, u.crashed, u.errored, u.p50
                FROM UNNEST(
                    $1::uuid[], $2::text[], $3::text[], $4::timestamptz[],
                    $5::bigint[], $6::bigint[], $7::bigint[], $8::integer[]
                ) AS u(project_id, release, environment, bucket_minute, started, crashed, errored, p50)
                ON CONFLICT (project_id, release, environment, bucket_minute)
                DO UPDATE SET
                    sessions_started = release_health_buckets.sessions_started + EXCLUDED.sessions_started,
                    sessions_crashed = release_health_buckets.sessions_crashed + EXCLUDED.sessions_crashed,
                    sessions_errored = release_health_buckets.sessions_errored + EXCLUDED.sessions_errored,
                    duration_ms_p50 = COALESCE(EXCLUDED.duration_ms_p50, release_health_buckets.duration_ms_p50)
                "#,
            )
            .bind(&project_ids)
            .bind(&releases)
            .bind(&environments)
            .bind(&bucket_minutes)
            .bind(&starteds)
            .bind(&crasheds)
            .bind(&erroreds)
            .bind(&p50s)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;
    Ok(())
}
