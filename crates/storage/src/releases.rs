use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Row};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseHealthBucketPoint {
    pub bucket_minute: DateTime<Utc>,
    pub sessions_started: i64,
    pub sessions_crashed: i64,
    pub sessions_errored: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseHealthStat {
    pub release: String,
    pub environment: String,
    pub total_sessions: i64,
    pub crashed_sessions: i64,
    pub errored_sessions: i64,
    pub crash_free_rate: f64,
    pub duration_ms_p50: Option<i32>,
    pub sparkline: Vec<ReleaseHealthBucketPoint>,
}

#[derive(Debug, sqlx::FromRow, serde::Serialize)]
pub struct ReleaseSummary {
    pub id: Uuid,
    pub project_id: Uuid,
    pub version: String,
    pub artifact_count: i64,
    pub last_upload_at: Option<DateTime<Utc>>,
    pub first_seen_at: Option<DateTime<Utc>>,
    pub last_seen_at: Option<DateTime<Utc>>,
    pub issue_count: i64,
    pub event_count: i64,
    pub regression_count: i64,
    pub new_issue_count: i64,
}

pub async fn list_releases_for_project(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
) -> Result<Vec<ReleaseSummary>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;

    sqlx::query(
        r#"
        INSERT INTO releases (project_id, version)
        SELECT DISTINCT project_id, release
        FROM (
            SELECT project_id, release FROM events WHERE project_id = $1 AND release IS NOT NULL AND release <> ''
            UNION
            SELECT project_id, release FROM issues WHERE project_id = $1 AND release IS NOT NULL AND release <> ''
        ) distinct_releases
        ON CONFLICT (project_id, version) DO NOTHING
        "#,
    )
    .bind(project_id)
    .execute(&mut *tx)
    .await?;

    let rows = sqlx::query_as::<_, ReleaseSummary>(
        r#"
        SELECT
            r.id,
            r.project_id,
            r.version,
            COALESCE(artifact_stats.artifact_count, 0)::bigint AS artifact_count,
            artifact_stats.last_upload_at,
            event_stats.first_seen_at,
            event_stats.last_seen_at,
            COALESCE(event_stats.issue_count, 0)::bigint AS issue_count,
            COALESCE(event_stats.event_count, 0)::bigint AS event_count,
            COALESCE(regression_stats.regression_count, 0)::bigint AS regression_count,
            COALESCE(new_stats.new_issue_count, 0)::bigint AS new_issue_count
        FROM releases r
        LEFT JOIN LATERAL (
            SELECT
                COUNT(*)::bigint AS artifact_count,
                MAX(created_at) AS last_upload_at
            FROM release_artifacts
            WHERE release_id = r.id
        ) artifact_stats ON true
        LEFT JOIN LATERAL (
            SELECT
                MIN(occurred_at) AS first_seen_at,
                MAX(occurred_at) AS last_seen_at,
                COUNT(DISTINCT issue_id)::bigint AS issue_count,
                COUNT(*)::bigint AS event_count
            FROM events
            WHERE project_id = r.project_id AND release = r.version
        ) event_stats ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::bigint AS regression_count
            FROM issues
            WHERE project_id = r.project_id
              AND status = 'regression'
              AND release = r.version
        ) regression_stats ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::bigint AS new_issue_count
            FROM issues i
            WHERE i.project_id = r.project_id
              AND EXISTS (
                SELECT 1
                FROM events fe
                WHERE fe.issue_id = i.id
                  AND fe.release = r.version
                  AND fe.occurred_at = (
                    SELECT MIN(occurred_at) FROM events WHERE issue_id = i.id
                  )
              )
        ) new_stats ON true
        WHERE r.project_id = $1
        ORDER BY
            event_stats.last_seen_at DESC NULLS LAST,
            artifact_stats.last_upload_at DESC NULLS LAST,
            r.version DESC
        "#,
    )
    .bind(project_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

pub async fn get_release_health_stats(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    release: Option<&str>,
    environment: Option<&str>,
    since: DateTime<Utc>,
) -> Result<Vec<ReleaseHealthStat>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;

    let summary_rows = sqlx::query(
        r#"
        SELECT
            release,
            environment,
            COALESCE(SUM(sessions_started), 0)::bigint AS total_sessions,
            COALESCE(SUM(sessions_crashed), 0)::bigint AS crashed_sessions,
            COALESCE(SUM(sessions_errored), 0)::bigint AS errored_sessions,
            AVG(duration_ms_p50)::integer AS duration_ms_p50
        FROM release_health_buckets
        WHERE project_id = $1
          AND ($2::text IS NULL OR release = $2)
          AND ($3::text IS NULL OR environment = $3)
          AND bucket_minute >= $4
        GROUP BY release, environment
        ORDER BY total_sessions DESC
        "#,
    )
    .bind(project_id)
    .bind(release)
    .bind(environment)
    .bind(since)
    .fetch_all(&mut *tx)
    .await?;

    let bucket_rows = sqlx::query(
        r#"
        SELECT
            release,
            environment,
            bucket_minute,
            sessions_started,
            sessions_crashed,
            sessions_errored
        FROM release_health_buckets
        WHERE project_id = $1
          AND ($2::text IS NULL OR release = $2)
          AND ($3::text IS NULL OR environment = $3)
          AND bucket_minute >= $4
        ORDER BY bucket_minute ASC
        "#,
    )
    .bind(project_id)
    .bind(release)
    .bind(environment)
    .bind(since)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let mut buckets_map: std::collections::HashMap<
        (String, String),
        Vec<ReleaseHealthBucketPoint>,
    > = std::collections::HashMap::new();

    for row in bucket_rows {
        let rel: String = row.try_get("release")?;
        let env: String = row.try_get("environment")?;
        let pt = ReleaseHealthBucketPoint {
            bucket_minute: row.try_get("bucket_minute")?,
            sessions_started: row.try_get("sessions_started")?,
            sessions_crashed: row.try_get("sessions_crashed")?,
            sessions_errored: row.try_get("sessions_errored")?,
        };
        buckets_map.entry((rel, env)).or_default().push(pt);
    }

    let mut results = Vec::with_capacity(summary_rows.len());
    for row in summary_rows {
        let rel: String = row.try_get("release")?;
        let env: String = row.try_get("environment")?;
        let total: i64 = row.try_get("total_sessions")?;
        let crashed: i64 = row.try_get("crashed_sessions")?;
        let errored: i64 = row.try_get("errored_sessions")?;
        let duration_ms_p50: Option<i32> = row.try_get("duration_ms_p50").ok();

        let crash_free_rate = if total > 0 {
            ((total - crashed).max(0) as f64 / total as f64) * 100.0
        } else {
            100.0
        };

        let sparkline = buckets_map
            .remove(&(rel.clone(), env.clone()))
            .unwrap_or_default();

        results.push(ReleaseHealthStat {
            release: rel,
            environment: env,
            total_sessions: total,
            crashed_sessions: crashed,
            errored_sessions: errored,
            crash_free_rate,
            duration_ms_p50,
            sparkline,
        });
    }

    Ok(results)
}

