use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

tokio::task_local! {
    static REQUEST_USER_ID: Uuid;
}

/// Run `fut` with a dashboard user id so RLS GUCs are membership-bound.
pub async fn with_request_user<F, R>(user_id: Uuid, fut: F) -> R
where
    F: std::future::Future<Output = R>,
{
    REQUEST_USER_ID.scope(user_id, fut).await
}

fn request_user_id() -> Option<Uuid> {
    REQUEST_USER_ID.try_with(|id| *id).ok()
}

/// Set tenant GUCs for the current transaction (LOCAL scope).
pub async fn set_org_context(
    tx: &mut Transaction<'_, Postgres>,
    org_id: Uuid,
) -> Result<(), sqlx::Error> {
    if let Some(user_id) = request_user_id() {
        sqlx::query("SELECT app_set_org_context($1, $2)")
            .bind(user_id)
            .bind(org_id)
            .execute(&mut **tx)
            .await?;
    } else {
        sqlx::query("SELECT ingest_set_org_context($1)")
            .bind(org_id)
            .execute(&mut **tx)
            .await?;
    }
    Ok(())
}

/// Begin a transaction with RLS org context already set.
pub async fn begin_org_transaction(
    pool: &PgPool,
    org_id: Uuid,
) -> Result<Transaction<'_, Postgres>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    set_org_context(&mut tx, org_id).await?;
    Ok(tx)
}

/// Ingest path: org comes from the authenticated DSN (server-side).
pub async fn begin_ingest_transaction(
    pool: &PgPool,
    org_id: Uuid,
) -> Result<Transaction<'_, Postgres>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    sqlx::query("SELECT ingest_set_org_context($1)")
        .bind(org_id)
        .execute(&mut *tx)
        .await?;
    Ok(tx)
}
