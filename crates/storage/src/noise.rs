use chrono::{DateTime, Utc};
use epure_envelope::NoisePolicy;
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
struct NoisePolicyRow {
    extensions: bool,
    crawlers: bool,
    localhost: bool,
    legacy_browsers: bool,
    resize_observer: bool,
    chunk_load: bool,
    message_patterns: Value,
}

pub async fn get_noise_policy(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
) -> Result<NoisePolicy, sqlx::Error> {
    let mut tx = crate::rls::begin_ingest_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, NoisePolicyRow>(
        r#"
        SELECT extensions, crawlers, localhost, legacy_browsers, resize_observer, chunk_load, message_patterns
        FROM project_noise_policies
        WHERE project_id = $1
        "#,
    )
    .bind(project_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row.map(policy_from_row).unwrap_or_default())
}

pub async fn get_noise_policy_for_dashboard(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
) -> Result<Option<NoisePolicy>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1)")
        .bind(project_id)
        .fetch_one(&mut *tx)
        .await?;
    if !exists {
        tx.commit().await?;
        return Ok(None);
    }
    let row = sqlx::query_as::<_, NoisePolicyRow>(
        r#"
        SELECT extensions, crawlers, localhost, legacy_browsers, resize_observer, chunk_load, message_patterns
        FROM project_noise_policies
        WHERE project_id = $1
        "#,
    )
    .bind(project_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Some(row.map(policy_from_row).unwrap_or_default()))
}

pub async fn upsert_noise_policy(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    policy: &NoisePolicy,
) -> Result<bool, sqlx::Error> {
    let patterns = NoisePolicy::sanitize_patterns(&policy.message_patterns);
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1)")
        .bind(project_id)
        .fetch_one(&mut *tx)
        .await?;
    if !exists {
        tx.commit().await?;
        return Ok(false);
    }
    sqlx::query(
        r#"
        INSERT INTO project_noise_policies (
            project_id, org_id, extensions, crawlers, localhost, legacy_browsers,
            resize_observer, chunk_load, message_patterns, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
        ON CONFLICT (project_id) DO UPDATE SET
            extensions = EXCLUDED.extensions,
            crawlers = EXCLUDED.crawlers,
            localhost = EXCLUDED.localhost,
            legacy_browsers = EXCLUDED.legacy_browsers,
            resize_observer = EXCLUDED.resize_observer,
            chunk_load = EXCLUDED.chunk_load,
            message_patterns = EXCLUDED.message_patterns,
            updated_at = now()
        "#,
    )
    .bind(project_id)
    .bind(org_id)
    .bind(policy.extensions)
    .bind(policy.crawlers)
    .bind(policy.localhost)
    .bind(policy.legacy_browsers)
    .bind(policy.resize_observer)
    .bind(policy.chunk_load)
    .bind(json!(patterns))
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(true)
}

fn policy_from_row(row: NoisePolicyRow) -> NoisePolicy {
    let message_patterns = row
        .message_patterns
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|value| value.as_str().map(str::to_string))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    NoisePolicy {
        extensions: row.extensions,
        crawlers: row.crawlers,
        localhost: row.localhost,
        legacy_browsers: row.legacy_browsers,
        resize_observer: row.resize_observer,
        chunk_load: row.chunk_load,
        message_patterns: NoisePolicy::sanitize_patterns(&message_patterns),
    }
}

pub async fn add_outcome(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    window_start: DateTime<Utc>,
    reason: &str,
    count: i64,
) -> Result<(), sqlx::Error> {
    if count <= 0 || reason.is_empty() {
        return Ok(());
    }
    let mut tx = crate::rls::begin_ingest_transaction(pool, org_id).await?;
    sqlx::query(
        r#"
        INSERT INTO ingest_outcomes (project_id, org_id, window_start, reason, count)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (project_id, window_start, reason)
        DO UPDATE SET count = ingest_outcomes.count + EXCLUDED.count
        "#,
    )
    .bind(project_id)
    .bind(org_id)
    .bind(window_start)
    .bind(reason)
    .bind(count)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct OutcomeTotal {
    pub reason: String,
    pub count: i64,
}

pub async fn outcome_totals_since(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    since: DateTime<Utc>,
) -> Result<Vec<OutcomeTotal>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let rows = sqlx::query_as::<_, OutcomeTotal>(
        r#"
        SELECT reason, COALESCE(SUM(count), 0)::bigint AS count
        FROM ingest_outcomes
        WHERE project_id = $1 AND window_start >= $2
        GROUP BY reason
        ORDER BY count DESC, reason ASC
        "#,
    )
    .bind(project_id)
    .bind(since)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

/// Fingerprint already stored for this client event id, when the prior row
/// is from the last 6 hours. A retry of the same body shares that fingerprint.
/// A different body under a reused id does not.
pub async fn recent_event_fingerprint(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    event_id: Uuid,
) -> Result<Option<String>, sqlx::Error> {
    let mut tx = crate::rls::begin_ingest_transaction(pool, org_id).await?;
    let fingerprint = sqlx::query_scalar(
        r#"
        SELECT i.fingerprint
        FROM events e
        JOIN issues i ON i.id = e.issue_id
        WHERE e.project_id = $1
          AND e.id = $2
          AND e.occurred_at > now() - interval '6 hours'
        ORDER BY e.occurred_at DESC
        LIMIT 1
        "#,
    )
    .bind(project_id)
    .bind(event_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(fingerprint)
}