pub struct ArtifactRecord {
    pub id: Uuid,
    pub name: String,
    pub storage_path: String,
}

/// Normalize sentry-cli artifact paths (`~/dist/app.min.js.map`) to a lookup basename.
pub fn artifact_basename(name: &str) -> String {
    let mut path = name.trim();
    if let Some(rest) = path.strip_prefix("~/") {
        path = rest;
    } else if let Some(rest) = path.strip_prefix('~') {
        path = rest;
    }
    if let Some(scheme_pos) = path.find("://") {
        path = path[scheme_pos + 3..].trim_start_matches('/');
    }
    path.trim_start_matches('/')
        .rsplit('/')
        .next()
        .unwrap_or(path)
        .to_string()
}

pub async fn ensure_release(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    version: &str,
) -> Result<Uuid, sqlx::Error> {
    let mut tx = crate::rls::begin_ingest_transaction(pool, org_id).await?;
    let id = sqlx::query_scalar(
        r#"
        INSERT INTO releases (project_id, version)
        VALUES ($1, $2)
        ON CONFLICT (project_id, version) DO UPDATE
        SET version = EXCLUDED.version
        RETURNING id
        "#,
    )
    .bind(project_id)
    .bind(version)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(id)
}

pub async fn upsert_artifact(
    pool: &PgPool,
    org_id: Uuid,
    release_id: Uuid,
    name: &str,
    storage_path: &str,
    bytes: &[u8],
) -> Result<Uuid, sqlx::Error> {
    let checksum = hex::encode(Sha256::digest(bytes));
    upsert_artifact_with_debug_id(
        pool,
        org_id,
        release_id,
        name,
        storage_path,
        Some(&checksum),
        None,
    )
    .await
}

