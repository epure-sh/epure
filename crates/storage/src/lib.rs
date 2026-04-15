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
    dev_credential_flags_on() && public_url_host_is_loopback(&public_url_from_env())
}

fn dev_credential_flags_on() -> bool {
    if cfg!(debug_assertions) {
        return true;
    }
    // Release compose may set this for laptop HTTP. Prod overlay forces 0.
    env_flag("EPURE_ALLOW_EXAMPLE_PASSWORDS")
        || env_flag("EPURE_DEV_SEED")
        || std::env::var("EPURE_MODE")
            .map(|mode| mode.eq_ignore_ascii_case("dev"))
            .unwrap_or(false)
}

/// Base URL browsers and SDKs use (DSN host, OAuth redirects).
/// Production must set `EPURE_PUBLIC_URL`. Local Compose can set only `EPURE_PORT`
/// (passed in as `EPURE_HOST_PORT`) and this derives `http://localhost:{port}`.
pub fn epure_public_url() -> String {
    if let Ok(url) = std::env::var("EPURE_PUBLIC_URL") {
        let trimmed = url.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    let port = std::env::var("EPURE_HOST_PORT")
        .ok()
        .filter(|value| !value.is_empty())
        .or_else(bind_port_from_env)
        .unwrap_or_else(|| "8080".to_string());
    format!("http://localhost:{port}")
}

fn bind_port_from_env() -> Option<String> {
    std::env::var("EPURE_BIND").ok().and_then(|bind| {
        bind.rsplit(':')
            .next()
            .filter(|port| !port.is_empty())
            .map(str::to_string)
    })
}

fn public_url_from_env() -> String {
    epure_public_url()
}

fn public_url_host_is_loopback(public_url: &str) -> bool {
    let trimmed = public_url.trim();
    if trimmed.is_empty() {
        return true;
    }
    let without_scheme = trimmed
        .strip_prefix("https://")
        .or_else(|| trimmed.strip_prefix("http://"))
        .unwrap_or(trimmed);
    let hostport = without_scheme
        .split(['/', '?', '#'])
        .next()
        .unwrap_or(without_scheme);
    let host = if let Some(inner) = hostport
        .strip_prefix('[')
        .and_then(|value| value.split(']').next())
    {
        inner
    } else {
        hostport.split(':').next().unwrap_or(hostport)
    };
    matches!(host, "localhost" | "127.0.0.1" | "::1" | "")
}

/// Production (release + non-loopback public URL) needs HTTPS and explicit CORS.
pub fn reject_insecure_prod_config(cors_origins: &[String]) -> Result<(), StorageError> {
    if allow_dev_db_fallback() {
        return Ok(());
    }
    let public_url = public_url_from_env();
    if !public_url.starts_with("https://") {
        return Err(StorageError::Config(
            "EPURE_PUBLIC_URL must be https:// when example database passwords are not allowed"
                .into(),
        ));
    }
    if cors_origins.is_empty() || cors_origins.iter().any(|origin| origin == "*") {
        return Err(StorageError::Config(
            "EPURE_CORS_ORIGINS must list real frontend origins in production, not *".into(),
        ));
    }
    Ok(())
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
        || lowered.contains(":change_me@")
        || lowered.contains(":changeme@")
}

fn reject_example_passwords(url: &str) -> Result<(), StorageError> {
    if url_uses_example_password(url) && !allow_dev_db_fallback() {
        return Err(StorageError::Config(
            "example database passwords are not allowed unless EPURE_PUBLIC_URL is localhost (use docker-compose.prod.yml and set POSTGRES_PASSWORD, EPURE_INGEST_PASSWORD, EPURE_APP_PASSWORD)".into(),
        ));
    }
    Ok(())
}

fn credentials_from_postgres_url(url: &str) -> Result<(String, String), StorageError> {
    let rest = url
        .strip_prefix("postgres://")
        .or_else(|| url.strip_prefix("postgresql://"))
        .ok_or_else(|| StorageError::Config("database URL must be postgres://".into()))?;
    let at = rest
        .find('@')
        .ok_or_else(|| StorageError::Config("database URL is missing credentials".into()))?;
    let userinfo = &rest[..at];
    let (user, password) = userinfo
        .split_once(':')
        .ok_or_else(|| StorageError::Config("database URL must include user:password".into()))?;
    if user.is_empty() || password.is_empty() {
        return Err(StorageError::Config(
            "database URL user and password must not be empty".into(),
        ));
    }
    Ok((percent_decode(user)?, percent_decode(password)?))
}

fn percent_decode(input: &str) -> Result<String, StorageError> {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            if i + 2 >= bytes.len() {
                return Err(StorageError::Config(
                    "database URL has a truncated percent-escape".into(),
                ));
            }
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).map_err(|_| {
                StorageError::Config("database URL has a non-utf8 percent-escape".into())
            })?;
            let value = u8::from_str_radix(hex, 16).map_err(|_| {
                StorageError::Config("database URL has an invalid percent-escape".into())
            })?;
            out.push(value);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out)
        .map_err(|_| StorageError::Config("database URL credentials are not valid UTF-8".into()))
}

