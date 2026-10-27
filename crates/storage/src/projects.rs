use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct ProjectRow {
    pub id: Uuid,
    pub dsn_project_id: i64,
    pub org_id: Uuid,
    pub name: String,
    pub slug: Option<String>,
    pub retention_days: i32,
    pub ingest_cap_per_hour: i32,
    pub store_end_user_identifiers: bool,
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
    pub store_end_user_identifiers: Option<bool>,
}

/// Plan tier and project count for the current org, read inside an RLS-bound transaction.
pub async fn org_plan_and_project_count(
    pool: &PgPool,
    org_id: Uuid,
) -> Result<(String, i64), sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let plan_tier: String = sqlx::query_scalar("SELECT plan_tier FROM organizations WHERE id = $1")
        .bind(org_id)
        .fetch_optional(&mut *tx)
        .await?
        .unwrap_or_else(|| "oss".to_string());
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM projects")
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok((plan_tier, count))
}

pub async fn list_projects(pool: &PgPool, org_id: Uuid) -> Result<Vec<ProjectRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let rows = sqlx::query_as::<_, ProjectRow>(
        r#"
        SELECT id, dsn_project_id, org_id, name, slug, retention_days, ingest_cap_per_hour, store_end_user_identifiers, is_demo, created_at
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
        SELECT id, dsn_project_id, org_id, name, slug, retention_days, ingest_cap_per_hour, store_end_user_identifiers, is_demo, created_at
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

pub async fn resolve_project_id(
    pool: &PgPool,
    org_id: Uuid,
    project_ref: &str,
) -> Result<Option<Uuid>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = if let Ok(id) = Uuid::parse_str(project_ref) {
        sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM projects WHERE org_id = $1 AND id = $2 LIMIT 1",
        )
        .bind(org_id)
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
    } else {
        sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM projects WHERE org_id = $1 AND slug = $2 LIMIT 1",
        )
        .bind(org_id)
        .bind(project_ref)
        .fetch_optional(&mut *tx)
        .await?
    };
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
        RETURNING id, dsn_project_id, org_id, name, slug, retention_days, ingest_cap_per_hour, store_end_user_identifiers, is_demo, created_at
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
        SELECT id, dsn_project_id, org_id, name, slug, retention_days, ingest_cap_per_hour, store_end_user_identifiers, is_demo, created_at
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
    let store_identifiers = params
        .store_end_user_identifiers
        .unwrap_or(current.store_end_user_identifiers);

    let row = sqlx::query_as::<_, ProjectRow>(
        r#"
        UPDATE projects
        SET name = $2, retention_days = $3, ingest_cap_per_hour = $4, store_end_user_identifiers = $5
        WHERE id = $1
        RETURNING id, dsn_project_id, org_id, name, slug, retention_days, ingest_cap_per_hour, store_end_user_identifiers, is_demo, created_at
        "#,
    )
    .bind(project_id)
    .bind(name)
    .bind(retention_days)
    .bind(ingest_cap)
    .bind(store_identifiers)
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

pub async fn ingest_store_end_user_identifiers(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar("SELECT ingest_store_end_user_identifiers($1)")
        .bind(project_id)
        .fetch_one(pool)
        .await
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

pub async fn project_id_for_dsn_segment(
    pool: &PgPool,
    dsn_project_id: i64,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT ingest_lookup_project_id($1)")
        .bind(dsn_project_id)
        .fetch_optional(pool)
        .await
}

/// Plan tier for an org on the ingest connection (RLS via `ingest_set_org_context`).
pub async fn ingest_org_plan_tier(pool: &PgPool, org_id: Uuid) -> Result<String, sqlx::Error> {
    let mut tx = crate::rls::begin_ingest_transaction(pool, org_id).await?;
    let tier: Option<String> =
        sqlx::query_scalar("SELECT plan_tier FROM organizations WHERE id = $1")
            .bind(org_id)
            .fetch_optional(&mut *tx)
            .await?;
    tx.commit().await?;
    Ok(tier.unwrap_or_else(|| "oss".to_string()))
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
