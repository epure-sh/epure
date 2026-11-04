use epure_storage::{partitions, PgPool, StorageError};
use std::time::Duration;
use tracing::{error, info};

const TTL_INTERVAL: Duration = Duration::from_secs(24 * 60 * 60);

pub async fn run_ttl_job(pool: PgPool) {
    let mut interval = tokio::time::interval(TTL_INTERVAL);
    interval.tick().await;

    loop {
        if let Err(err) = run_ttl_once(&pool).await {
            error!("ttl job failed: {err}");
        }
        interval.tick().await;
    }
}

pub async fn run_ttl_once(pool: &PgPool) -> Result<Vec<String>, StorageError> {
    // Only completed receipts expire. Pending/dead work is retained for recovery.
    sqlx::query("DELETE FROM ingest_inbox WHERE (project_id,event_id) IN (SELECT project_id,event_id FROM ingest_inbox WHERE status='done' AND created_at<now()-interval '7 days' LIMIT 50000)").execute(pool).await?;
    sqlx::query("DELETE FROM ingest_body_budget WHERE hour<now()-interval '7 days'")
        .execute(pool)
        .await?;
    let dropped = partitions::drop_expired_partitions(pool).await?;
    if !dropped.is_empty() {
        info!("ttl dropped partitions: {}", dropped.join(", "));
    }

    // Prune orphaned staging chunks older than 24 hours
    let pruned = sqlx::query_scalar::<_, i64>(
        "DELETE FROM artifact_upload_chunks WHERE created_at < NOW() - INTERVAL '24 hours' RETURNING 1",
    )
    .fetch_all(pool)
    .await
    .map(|rows| rows.len())
    .unwrap_or(0);
    if pruned > 0 {
        info!("ttl pruned {pruned} orphaned artifact_upload_chunks");
    }

    Ok(dropped)
}
