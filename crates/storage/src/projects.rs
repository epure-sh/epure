use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct ProjectRow {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    pub slug: Option<String>,
    pub retention_days: i32,
    pub ingest_cap_per_hour: i32,
    pub is_demo: bool,
    pub created_at: DateTime<Utc>,
}

pub struct CreateProjectParams {
    pub name: String,
    pub slug: String,
}

pub struct UpdateProjectParams {
    pub name: Option<String>,
    pub retention_days: Option<i32>,
    pub ingest_cap_per_hour: Option<i32>,
}

pub async fn list_projects(pool: &PgPool, org_id: Uuid) -> Result<Vec<ProjectRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let rows = sqlx::query_as::<_, ProjectRow>(
        r#"
        SELECT id, org_id, name, slug, retention_days, ingest_cap_per_hour, is_demo, created_at
        FROM projects
        ORDER BY created_at ASC
        "#,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

pub async fn get_project(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
) -> Result<Option<ProjectRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, ProjectRow>(
        r#"
        SELECT id, org_id, name, slug, retention_days, ingest_cap_per_hour, is_demo, created_at
        FROM projects
        WHERE id = $1
        "#,
    )
    .bind(project_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

pub async fn create_project(
    pool: &PgPool,
    org_id: Uuid,
    params: CreateProjectParams,
) -> Result<ProjectRow, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, ProjectRow>(
        r#"
        INSERT INTO projects (org_id, name, slug, retention_days, ingest_cap_per_hour, is_demo)
        VALUES ($1, $2, $3, 30, 5000, false)
        RETURNING id, org_id, name, slug, retention_days, ingest_cap_per_hour, is_demo, created_at
        "#,
    )
    .bind(org_id)
    .bind(&params.name)
    .bind(&params.slug)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

pub async fn update_project(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    params: UpdateProjectParams,
) -> Result<Option<ProjectRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;

    let current = sqlx::query_as::<_, ProjectRow>(
        r#"
        SELECT id, org_id, name, slug, retention_days, ingest_cap_per_hour, is_demo, created_at
        FROM projects
        WHERE id = $1
        "#,
    )
    .bind(project_id)
    .fetch_optional(&mut *tx)
    .await?;

    let Some(current) = current else {
        tx.commit().await?;
        return Ok(None);
    };

    let name = params.name.unwrap_or(current.name);
    let retention_days = params.retention_days.unwrap_or(current.retention_days);
    let ingest_cap = params
        .ingest_cap_per_hour
        .unwrap_or(current.ingest_cap_per_hour);

    let row = sqlx::query_as::<_, ProjectRow>(
        r#"
        UPDATE projects
        SET name = $2, retention_days = $3, ingest_cap_per_hour = $4
        WHERE id = $1
        RETURNING id, org_id, name, slug, retention_days, ingest_cap_per_hour, is_demo, created_at
        "#,
    )
    .bind(project_id)
    .bind(name)
    .bind(retention_days)
    .bind(ingest_cap)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Some(row))
}

pub async fn delete_project(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let result = sqlx::query("DELETE FROM projects WHERE id = $1")
        .bind(project_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(result.rows_affected() > 0)
}

pub async fn ingest_cap_for_project(pool: &PgPool, project_id: Uuid) -> Result<i32, sqlx::Error> {
    sqlx::query_scalar("SELECT ingest_cap_per_hour FROM ingest_project_meta($1)")
        .bind(project_id)
        .fetch_one(pool)
        .await
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ProjectIngestMeta {
    pub org_id: Uuid,
    pub name: String,
    pub ingest_cap_per_hour: i32,
}

pub async fn project_ingest_meta(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Option<ProjectIngestMeta>, sqlx::Error> {
    sqlx::query_as::<_, ProjectIngestMeta>(
        r#"
        SELECT org_id, name, ingest_cap_per_hour
        FROM ingest_project_meta($1)
        "#,
    )
    .bind(project_id)
    .fetch_optional(pool)
    .await
}