fn resolved_ingest_app_urls(database_url: &str) -> Result<(String, String), StorageError> {
    let ingest_url = match std::env::var("EPURE_INGEST_DATABASE_URL") {
        Ok(url) if !url.is_empty() => url,
        _ if allow_dev_db_fallback() => {
            rewrite_database_role(database_url, "epure_ingest", "epure_ingest")?
        }
        _ => {
            return Err(StorageError::Config(
                "EPURE_INGEST_DATABASE_URL must be set".into(),
            ))
        }
    };
    let app_url = match std::env::var("EPURE_APP_DATABASE_URL") {
        Ok(url) if !url.is_empty() => url,
        _ if allow_dev_db_fallback() => {
            rewrite_database_role(database_url, "epure_app", "epure_app")?
        }
        _ => {
            return Err(StorageError::Config(
                "EPURE_APP_DATABASE_URL must be set".into(),
            ))
        }
    };
    Ok((ingest_url, app_url))
}

async fn set_role_password(
    pool: &PgPool,
    expected_role: &str,
    url: &str,
) -> Result<(), StorageError> {
    let (user, password) = credentials_from_postgres_url(url)?;
    if user != expected_role {
        return Err(StorageError::Config(format!(
            "database URL user must be {expected_role}"
        )));
    }
    reject_example_passwords(url)?;
    let sql: String =
        sqlx::query_scalar("SELECT format('ALTER ROLE %I PASSWORD %L', $1::text, $2::text)")
            .bind(expected_role)
            .bind(&password)
            .fetch_one(pool)
            .await?;
    sqlx::query(&sql).execute(pool).await?;
    Ok(())
}

/// Set `epure` / `epure_ingest` / `epure_app` passwords from the env URLs.
/// Called after migrate so SQL never leaves the documented example passwords in place.
pub async fn apply_role_passwords(pool: &PgPool, database_url: &str) -> Result<(), StorageError> {
    reject_example_passwords(database_url)?;
    let (ingest_url, app_url) = resolved_ingest_app_urls(database_url)?;
    reject_example_passwords(&ingest_url)?;
    reject_example_passwords(&app_url)?;
    set_role_password(pool, "epure", database_url).await?;
    set_role_password(pool, "epure_ingest", &ingest_url).await?;
    set_role_password(pool, "epure_app", &app_url).await?;
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

    let (ingest_url, app_url) = resolved_ingest_app_urls(database_url)?;

    reject_example_passwords(&ingest_url)?;
    reject_example_passwords(&app_url)?;

    let ingest = connect(&ingest_url).await?;
    let app = connect(&app_url).await?;
    Ok(StoragePools { ingest, app })
}

pub async fn run_migrations(pool: &PgPool) -> Result<(), StorageError> {
    sqlx::migrate!("./migrations").run(pool).await?;
    let database_url = std::env::var("DATABASE_URL").map_err(|_| {
        StorageError::Config("DATABASE_URL must be set to apply role passwords".into())
    })?;
    apply_role_passwords(pool, &database_url).await?;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loopback_public_urls() {
        assert!(public_url_host_is_loopback(""));
        assert!(public_url_host_is_loopback("http://localhost:8080"));
        assert!(public_url_host_is_loopback("http://127.0.0.1:9090"));
        assert!(public_url_host_is_loopback("http://[::1]:8080"));
        assert!(!public_url_host_is_loopback("https://errors.example.com"));
        assert!(!public_url_host_is_loopback("http://192.168.1.9:8080"));
    }

    #[test]
    fn example_password_urls() {
        assert!(url_uses_example_password(
            "postgres://epure:epure@postgres:5432/epure"
        ));
        assert!(url_uses_example_password(
            "postgres://epure_ingest:epure_ingest@postgres:5432/epure"
        ));
        assert!(!url_uses_example_password(
            "postgres://epure:correct-horse@postgres:5432/epure"
        ));
        assert!(url_uses_example_password(
            "postgres://epure:CHANGE_ME@postgres:5432/epure"
        ));
    }

    #[test]
    fn parses_postgres_credentials() {
        let (user, password) =
            credentials_from_postgres_url("postgres://epure:s3cret@postgres:5432/epure").unwrap();
        assert_eq!(user, "epure");
        assert_eq!(password, "s3cret");
        let (user, password) =
            credentials_from_postgres_url("postgres://epure:p%40ss@postgres:5432/epure").unwrap();
        assert_eq!(password, "p@ss");
        assert_eq!(user, "epure");
    }
}
