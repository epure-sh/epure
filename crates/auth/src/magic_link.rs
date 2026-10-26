use crate::session::DashboardSession;
use chrono::Utc;
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum MagicLinkError {
    #[error("magic link token not found, already used, or expired")]
    InvalidOrExpiredToken,
    #[error("public registration is closed")]
    RegistrationClosed,
    #[error(transparent)]
    Sqlx(#[from] sqlx::Error),
}

#[derive(sqlx::FromRow)]
struct MagicLinkSessionRow {
    user_id: Uuid,
    org_id: Uuid,
    email: String,
    role: String,
}

pub fn hash_token(raw: &str) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    hasher.finalize().to_vec()
}

pub async fn create_magic_link(
    pool: &PgPool,
    email: &str,
    org_id: Option<Uuid>,
    role: Option<&str>,
) -> Result<String, MagicLinkError> {
    let normalized = email.trim().to_lowercase();
    let raw_token = format!("eml_{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    let token_hash = hash_token(&raw_token);
    let expires_at = Utc::now() + chrono::Duration::minutes(15);

    sqlx::query("SELECT auth_insert_magic_link_token($1, $2, $3, $4, $5)")
        .bind(&normalized)
        .bind(org_id)
        .bind(role)
        .bind(&token_hash)
        .bind(expires_at)
        .execute(pool)
        .await?;

    Ok(raw_token)
}

pub async fn verify_magic_link(
    pool: &PgPool,
    raw_token: &str,
) -> Result<DashboardSession, MagicLinkError> {
    let token_hash = hash_token(raw_token);

    let allow_self_serve = crate::registration_enabled();
    let row = sqlx::query_as::<_, MagicLinkSessionRow>(
        r#"
        SELECT user_id, org_id, email, role
        FROM auth_consume_magic_link($1, $2)
        "#,
    )
    .bind(&token_hash)
    .bind(allow_self_serve)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        if e.to_string().contains("registration_closed") {
            MagicLinkError::RegistrationClosed
        } else if e.to_string().contains("invalid_magic_link") {
            MagicLinkError::InvalidOrExpiredToken
        } else {
            MagicLinkError::Sqlx(e)
        }
    })?;

    let Some(row) = row else {
        return Err(MagicLinkError::InvalidOrExpiredToken);
    };

    Ok(DashboardSession {
        user_id: row.user_id,
        org_id: row.org_id,
        email: row.email,
        role: row.role,
    })
}
