use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

const MONITOR_COLS: &str = r#"
    id, org_id, project_id, slug, name, schedule, schedule_type, timezone,
    status, last_check_in_at, last_duration_ms, next_check_in_at, environment,
    checkin_margin_mins, max_runtime_mins, failure_issue_threshold, paused,
    created_at, updated_at
"#;

const CHECK_IN_COLS: &str = r#"
    id, monitor_id, project_id, org_id, check_in_id, status, duration_ms,
    environment, release, issue_id, trace_id, created_at
"#;

#[derive(Debug, sqlx::FromRow, Serialize, Deserialize, Clone)]
pub struct MonitorRow {
    pub id: Uuid,
    pub org_id: Uuid,
    pub project_id: Uuid,
    pub slug: String,
    pub name: Option<String>,
    pub schedule: Option<String>,
    pub schedule_type: Option<String>,
    pub timezone: Option<String>,
    pub status: String,
    pub last_check_in_at: Option<DateTime<Utc>>,
    pub last_duration_ms: Option<f64>,
    pub next_check_in_at: Option<DateTime<Utc>>,
    pub environment: Option<String>,
    pub checkin_margin_mins: i32,
    pub max_runtime_mins: i32,
    pub failure_issue_threshold: i32,
    pub paused: bool,
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
    pub release: Option<String>,
    pub issue_id: Option<Uuid>,
    pub trace_id: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Default)]
pub struct RecordCheckInParams {
    pub slug: String,
    pub check_in_id: Option<String>,
    pub status: String,
    pub duration_ms: Option<f64>,
    pub schedule: Option<String>,
    pub schedule_type: Option<String>,
    pub timezone: Option<String>,
    pub environment: Option<String>,
    pub checkin_margin_mins: Option<i32>,
    pub max_runtime_mins: Option<i32>,
    pub failure_issue_threshold: Option<i32>,
    pub release: Option<String>,
    pub issue_id: Option<Uuid>,
    pub trace_id: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct CreateMonitorParams<'a> {
    pub slug: &'a str,
    pub name: Option<&'a str>,
    pub schedule: Option<&'a str>,
    pub schedule_type: Option<&'a str>,
    pub timezone: Option<&'a str>,
    pub environment: Option<&'a str>,
    pub checkin_margin_mins: Option<i32>,
    pub max_runtime_mins: Option<i32>,
    pub failure_issue_threshold: Option<i32>,
}

#[derive(Debug, Clone, Default)]
pub struct UpdateMonitorParams<'a> {
    pub name: Option<&'a str>,
    pub schedule: Option<&'a str>,
    pub schedule_type: Option<&'a str>,
    pub timezone: Option<&'a str>,
    pub environment: Option<&'a str>,
    pub checkin_margin_mins: Option<i32>,
    pub max_runtime_mins: Option<i32>,
    pub failure_issue_threshold: Option<i32>,
    pub paused: Option<bool>,
    pub next_check_in_at: Option<DateTime<Utc>>,
}

fn normalize_status(raw: &str) -> &'static str {
    match raw.to_lowercase().as_str() {
        "ok" => "ok",
        "in_progress" => "in_progress",
        "error" => "error",
        "missed" => "missed",
        "timeout" | "timeout_expired" => "timeout",
        _ => "ok",
    }
}

