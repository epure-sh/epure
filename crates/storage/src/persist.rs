use chrono::{DateTime, Utc};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::counters::SyncCounterParams;
use crate::events::InsertEventParams;
use crate::issues::{IssueLifecycleState, UpsertIssueParams};
use crate::rls;

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
    tx.commit().await?;
    Ok((prior, issue_id))
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
            event_count
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9)
        ON CONFLICT (project_id, fingerprint) WHERE merge_parent_id IS NULL
        DO UPDATE SET
            title = COALESCE(EXCLUDED.title, issues.title),
            level = COALESCE(EXCLUDED.level, issues.level),
            environment = COALESCE(EXCLUDED.environment, issues.environment),
            release = COALESCE(EXCLUDED.release, issues.release),
            last_seen_at = GREATEST(issues.last_seen_at, EXCLUDED.last_seen_at),
            event_count = issues.event_count + EXCLUDED.event_count
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
            id, org_id, project_id, title, status, release, environment,
            event_count, unique_user_count,
            resolved_in_release, snooze_until, snooze_until_count, snooze_until_users,
            pre_snooze_status
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

async fn sync_counter_in_tx(
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
    let inserted = sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO issue_unique_users (issue_id, user_key)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        RETURNING issue_id
        "#,
    )
    .bind(issue_id)
    .bind(user_key)
    .fetch_optional(&mut **tx)
    .await?;

    if inserted.is_some() {
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
