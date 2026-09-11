use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UserFeedbackRow {
    pub id: Uuid,
    pub event_id: Uuid,
    pub name: Option<String>,
    pub email: Option<String>,
    pub comments: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub struct InsertFeedbackParams {
    pub event_id: Uuid,
    pub project_id: Uuid,
    pub name: Option<String>,
    pub email: Option<String>,
    pub comments: Option<String>,
}

pub async fn insert_feedback(
    pool: &PgPool,
    org_id: Uuid,
    params: InsertFeedbackParams,
) -> Result<Uuid, sqlx::Error> {
    let mut tx = crate::rls::begin_ingest_transaction(pool, org_id).await?;
    let id = sqlx::query_scalar(
        r#"
        INSERT INTO user_feedback (event_id, project_id, name, email, comments)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        "#,
    )
    .bind(params.event_id)
    .bind(params.project_id)
    .bind(&params.name)
    .bind(&params.email)
    .bind(&params.comments)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(id)
}

pub async fn feedback_for_event(
    pool: &PgPool,
    org_id: Uuid,
    event_id: Uuid,
) -> Result<Option<UserFeedbackRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;

    let row = sqlx::query_as::<_, UserFeedbackRow>(
        r#"
        SELECT uf.id, uf.event_id, uf.name, uf.email, uf.comments, uf.created_at
        FROM user_feedback uf
        INNER JOIN events e ON e.id = uf.event_id
        INNER JOIN issues i ON i.id = e.issue_id
        WHERE uf.event_id = $1
          AND i.org_id = $2
        ORDER BY uf.created_at DESC
        LIMIT 1
        "#,
    )
    .bind(event_id)
    .bind(org_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(row)
}

pub async fn event_exists(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    event_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let mut tx = crate::rls::begin_ingest_transaction(pool, org_id).await?;
    let count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint
        FROM events
        WHERE id = $1 AND project_id = $2
        "#,
    )
    .bind(event_id)
    .bind(project_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(count > 0)
}
