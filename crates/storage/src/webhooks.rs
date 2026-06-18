use chrono::{DateTime, Utc};
use rand::RngCore;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow, serde::Serialize, Clone)]
pub struct WebhookRow {
    pub id: Uuid,
    pub project_id: Uuid,
    pub url: String,
    pub format: String,
    pub events: Vec<String>,
    pub secret_prefix: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct WebhookDispatchRow {
    pub id: Uuid,
    pub project_id: Uuid,
    pub url: String,
    pub format: String,
    pub events: Vec<String>,
    pub signing_secret: Vec<u8>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct CreatedWebhook {
    pub id: Uuid,
    pub project_id: Uuid,
    pub url: String,
    pub format: String,
    pub events: Vec<String>,
    pub secret_prefix: String,
    pub signing_secret: String,
    pub created_at: DateTime<Utc>,
}

pub struct CreateWebhookParams {
    pub project_id: Uuid,
    pub url: String,
    pub format: String,
    pub events: Vec<String>,
}

pub fn generate_signing_secret() -> (Vec<u8>, String, String) {
    let mut bytes = [0u8; 32];
    rand::rng().fill_bytes(&mut bytes);
    let encoded = hex::encode(bytes);
    let signing_secret = format!("whsec_{encoded}");
    let secret_prefix = format!("whsec_{}", encoded[..8].to_string());
    (bytes.to_vec(), secret_prefix, signing_secret)
}

pub async fn list_for_project_ingest(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Vec<WebhookDispatchRow>, sqlx::Error> {
    sqlx::query_as::<_, WebhookDispatchRow>(
        r#"
        SELECT id, project_id, url, format, events, signing_secret
        FROM webhooks
        WHERE project_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
}

pub async fn get_for_dispatch(
    pool: &PgPool,
    webhook_id: Uuid,
) -> Result<Option<WebhookDispatchRow>, sqlx::Error> {
    sqlx::query_as::<_, WebhookDispatchRow>(
        r#"
        SELECT id, project_id, url, format, events, signing_secret
        FROM webhooks
        WHERE id = $1
        "#,
    )
    .bind(webhook_id)
    .fetch_optional(pool)
    .await
}

pub async fn get_for_dispatch_org(
    pool: &PgPool,
    org_id: Uuid,
    webhook_id: Uuid,
) -> Result<Option<WebhookDispatchRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, WebhookDispatchRow>(
        r#"
        SELECT w.id, w.project_id, w.url, w.format, w.events, w.signing_secret
        FROM webhooks w
        INNER JOIN projects p ON p.id = w.project_id
        WHERE w.id = $1
        "#,
    )
    .bind(webhook_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

pub async fn list_for_project(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
) -> Result<Vec<WebhookRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let rows = sqlx::query_as::<_, WebhookRow>(
        r#"
        SELECT id, project_id, url, format, events, secret_prefix, created_at
        FROM webhooks
        WHERE project_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(project_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

pub async fn create_webhook(
    pool: &PgPool,
    org_id: Uuid,
    params: CreateWebhookParams,
) -> Result<CreatedWebhook, sqlx::Error> {
    let (signing_secret, secret_prefix, signing_secret_display) = generate_signing_secret();
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, WebhookRow>(
        r#"
        INSERT INTO webhooks (project_id, url, format, events, signing_secret, secret_prefix)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, project_id, url, format, events, secret_prefix, created_at
        "#,
    )
    .bind(params.project_id)
    .bind(&params.url)
    .bind(&params.format)
    .bind(&params.events)
    .bind(&signing_secret)
    .bind(&secret_prefix)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(CreatedWebhook {
        id: row.id,
        project_id: row.project_id,
        url: row.url,
        format: row.format,
        events: row.events,
        secret_prefix: row.secret_prefix,
        signing_secret: signing_secret_display,
        created_at: row.created_at,
    })
}

pub async fn rotate_signing_secret(
    pool: &PgPool,
    org_id: Uuid,
    webhook_id: Uuid,
) -> Result<Option<CreatedWebhook>, sqlx::Error> {
    let (signing_secret, secret_prefix, signing_secret_display) = generate_signing_secret();
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, WebhookRow>(
        r#"
        UPDATE webhooks
        SET signing_secret = $2, secret_prefix = $3
        WHERE id = $1
        RETURNING id, project_id, url, format, events, secret_prefix, created_at
        "#,
    )
    .bind(webhook_id)
    .bind(&signing_secret)
    .bind(&secret_prefix)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row.map(|row| CreatedWebhook {
        id: row.id,
        project_id: row.project_id,
        url: row.url,
        format: row.format,
        events: row.events,
        secret_prefix: row.secret_prefix,
        signing_secret: signing_secret_display,
        created_at: row.created_at,
    }))
}

pub async fn delete_webhook(
    pool: &PgPool,
    org_id: Uuid,
    webhook_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let result = sqlx::query("DELETE FROM webhooks WHERE id = $1")
        .bind(webhook_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(result.rows_affected() > 0)
}
