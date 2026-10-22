use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow, Serialize, Deserialize, Clone)]
pub struct MonitorRow {
    pub id: Uuid,
    pub org_id: Uuid,
    pub project_id: Uuid,
    pub slug: String,
    pub schedule: Option<String>,
    pub status: String,
    pub last_check_in_at: Option<DateTime<Utc>>,
    pub last_duration_ms: Option<f64>,
    pub environment: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, sqlx::FromRow, Serialize, Deserialize, Clone)]
pub struct MonitorCheckInRow {
    pub id: Uuid,
    pub monitor_id: Uuid,
    pub project_id: Uuid,
    pub org_id: Uuid,
    pub check_in_id: Option<String>,
    pub status: String,
    pub duration_ms: Option<f64>,
    pub environment: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct RecordCheckInParams {
    pub slug: String,
    pub check_in_id: Option<String>,
    pub status: String,
    pub duration_ms: Option<f64>,
    pub schedule: Option<String>,
    pub environment: Option<String>,
}

/// Record a check-in from ingest (upserts monitor and appends to check-in history).
pub async fn record_check_in(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    params: RecordCheckInParams,
) -> Result<MonitorRow, sqlx::Error> {
    // Normalise status
    let status = match params.status.to_lowercase().as_str() {
        "ok" => "ok",
        "in_progress" => "in_progress",
        "error" => "error",
        "missed" => "missed",
        _ => "ok",
    };

    let mut tx = crate::rls::begin_ingest_transaction(pool, org_id).await?;

    let row = sqlx::query_as::<_, MonitorRow>(
        r#"
        INSERT INTO monitors (
            project_id, org_id, slug, schedule, status, last_check_in_at, last_duration_ms, environment, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, now(), $6, $7, now())
        ON CONFLICT (project_id, slug) DO UPDATE
        SET status = EXCLUDED.status,
            last_check_in_at = now(),
            schedule = COALESCE(EXCLUDED.schedule, monitors.schedule),
            last_duration_ms = COALESCE(EXCLUDED.last_duration_ms, monitors.last_duration_ms),
            environment = COALESCE(EXCLUDED.environment, monitors.environment),
            updated_at = now()
        RETURNING id, org_id, project_id, slug, schedule, status, last_check_in_at, last_duration_ms, environment, created_at, updated_at
        "#,
    )
    .bind(project_id)
    .bind(org_id)
    .bind(&params.slug)
    .bind(&params.schedule)
    .bind(status)
    .bind(params.duration_ms)
    .bind(&params.environment)
    .fetch_one(&mut *tx)
    .await?;

    let _ = sqlx::query(
        r#"
        INSERT INTO monitor_check_ins (
            monitor_id, project_id, org_id, check_in_id, status, duration_ms, environment
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
    )
    .bind(row.id)
    .bind(project_id)
    .bind(org_id)
    .bind(&params.check_in_id)
    .bind(status)
    .bind(params.duration_ms)
    .bind(&params.environment)
    .execute(&mut *tx)
    .await;

    tx.commit().await?;

    Ok(row)
}

/// List all monitors for a project within tenant transaction.
pub async fn list_for_project(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
) -> Result<Vec<MonitorRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let rows = sqlx::query_as::<_, MonitorRow>(
        r#"
        SELECT id, org_id, project_id, slug, schedule, status, last_check_in_at, last_duration_ms, environment, created_at, updated_at
        FROM monitors
        WHERE project_id = $1
        ORDER BY updated_at DESC
        "#,
    )
    .bind(project_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

/// Get a specific monitor by ID within tenant transaction.
pub async fn get_monitor(
    pool: &PgPool,
    org_id: Uuid,
    monitor_id: Uuid,
) -> Result<Option<MonitorRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, MonitorRow>(
        r#"
        SELECT id, org_id, project_id, slug, schedule, status, last_check_in_at, last_duration_ms, environment, created_at, updated_at
        FROM monitors
        WHERE id = $1
        "#,
    )
    .bind(monitor_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

/// List recent check-in history for a monitor.
pub async fn list_check_ins(
    pool: &PgPool,
    org_id: Uuid,
    monitor_id: Uuid,
    limit: i64,
) -> Result<Vec<MonitorCheckInRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let rows = sqlx::query_as::<_, MonitorCheckInRow>(
        r#"
        SELECT id, monitor_id, project_id, org_id, check_in_id, status, duration_ms, environment, created_at
        FROM monitor_check_ins
        WHERE monitor_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        "#,
    )
    .bind(monitor_id)
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

/// Create a new monitor manually.
pub async fn create_monitor(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    slug: &str,
    schedule: Option<&str>,
    environment: Option<&str>,
) -> Result<MonitorRow, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, MonitorRow>(
        r#"
        INSERT INTO monitors (
            project_id, org_id, slug, schedule, status, environment
        )
        VALUES ($1, $2, $3, $4, 'ok', $5)
        ON CONFLICT (project_id, slug) DO UPDATE
        SET schedule = COALESCE(EXCLUDED.schedule, monitors.schedule),
            environment = COALESCE(EXCLUDED.environment, monitors.environment),
            updated_at = now()
        RETURNING id, org_id, project_id, slug, schedule, status, last_check_in_at, last_duration_ms, environment, created_at, updated_at
        "#,
    )
    .bind(project_id)
    .bind(org_id)
    .bind(slug)
    .bind(schedule)
    .bind(environment)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

/// Delete a monitor by ID.
pub async fn delete_monitor(
    pool: &PgPool,
    org_id: Uuid,
    monitor_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let result = sqlx::query("DELETE FROM monitors WHERE id = $1")
        .bind(monitor_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(result.rows_affected() > 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_record_check_in_params_clone_and_status() {
        let params = RecordCheckInParams {
            slug: "test-cron".to_string(),
            check_in_id: Some("chk_123".to_string()),
            status: "OK".to_string(),
            duration_ms: Some(1250.0),
            schedule: Some("0 0 * * *".to_string()),
            environment: Some("production".to_string()),
        };
        assert_eq!(params.slug, "test-cron");
        assert_eq!(params.check_in_id.as_deref(), Some("chk_123"));
        assert_eq!(params.status.to_lowercase(), "ok");
        assert_eq!(params.duration_ms, Some(1250.0));
    }

    #[test]
    fn test_status_normalization_mapping() {
        for (input, expected) in [
            ("ok", "ok"),
            ("OK", "ok"),
            ("in_progress", "in_progress"),
            ("IN_PROGRESS", "in_progress"),
            ("error", "error"),
            ("ERROR", "error"),
            ("missed", "missed"),
            ("MISSED", "missed"),
            ("unexpected", "ok"),
        ] {
            let normalized = match input.to_lowercase().as_str() {
                "ok" => "ok",
                "in_progress" => "in_progress",
                "error" => "error",
                "missed" => "missed",
                _ => "ok",
            };
            assert_eq!(normalized, expected);
        }
    }
}
