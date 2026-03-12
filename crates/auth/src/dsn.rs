use dashmap::DashMap;
use epure_storage::StorageError;
use sqlx::PgPool;
use std::sync::Arc;
use std::time::{Duration, Instant};
use subtle::ConstantTimeEq;
use thiserror::Error;
use uuid::Uuid;

const MAX_CACHE: usize = 10_000;
const CACHE_TTL: Duration = Duration::from_secs(10 * 60);

struct CachedDsn {
    record: DsnRecord,
    last_hit: Instant,
}

#[derive(Debug, Clone)]
pub struct DsnRecord {
    pub project_id: Uuid,
    pub org_id: Uuid,
    pub secret_key: Vec<u8>,
    pub revoked: bool,
}

#[derive(Debug, Error)]
pub enum DsnAuthError {
    #[error("missing DSN credentials")]
    Missing,
    #[error("invalid DSN credentials")]
    Invalid,
    #[error("DSN key revoked")]
    Revoked,
    #[error("project mismatch")]
    ProjectMismatch,
    #[error(transparent)]
    Storage(#[from] StorageError),
}

pub struct DsnValidator {
    pool: PgPool,
    cache: Arc<DashMap<String, CachedDsn>>,
}

impl DsnValidator {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            cache: Arc::new(DashMap::new()),
        }
    }

    pub async fn validate(
        &self,
        public_key: &str,
        secret_key: &str,
        project_id: Uuid,
    ) -> Result<DsnRecord, DsnAuthError> {
        let record = if let Some(entry) = self.cache.get(public_key) {
            if entry.last_hit.elapsed() < CACHE_TTL {
                let record = entry.record.clone();
                drop(entry);
                if let Some(mut existing) = self.cache.get_mut(public_key) {
                    existing.last_hit = Instant::now();
                }
                record
            } else {
                drop(entry);
                self.cache.remove(public_key);
                self.load_record(public_key).await?
            }
        } else {
            self.load_record(public_key).await?
        };

        if record.revoked {
            return Err(DsnAuthError::Revoked);
        }

        if record.project_id != project_id {
            return Err(DsnAuthError::ProjectMismatch);
        }

        if !constant_time_secret_eq(&record.secret_key, secret_key.as_bytes()) {
            return Err(DsnAuthError::Invalid);
        }

        Ok(record)
    }

    async fn load_record(&self, public_key: &str) -> Result<DsnRecord, DsnAuthError> {
        let row = sqlx::query_as::<_, DsnRow>(
            r#"
            SELECT project_id, org_id, secret_key, revoked_at
            FROM ingest_lookup_dsn($1)
            "#,
        )
        .bind(public_key)
        .fetch_optional(&self.pool)
        .await
        .map_err(StorageError::from)?;

        let row = row.ok_or(DsnAuthError::Invalid)?;
        let record = DsnRecord {
            project_id: row.project_id,
            org_id: row.org_id,
            secret_key: row.secret_key,
            revoked: row.revoked_at.is_some(),
        };

        if self.cache.len() >= MAX_CACHE {
            self.cache
                .retain(|_, value| value.last_hit.elapsed() < CACHE_TTL);
        }
        if self.cache.len() < MAX_CACHE {
            self.cache.insert(
                public_key.to_string(),
                CachedDsn {
                    record: record.clone(),
                    last_hit: Instant::now(),
                },
            );
        }
        Ok(record)
    }

    pub fn invalidate(&self, public_key: &str) {
        self.cache.remove(public_key);
    }
}

#[derive(sqlx::FromRow)]
struct DsnRow {
    project_id: Uuid,
    org_id: Uuid,
    secret_key: Vec<u8>,
    revoked_at: Option<chrono::DateTime<chrono::Utc>>,
}

fn constant_time_secret_eq(stored: &[u8], provided: &[u8]) -> bool {
    if stored.len() != provided.len() {
        return false;
    }
    stored.ct_eq(provided).into()
}
