use sqlx::PgPool;
use uuid::Uuid;

pub fn user_key(user_id: Option<&str>, user_email: Option<&str>) -> Option<String> {
    user_id
        .map(str::to_string)
        .or_else(|| user_email.map(str::to_string))
        .filter(|value| !value.is_empty())
}

/// Record a unique user for an issue. Returns `true` when this is a new user key.
pub async fn record_unique_user(
    pool: &PgPool,
    issue_id: Uuid,
    user_key: &str,
) -> Result<bool, sqlx::Error> {
    let inserted = sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO issue_unique_users (issue_id, user_key)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        RETURNING issue_id
        "#,
    )
    .bind(issue_id)
    .bind(user_key)
    .fetch_optional(pool)
    .await?;

    if inserted.is_some() {
        sqlx::query(
            r#"
            UPDATE issues
            SET unique_user_count = unique_user_count + 1
            WHERE id = $1
            "#,
        )
        .bind(issue_id)
        .execute(pool)
        .await?;
        Ok(true)
    } else {
        Ok(false)
    }
}

pub async fn count_unique_users(pool: &PgPool, issue_id: Uuid) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint
        FROM issue_unique_users
        WHERE issue_id = $1
        "#,
    )
    .bind(issue_id)
    .fetch_one(pool)
    .await
}
