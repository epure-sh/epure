use sqlx::PgPool;

const DEV_SEED_SQL: &str = include_str!("../../../scripts/seed-dev.sql");

/// Idempotent dev org, project, DSN, and dashboard user (`dev@epure.local` / `devpassword`).
pub async fn run_dev_seed(pool: &PgPool) -> Result<(), sqlx::Error> {
    for statement in DEV_SEED_SQL
        .split(';')
        .map(str::trim)
        .filter(|part| !part.is_empty())
    {
        sqlx::query(statement).execute(pool).await?;
    }
    Ok(())
}
