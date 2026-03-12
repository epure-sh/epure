use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct DsnKeyRow {
    pub id: Uuid,
    pub project_id: Uuid,
    pub public_key: String,
    pub label: Option<String>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct CreatedDsnKey {
    pub id: Uuid,
    pub project_id: Uuid,
    pub public_key: String,
    pub secret_key: String,
    pub label: Option<String>,
    pub created_at: DateTime<Utc>,
}

pub async fn list_for_project(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
) -> Result<Vec<DsnKeyRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let rows = sqlx::query_as::<_, DsnKeyRow>(
        r#"
        SELECT d.id, d.project_id, d.public_key, d.label, d.revoked_at, d.created_at
        FROM dsn_keys d
        INNER JOIN projects p ON p.id = d.project_id
        WHERE d.project_id = $1
        ORDER BY d.created_at DESC
        "#,
    )
    .bind(project_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

pub async fn create_key(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    public_key: &str,
    secret_key: &[u8],
    label: Option<&str>,
) -> Result<CreatedDsnKey, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;

    let project_exists =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM projects WHERE id = $1")
            .bind(project_id)
            .fetch_one(&mut *tx)
            .await?;
    if project_exists == 0 {
        tx.commit().await?;
        return Err(sqlx::Error::RowNotFound);
    }

    let row = sqlx::query_as::<_, DsnKeyRow>(
        r#"
        INSERT INTO dsn_keys (project_id, public_key, secret_key, label)
        VALUES ($1, $2, $3, $4)
        RETURNING id, project_id, public_key, label, revoked_at, created_at
        "#,
    )
    .bind(project_id)
    .bind(public_key)
    .bind(secret_key)
    .bind(label)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(CreatedDsnKey {
        id: row.id,
        project_id: row.project_id,
        public_key: row.public_key,
        secret_key: String::from_utf8_lossy(secret_key).into_owned(),
        label: row.label,
        created_at: row.created_at,
    })
}

pub async fn revoke_key(
    pool: &PgPool,
    org_id: Uuid,
    key_id: Uuid,
) -> Result<Option<String>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let public_key = sqlx::query_scalar::<_, String>(
        r#"
        UPDATE dsn_keys
        SET revoked_at = now()
        WHERE id = $1 AND revoked_at IS NULL
        RETURNING public_key
        "#,
    )
    .bind(key_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(public_key)
}

pub async fn first_active_public_key(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
) -> Result<Option<String>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let key = sqlx::query_scalar::<_, String>(
        r#"
        SELECT d.public_key
        FROM dsn_keys d
        INNER JOIN projects p ON p.id = d.project_id
        WHERE d.project_id = $1 AND d.revoked_at IS NULL
        ORDER BY d.created_at DESC
        LIMIT 1
        "#,
    )
    .bind(project_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(key)
}

pub async fn revoke_active_for_project(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
) -> Result<Vec<String>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let keys = sqlx::query_scalar::<_, String>(
        r#"
        UPDATE dsn_keys
        SET revoked_at = now()
        WHERE project_id = $1 AND revoked_at IS NULL
        RETURNING public_key
        "#,
    )
    .bind(project_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(keys)
}
