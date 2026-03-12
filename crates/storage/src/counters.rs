use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

pub struct SyncCounterParams {
    pub project_id: Uuid,
    pub fingerprint: String,
    pub window_start: DateTime<Utc>,
    pub count_delta: i64,
    pub bodies_stored_delta: i64,
}

pub async fn sync_counter(pool: &PgPool, params: SyncCounterParams) -> Result<(), sqlx::Error> {
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
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn total_event_count_for_fingerprint(
    pool: &PgPool,
    project_id: Uuid,
    fingerprint: &str,
) -> Result<i64, sqlx::Error> {
    Ok(sqlx::query_scalar::<_, i64>(
        r#"
        SELECT event_count::bigint
        FROM issues
        WHERE project_id = $1 AND fingerprint = $2 AND merge_parent_id IS NULL
        "#,
    )
    .bind(project_id)
    .bind(fingerprint)
    .fetch_optional(pool)
    .await?
    .unwrap_or(0))
}
