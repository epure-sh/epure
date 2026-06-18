use chrono::{DateTime, Utc};
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Row};
use uuid::Uuid;

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
    project_id: Uuid,
    version: &str,
) -> Result<Uuid, sqlx::Error> {
    sqlx::query_scalar(
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
    .fetch_one(pool)
    .await
}

pub async fn upsert_artifact(
    pool: &PgPool,
    release_id: Uuid,
    name: &str,
    storage_path: &str,
    bytes: &[u8],
) -> Result<Uuid, sqlx::Error> {
    let checksum = hex::encode(Sha256::digest(bytes));
    sqlx::query_scalar(
        r#"
        INSERT INTO release_artifacts (release_id, name, storage_path, checksum)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (release_id, name) DO UPDATE
        SET storage_path = EXCLUDED.storage_path,
            checksum = EXCLUDED.checksum
        RETURNING id
        "#,
    )
    .bind(release_id)
    .bind(name)
    .bind(storage_path)
    .bind(checksum)
    .fetch_one(pool)
    .await
}

pub async fn find_artifact(
    pool: &PgPool,
    project_id: Uuid,
    version: &str,
    name: &str,
) -> Result<Option<ArtifactRecord>, sqlx::Error> {
    sqlx::query_as::<_, ArtifactRow>(
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
    .fetch_optional(pool)
    .await
    .map(|row| row.map(|row| row.into_record()))
}

pub async fn find_artifact_for_map(
    pool: &PgPool,
    project_id: Uuid,
    version: &str,
    map_name: &str,
) -> Result<Option<ArtifactRecord>, sqlx::Error> {
    if let Some(record) = find_artifact(pool, project_id, version, map_name).await? {
        return Ok(Some(record));
    }

    let target = artifact_basename(map_name);
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
    .fetch_all(pool)
    .await?;

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
        assert_eq!(
            artifact_basename("~/dist/app.min.js.map"),
            "app.min.js.map"
        );
        assert_eq!(
            artifact_basename("https://cdn.example.com/static/app.min.js.map"),
            "app.min.js.map"
        );
    }
}