/// Record a check-in from ingest (upserts monitor and appends to check-in history).
pub async fn record_check_in(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    params: RecordCheckInParams,
) -> Result<MonitorRow, sqlx::Error> {
    let status = normalize_status(&params.status);
    let mut tx = crate::rls::begin_ingest_transaction(pool, org_id).await?;

    let row = sqlx::query_as::<_, MonitorRow>(&format!(
        r#"
        INSERT INTO monitors (
            project_id, org_id, slug, name, schedule, schedule_type, timezone,
            status, last_check_in_at, last_duration_ms, environment,
            checkin_margin_mins, max_runtime_mins, failure_issue_threshold, updated_at
        )
        VALUES (
            $1, $2, $3, $3, $4, $5, COALESCE($6, 'UTC'),
            $7, now(), $8, $9,
            COALESCE($10, 5), COALESCE($11, 30), COALESCE($12, 1), now()
        )
        ON CONFLICT (project_id, slug) DO UPDATE
        SET status = EXCLUDED.status,
            last_check_in_at = now(),
            schedule = COALESCE(EXCLUDED.schedule, monitors.schedule),
            schedule_type = COALESCE(EXCLUDED.schedule_type, monitors.schedule_type),
            timezone = COALESCE(EXCLUDED.timezone, monitors.timezone),
            last_duration_ms = COALESCE(EXCLUDED.last_duration_ms, monitors.last_duration_ms),
            environment = COALESCE(EXCLUDED.environment, monitors.environment),
            checkin_margin_mins = COALESCE(EXCLUDED.checkin_margin_mins, monitors.checkin_margin_mins),
            max_runtime_mins = COALESCE(EXCLUDED.max_runtime_mins, monitors.max_runtime_mins),
            failure_issue_threshold = COALESCE(EXCLUDED.failure_issue_threshold, monitors.failure_issue_threshold),
            name = COALESCE(monitors.name, EXCLUDED.name),
            updated_at = now()
        RETURNING {MONITOR_COLS}
        "#
    ))
    .bind(project_id)
    .bind(org_id)
    .bind(&params.slug)
    .bind(&params.schedule)
    .bind(&params.schedule_type)
    .bind(&params.timezone)
    .bind(status)
    .bind(params.duration_ms)
    .bind(&params.environment)
    .bind(params.checkin_margin_mins)
    .bind(params.max_runtime_mins)
    .bind(params.failure_issue_threshold)
    .fetch_one(&mut *tx)
    .await?;

    let _ = sqlx::query(
        r#"
        INSERT INTO monitor_check_ins (
            monitor_id, project_id, org_id, check_in_id, status, duration_ms,
            environment, release, issue_id, trace_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        "#,
    )
    .bind(row.id)
    .bind(project_id)
    .bind(org_id)
    .bind(&params.check_in_id)
    .bind(status)
    .bind(params.duration_ms)
    .bind(&params.environment)
    .bind(&params.release)
    .bind(params.issue_id)
    .bind(&params.trace_id)
    .execute(&mut *tx)
    .await;

    tx.commit().await?;
    Ok(row)
}

pub async fn list_for_project(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
) -> Result<Vec<MonitorRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let rows = sqlx::query_as::<_, MonitorRow>(&format!(
        r#"
        SELECT {MONITOR_COLS}
        FROM monitors
        WHERE project_id = $1
        ORDER BY
            CASE status
                WHEN 'error' THEN 0
                WHEN 'timeout' THEN 0
                WHEN 'missed' THEN 1
                WHEN 'in_progress' THEN 2
                WHEN 'ok' THEN 3
                ELSE 4
            END,
            CASE WHEN paused THEN 1 ELSE 0 END,
            updated_at DESC
        "#
    ))
    .bind(project_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

/// Last N check-ins per monitor for a project (for duration strips).
pub async fn list_recent_check_ins_for_project(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    per_monitor: i64,
) -> Result<Vec<MonitorCheckInRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let rows = sqlx::query_as::<_, MonitorCheckInRow>(&format!(
        r#"
        SELECT {CHECK_IN_COLS}
        FROM (
            SELECT {CHECK_IN_COLS},
                   ROW_NUMBER() OVER (PARTITION BY monitor_id ORDER BY created_at DESC) AS rn
            FROM monitor_check_ins
            WHERE project_id = $1
        ) ranked
        WHERE rn <= $2
        ORDER BY monitor_id, created_at ASC
        "#
    ))
    .bind(project_id)
    .bind(per_monitor)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

pub async fn get_monitor(
    pool: &PgPool,
    org_id: Uuid,
    monitor_id: Uuid,
) -> Result<Option<MonitorRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, MonitorRow>(&format!(
        r#"
        SELECT {MONITOR_COLS}
        FROM monitors
        WHERE id = $1
        "#
    ))
    .bind(monitor_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

pub async fn list_check_ins(
    pool: &PgPool,
    org_id: Uuid,
    monitor_id: Uuid,
    limit: i64,
) -> Result<Vec<MonitorCheckInRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let rows = sqlx::query_as::<_, MonitorCheckInRow>(&format!(
        r#"
        SELECT {CHECK_IN_COLS}
        FROM monitor_check_ins
        WHERE monitor_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        "#
    ))
    .bind(monitor_id)
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

pub async fn create_monitor(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    params: CreateMonitorParams<'_>,
) -> Result<MonitorRow, sqlx::Error> {
    let margin = params.checkin_margin_mins.unwrap_or(5);
    let max_runtime = params.max_runtime_mins.unwrap_or(30);
    let threshold = params.failure_issue_threshold.unwrap_or(1);
    let name = params.name.unwrap_or(params.slug);
    let timezone = params.timezone.unwrap_or("UTC");

    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, MonitorRow>(&format!(
        r#"
        INSERT INTO monitors (
            project_id, org_id, slug, name, schedule, schedule_type, timezone,
            status, environment, checkin_margin_mins, max_runtime_mins,
            failure_issue_threshold
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'ok', $8, $9, $10, $11)
        ON CONFLICT (project_id, slug) DO UPDATE
        SET name = COALESCE(EXCLUDED.name, monitors.name),
            schedule = COALESCE(EXCLUDED.schedule, monitors.schedule),
            schedule_type = COALESCE(EXCLUDED.schedule_type, monitors.schedule_type),
            timezone = COALESCE(EXCLUDED.timezone, monitors.timezone),
            environment = COALESCE(EXCLUDED.environment, monitors.environment),
            checkin_margin_mins = EXCLUDED.checkin_margin_mins,
            max_runtime_mins = EXCLUDED.max_runtime_mins,
            failure_issue_threshold = EXCLUDED.failure_issue_threshold,
            updated_at = now()
        RETURNING {MONITOR_COLS}
        "#
    ))
    .bind(project_id)
    .bind(org_id)
    .bind(params.slug)
    .bind(name)
    .bind(params.schedule)
    .bind(params.schedule_type)
    .bind(timezone)
    .bind(params.environment)
    .bind(margin)
    .bind(max_runtime)
    .bind(threshold)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

pub async fn update_monitor(
    pool: &PgPool,
    org_id: Uuid,
    monitor_id: Uuid,
    params: UpdateMonitorParams<'_>,
) -> Result<Option<MonitorRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, MonitorRow>(&format!(
        r#"
        UPDATE monitors SET
            name = COALESCE($2, name),
            schedule = COALESCE($3, schedule),
            schedule_type = COALESCE($4, schedule_type),
            timezone = COALESCE($5, timezone),
            environment = COALESCE($6, environment),
            checkin_margin_mins = COALESCE($7, checkin_margin_mins),
            max_runtime_mins = COALESCE($8, max_runtime_mins),
            failure_issue_threshold = COALESCE($9, failure_issue_threshold),
            paused = COALESCE($10, paused),
            next_check_in_at = COALESCE($11, next_check_in_at),
            updated_at = now()
        WHERE id = $1
        RETURNING {MONITOR_COLS}
        "#
    ))
    .bind(monitor_id)
    .bind(params.name)
    .bind(params.schedule)
    .bind(params.schedule_type)
    .bind(params.timezone)
    .bind(params.environment)
    .bind(params.checkin_margin_mins)
    .bind(params.max_runtime_mins)
    .bind(params.failure_issue_threshold)
    .bind(params.paused)
    .bind(params.next_check_in_at)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

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
            ..Default::default()
        };
        assert_eq!(params.slug, "test-cron");
        assert_eq!(params.check_in_id.as_deref(), Some("chk_123"));
        assert_eq!(normalize_status(&params.status), "ok");
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
            ("timeout", "timeout"),
            ("timeout_expired", "timeout"),
            ("unexpected", "ok"),
        ] {
            assert_eq!(normalize_status(input), expected);
        }
    }
}
