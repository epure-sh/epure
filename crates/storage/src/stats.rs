use sqlx::PgPool;
use uuid::Uuid;

use crate::issues::{TimeWindow, SNOOZE_ACTIVE_SQL};

#[derive(Debug, Clone, serde::Serialize)]
pub struct HeadlineStats {
    pub project_id: Uuid,
    pub environment: Option<String>,
    pub unresolved: i64,
    pub events_7d: i64,
    pub regressions: i64,
    pub snoozed: i64,
    /// Unresolved issues at fatal/error level (needs triage).
    pub high_priority: i64,
    /// Distinct users seen on events in the selected window.
    pub affected_users: i64,
    /// Spike valve: total ingest attempts counted in `issue_counters`.
    pub valve_seen: i64,
    /// Spike valve: event bodies actually stored.
    pub valve_stored: i64,
}

pub async fn headline_stats(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    environment: Option<&str>,
    time_window: TimeWindow,
) -> Result<HeadlineStats, sqlx::Error> {
    let events_interval = time_window.sql_interval();
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;

    let unresolved: i64 = if let Some(env) = environment {
        sqlx::query_scalar(&format!(
            r#"
            SELECT COUNT(*)::bigint
            FROM issues
            WHERE project_id = $1
              AND status = 'unresolved'
              AND merge_parent_id IS NULL
              AND NOT {SNOOZE_ACTIVE_SQL}
              AND environment = $2
            "#
        ))
        .bind(project_id)
        .bind(env)
        .fetch_one(&mut *tx)
        .await?
    } else {
        sqlx::query_scalar(&format!(
            r#"
            SELECT COUNT(*)::bigint
            FROM issues
            WHERE project_id = $1
              AND status = 'unresolved'
              AND merge_parent_id IS NULL
              AND NOT {SNOOZE_ACTIVE_SQL}
            "#
        ))
        .bind(project_id)
        .fetch_one(&mut *tx)
        .await?
    };

    let regressions: i64 = if let Some(env) = environment {
        sqlx::query_scalar(&format!(
            r#"
            SELECT COUNT(*)::bigint
            FROM issues
            WHERE project_id = $1
              AND status = 'regression'
              AND merge_parent_id IS NULL
              AND NOT {SNOOZE_ACTIVE_SQL}
              AND environment = $2
            "#
        ))
        .bind(project_id)
        .bind(env)
        .fetch_one(&mut *tx)
        .await?
    } else {
        sqlx::query_scalar(&format!(
            r#"
            SELECT COUNT(*)::bigint
            FROM issues
            WHERE project_id = $1
              AND status = 'regression'
              AND merge_parent_id IS NULL
              AND NOT {SNOOZE_ACTIVE_SQL}
            "#
        ))
        .bind(project_id)
        .fetch_one(&mut *tx)
        .await?
    };

    let snoozed: i64 = if let Some(env) = environment {
        sqlx::query_scalar(&format!(
            r#"
            SELECT COUNT(*)::bigint
            FROM issues
            WHERE project_id = $1
              AND merge_parent_id IS NULL
              AND environment = $2
              AND {SNOOZE_ACTIVE_SQL}
            "#
        ))
        .bind(project_id)
        .bind(env)
        .fetch_one(&mut *tx)
        .await?
    } else {
        sqlx::query_scalar(&format!(
            r#"
            SELECT COUNT(*)::bigint
            FROM issues
            WHERE project_id = $1
              AND merge_parent_id IS NULL
              AND {SNOOZE_ACTIVE_SQL}
            "#
        ))
        .bind(project_id)
        .fetch_one(&mut *tx)
        .await?
    };

    let events_7d: i64 = if let Some(env) = environment {
        sqlx::query_scalar(&format!(
            r#"
            SELECT COUNT(*)::bigint
            FROM events
            WHERE project_id = $1
              AND occurred_at >= now() - interval '{events_interval}'
              AND environment = $2
            "#
        ))
        .bind(project_id)
        .bind(env)
        .fetch_one(&mut *tx)
        .await?
    } else {
        sqlx::query_scalar(&format!(
            r#"
            SELECT COUNT(*)::bigint
            FROM events
            WHERE project_id = $1
              AND occurred_at >= now() - interval '{events_interval}'
            "#
        ))
        .bind(project_id)
        .fetch_one(&mut *tx)
        .await?
    };

    let high_priority: i64 = if let Some(env) = environment {
        sqlx::query_scalar(&format!(
            r#"
            SELECT COUNT(*)::bigint
            FROM issues
            WHERE project_id = $1
              AND status IN ('unresolved', 'regression')
              AND merge_parent_id IS NULL
              AND NOT {SNOOZE_ACTIVE_SQL}
              AND lower(coalesce(level, '')) IN ('fatal', 'error')
              AND environment = $2
            "#
        ))
        .bind(project_id)
        .bind(env)
        .fetch_one(&mut *tx)
        .await?
    } else {
        sqlx::query_scalar(&format!(
            r#"
            SELECT COUNT(*)::bigint
            FROM issues
            WHERE project_id = $1
              AND status IN ('unresolved', 'regression')
              AND merge_parent_id IS NULL
              AND NOT {SNOOZE_ACTIVE_SQL}
              AND lower(coalesce(level, '')) IN ('fatal', 'error')
            "#
        ))
        .bind(project_id)
        .fetch_one(&mut *tx)
        .await?
    };

    let affected_users: i64 = if let Some(env) = environment {
        sqlx::query_scalar(&format!(
            r#"
            SELECT COUNT(DISTINCT COALESCE(NULLIF(user_id, ''), NULLIF(user_email, '')))::bigint
            FROM events
            WHERE project_id = $1
              AND occurred_at >= now() - interval '{events_interval}'
              AND environment = $2
              AND COALESCE(NULLIF(user_id, ''), NULLIF(user_email, '')) IS NOT NULL
            "#
        ))
        .bind(project_id)
        .bind(env)
        .fetch_one(&mut *tx)
        .await?
    } else {
        sqlx::query_scalar(&format!(
            r#"
            SELECT COUNT(DISTINCT COALESCE(NULLIF(user_id, ''), NULLIF(user_email, '')))::bigint
            FROM events
            WHERE project_id = $1
              AND occurred_at >= now() - interval '{events_interval}'
              AND COALESCE(NULLIF(user_id, ''), NULLIF(user_email, '')) IS NOT NULL
            "#
        ))
        .bind(project_id)
        .fetch_one(&mut *tx)
        .await?
    };

    let valve_row: (i64, i64) = sqlx::query_as(
        r#"
        SELECT
            COALESCE(SUM(count), 0)::bigint,
            COALESCE(SUM(bodies_stored), 0)::bigint
        FROM issue_counters
        WHERE project_id = $1
          AND window_start >= now() - interval '7 days'
        "#,
    )
    .bind(project_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(HeadlineStats {
        project_id,
        environment: environment.map(str::to_string),
        unresolved,
        events_7d,
        regressions,
        snoozed,
        high_priority,
        affected_users,
        valve_seen: valve_row.0,
        valve_stored: valve_row.1,
    })
}
