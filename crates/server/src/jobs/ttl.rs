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
    let dropped = partitions::drop_expired_partitions(pool).await?;
    if !dropped.is_empty() {
        info!("ttl dropped partitions: {}", dropped.join(", "));
    }
    Ok(dropped)
}
