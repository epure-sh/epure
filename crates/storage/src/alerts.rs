use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow, serde::Serialize)]
pub struct AlertRow {
    pub id: Uuid,
    pub org_id: Uuid,
    pub project_id: Uuid,
    pub issue_id: Option<Uuid>,
    pub kind: String,
    pub fired_at: DateTime<Utc>,
    pub payload_json: Value,
}

pub struct InsertAlertParams {
    pub org_id: Uuid,
    pub project_id: Uuid,
    pub issue_id: Option<Uuid>,
    pub kind: String,
    pub payload_json: Value,
}

pub async fn insert_alert(pool: &PgPool, params: InsertAlertParams) -> Result<Uuid, sqlx::Error> {
    sqlx::query_scalar(
        r#"
        INSERT INTO alerts (org_id, project_id, issue_id, kind, payload_json)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        "#,
    )
    .bind(params.org_id)
    .bind(params.project_id)
    .bind(params.issue_id)
    .bind(&params.kind)
    .bind(&params.payload_json)
    .fetch_one(pool)
    .await
}

pub async fn list_alerts(
    pool: &PgPool,
    org_id: Uuid,
    limit: i64,
    project_id: Option<Uuid>,
    environment: Option<&str>,
) -> Result<Vec<AlertRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let rows = sqlx::query_as::<_, AlertRow>(
        r#"
        SELECT a.id, a.org_id, a.project_id, a.issue_id, a.kind, a.fired_at, a.payload_json
        FROM alerts a
        LEFT JOIN issues i ON i.id = a.issue_id
        WHERE ($2::uuid IS NULL OR a.project_id = $2)
          AND (
            $3::text IS NULL
            OR i.environment = $3
            OR (a.issue_id IS NULL AND $3 IS NULL)
          )
        ORDER BY a.fired_at DESC
        LIMIT $1
        "#,
    )
    .bind(limit)
    .bind(project_id)
    .bind(environment)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}
