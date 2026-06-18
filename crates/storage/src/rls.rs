use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

/// Set `app.current_org_id` for the current transaction (LOCAL scope).
pub async fn set_org_context(
    tx: &mut Transaction<'_, Postgres>,
    org_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("SELECT set_config('app.current_org_id', $1, true)")
        .bind(org_id.to_string())
        .execute(&mut **tx)
        .await?;
    Ok(())
}

/// Begin a dashboard transaction with RLS org context already set.
pub async fn begin_org_transaction(
    pool: &PgPool,
    org_id: Uuid,
) -> Result<Transaction<'_, Postgres>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    set_org_context(&mut tx, org_id).await?;
    Ok(tx)
}
