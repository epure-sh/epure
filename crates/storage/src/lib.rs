pub mod alerts;
pub mod batch;
pub mod bootstrap;
pub mod counters;
pub mod dsn_keys;
pub mod events;
pub mod issues;
pub mod members;
pub mod partitions;
pub mod projects;
pub mod releases;
pub mod rls;
pub mod setup;
pub mod stats;
pub mod unique_users;
pub mod user_feedback;
pub mod webhooks;

use sqlx::postgres::PgPoolOptions;

pub use sqlx::PgPool;
use std::time::Duration;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error(transparent)]
    Sqlx(#[from] sqlx::Error),
    #[error(transparent)]
    Migrate(#[from] sqlx::migrate::MigrateError),
}

#[derive(Clone)]
pub struct StoragePools {
    pub ingest: PgPool,
    pub app: PgPool,
}

pub async fn connect(database_url: &str) -> Result<PgPool, StorageError> {
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(Duration::from_secs(5))
        .connect(database_url)
        .await?;
    Ok(pool)
}

pub async fn connect_pools(database_url: &str) -> Result<StoragePools, StorageError> {
    let ingest_url = std::env::var("EPURE_INGEST_DATABASE_URL")
        .unwrap_or_else(|_| rewrite_database_role(database_url, "epure_ingest", "epure_ingest"));
    let app_url = std::env::var("EPURE_APP_DATABASE_URL")
        .unwrap_or_else(|_| rewrite_database_role(database_url, "epure_app", "epure_app"));

    let ingest = connect(&ingest_url).await?;
    let app = connect(&app_url).await?;
    Ok(StoragePools { ingest, app })
}

pub async fn run_migrations(pool: &PgPool) -> Result<(), StorageError> {
    sqlx::migrate!("./migrations").run(pool).await?;
    Ok(())
}

fn rewrite_database_role(base_url: &str, user: &str, password: &str) -> String {
    if let Some(rest) = base_url.strip_prefix("postgres://") {
        if let Some(at_pos) = rest.find('@') {
            let host_and_db = &rest[at_pos + 1..];
            return format!("postgres://{user}:{password}@{host_and_db}");
        }
    }
    base_url.to_string()
}