pub async fn upsert_artifact_with_debug_id(
    pool: &PgPool,
    org_id: Uuid,
    release_id: Uuid,
    name: &str,
    storage_path: &str,
    checksum: Option<&str>,
    debug_id: Option<&str>,
) -> Result<Uuid, sqlx::Error> {
    let mut tx = crate::rls::begin_ingest_transaction(pool, org_id).await?;
    let id = sqlx::query_scalar(
        r#"
        INSERT INTO release_artifacts (release_id, name, storage_path, checksum, debug_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (release_id, name) DO UPDATE
        SET storage_path = EXCLUDED.storage_path,
            checksum = COALESCE(EXCLUDED.checksum, release_artifacts.checksum),
            debug_id = COALESCE(EXCLUDED.debug_id, CASE
                WHEN EXCLUDED.checksum = release_artifacts.checksum THEN release_artifacts.debug_id END)
        RETURNING id
        "#,
    )
    .bind(release_id)
    .bind(name)
    .bind(storage_path)
    .bind(checksum)
    .bind(debug_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(id)
}

pub async fn find_artifact_by_debug_id(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    debug_id: &str,
) -> Result<Option<ArtifactRecord>, sqlx::Error> {
    let mut tx = crate::rls::begin_ingest_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, ArtifactRow>(
        r#"
        SELECT ra.id, ra.name, ra.storage_path
        FROM release_artifacts ra JOIN releases r ON r.id = ra.release_id
        WHERE r.project_id = $1 AND ra.debug_id = $2
        ORDER BY ra.created_at DESC, ra.id DESC
        LIMIT 1
        "#,
    )
    .bind(project_id)
    .bind(debug_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row.map(ArtifactRow::into_record))
}

pub async fn find_artifact(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    version: &str,
    name: &str,
) -> Result<Option<ArtifactRecord>, sqlx::Error> {
    let mut tx = crate::rls::begin_ingest_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, ArtifactRow>(
        r#"
        SELECT ra.id, ra.name, ra.storage_path
        FROM release_artifacts ra
        INNER JOIN releases r ON r.id = ra.release_id
        WHERE r.project_id = $1 AND r.version = $2 AND ra.name = $3
        "#,
    )
    .bind(project_id)
    .bind(version)
    .bind(name)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row.map(|row| row.into_record()))
}

pub async fn find_artifact_for_map(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    version: &str,
    map_name: &str,
) -> Result<Option<ArtifactRecord>, sqlx::Error> {
    if let Some(record) = find_artifact(pool, org_id, project_id, version, map_name).await? {
        return Ok(Some(record));
    }

    let target = artifact_basename(map_name);
    let mut tx = crate::rls::begin_ingest_transaction(pool, org_id).await?;
    let rows = sqlx::query_as::<_, ArtifactRow>(
        r#"
        SELECT ra.id, ra.name, ra.storage_path
        FROM release_artifacts ra
        INNER JOIN releases r ON r.id = ra.release_id
        WHERE r.project_id = $1 AND r.version = $2
        "#,
    )
    .bind(project_id)
    .bind(version)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(rows.into_iter().find_map(|row| {
        if artifact_basename(&row.name) == target {
            Some(row.into_record())
        } else {
            None
        }
    }))
}

struct ArtifactRow {
    id: Uuid,
    name: String,
    storage_path: String,
}

impl sqlx::FromRow<'_, sqlx::postgres::PgRow> for ArtifactRow {
    fn from_row(row: &sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            name: row.try_get("name")?,
            storage_path: row.try_get("storage_path")?,
        })
    }
}

impl ArtifactRow {
    fn into_record(self) -> ArtifactRecord {
        ArtifactRecord {
            id: self.id,
            name: self.name,
            storage_path: self.storage_path,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn artifact_basename_strips_sentry_prefixes() {
        assert_eq!(artifact_basename("app.min.js.map"), "app.min.js.map");
        assert_eq!(artifact_basename("~/dist/app.min.js.map"), "app.min.js.map");
        assert_eq!(
            artifact_basename("https://cdn.example.com/static/app.min.js.map"),
            "app.min.js.map"
        );
    }

    #[test]
    fn artifact_basename_handles_edge_cases() {
        assert_eq!(artifact_basename(""), "");
        assert_eq!(artifact_basename("  ~/foo.js.map  "), "foo.js.map");
        assert_eq!(
            artifact_basename("http://localhost:8080/static/bundle.js.map"),
            "bundle.js.map"
        );
    }
}
