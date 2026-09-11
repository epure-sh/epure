pub mod alert_rules;
pub mod alerts;
pub mod batch;
pub mod bootstrap;
pub mod counters;
pub mod dsn_keys;
pub mod events;
pub mod issues;
pub mod members;
pub mod partitions;
pub mod persist;
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
    #[error("{0}")]
    Config(String),
}

#[derive(Clone)]
pub struct StoragePools {
    pub ingest: PgPool,
    pub app: PgPool,
}

const DEFAULT_CONNECT_MAX_ATTEMPTS: u32 = 30;
const CONNECT_INITIAL_DELAY: Duration = Duration::from_millis(500);
const CONNECT_MAX_DELAY: Duration = Duration::from_secs(5);

fn connect_max_attempts() -> u32 {
    std::env::var("EPURE_DB_CONNECT_MAX_ATTEMPTS")
        .ok()
        .and_then(|value| value.parse().ok())
        .filter(|attempts| *attempts > 0)
        .unwrap_or(DEFAULT_CONNECT_MAX_ATTEMPTS)
}

pub fn allow_dev_db_fallback() -> bool {
    if cfg!(debug_assertions) {
        return true;
    }
    // Local compose is a release binary with --mode=all and bind 0.0.0.0.
    // Explicit flag only — prod overlay must not set this.
    env_flag("EPURE_ALLOW_EXAMPLE_PASSWORDS")
        || env_flag("EPURE_DEV_SEED")
        || std::env::var("EPURE_MODE")
            .map(|mode| mode.eq_ignore_ascii_case("dev"))
            .unwrap_or(false)
}

fn env_flag(name: &str) -> bool {
    std::env::var(name)
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

fn url_uses_example_password(url: &str) -> bool {
    let lowered = url.to_ascii_lowercase();
    lowered.contains("epure:epure@")
        || lowered.contains("epure_ingest:epure_ingest@")
        || lowered.contains("epure_app:epure_app@")
}

fn reject_example_passwords(url: &str) -> Result<(), StorageError> {
    if url_uses_example_password(url) && !allow_dev_db_fallback() {
        return Err(StorageError::Config(
            "example database passwords are not allowed outside dev".into(),
        ));
    }
    Ok(())
}

async fn connect_once(database_url: &str) -> Result<PgPool, StorageError> {
    reject_example_passwords(database_url)?;
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .min_connections(1)
        .acquire_timeout(Duration::from_secs(5))
        .idle_timeout(Duration::from_secs(300))
        .max_lifetime(Duration::from_secs(1800))
        .connect(database_url)
        .await?;
    Ok(pool)
}

/// Connect to Postgres, retrying while the server is still starting (e.g. first `docker compose up`).
pub async fn connect(database_url: &str) -> Result<PgPool, StorageError> {
    let max_attempts = connect_max_attempts();
    let mut delay = CONNECT_INITIAL_DELAY;
    let mut last_error: Option<StorageError> = None;

    for attempt in 1..=max_attempts {
        match connect_once(database_url).await {
            Ok(pool) => {
                if attempt > 1 {
                    tracing::info!("database connected after {attempt} attempts");
                }
                return Ok(pool);
            }
            Err(error) => {
                last_error = Some(error);
                if attempt < max_attempts {
                    tracing::warn!(
                        attempt,
                        max_attempts,
                        delay_ms = delay.as_millis(),
                        "database not ready, retrying"
                    );
                    tokio::time::sleep(delay).await;
                    delay = delay.mul_f32(1.5).min(CONNECT_MAX_DELAY);
                }
            }
        }
    }

    Err(last_error.unwrap_or(StorageError::Sqlx(sqlx::Error::PoolTimedOut)))
}

pub async fn connect_pools(database_url: &str) -> Result<StoragePools, StorageError> {
    reject_example_passwords(database_url)?;

    let ingest_url = match std::env::var("EPURE_INGEST_DATABASE_URL") {
        Ok(url) => url,
        Err(_) if allow_dev_db_fallback() => {
            rewrite_database_role(database_url, "epure_ingest", "epure_ingest")?
        }
        Err(_) => {
            return Err(StorageError::Config(
                "EPURE_INGEST_DATABASE_URL must be set".into(),
            ))
        }
    };
    let app_url = match std::env::var("EPURE_APP_DATABASE_URL") {
        Ok(url) => url,
        Err(_) if allow_dev_db_fallback() => {
            rewrite_database_role(database_url, "epure_app", "epure_app")?
        }
        Err(_) => {
            return Err(StorageError::Config(
                "EPURE_APP_DATABASE_URL must be set".into(),
            ))
        }
    };

    reject_example_passwords(&ingest_url)?;
    reject_example_passwords(&app_url)?;

    let ingest = connect(&ingest_url).await?;
    let app = connect(&app_url).await?;
    Ok(StoragePools { ingest, app })
}

pub async fn run_migrations(pool: &PgPool) -> Result<(), StorageError> {
    sqlx::migrate!("./migrations").run(pool).await?;
    Ok(())
}

/// Rewrite the role in a postgres URL. Never called unless an explicit dev fallback is active.
fn rewrite_database_role(
    base_url: &str,
    user: &str,
    password: &str,
) -> Result<String, StorageError> {
    if !allow_dev_db_fallback() {
        return Err(StorageError::Config(
            "database role URLs must be provided via environment".into(),
        ));
    }
    if let Some(rest) = base_url.strip_prefix("postgres://") {
        if let Some(at_pos) = rest.find('@') {
            let host_and_db = &rest[at_pos + 1..];
            return Ok(format!("postgres://{user}:{password}@{host_and_db}"));
        }
    }
    Err(StorageError::Config(
        "DATABASE_URL is not a postgres:// URL; set EPURE_INGEST_DATABASE_URL and EPURE_APP_DATABASE_URL".into(),
    ))
}
