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
struct MagicTokenRecord {
    id: Uuid,
    email: String,
    org_id: Option<Uuid>,
    role: Option<String>,
}

#[derive(sqlx::FromRow)]
struct UserMembershipRow {
    user_id: Uuid,
    email: String,
    org_id: Uuid,
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

    sqlx::query(
        r#"
        INSERT INTO magic_link_tokens (email, token_hash, org_id, role, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(&normalized)
    .bind(&token_hash)
    .bind(org_id)
    .bind(role)
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

    let mut tx = pool.begin().await?;

    let record = sqlx::query_as::<_, MagicTokenRecord>(
        r#"
        SELECT id, email::text AS email, org_id, role
        FROM magic_link_tokens
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > now()
        FOR UPDATE
        "#,
    )
    .bind(&token_hash)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(MagicLinkError::InvalidOrExpiredToken)?;

    sqlx::query(
        r#"
        UPDATE magic_link_tokens
        SET used_at = now()
        WHERE id = $1
        "#,
    )
    .bind(record.id)
    .execute(&mut *tx)
    .await?;

    // Check if user already exists
    let existing_membership = sqlx::query_as::<_, UserMembershipRow>(
        r#"
        SELECT u.id AS user_id, u.email::text AS email, om.org_id, om.role
        FROM users u
        INNER JOIN org_members om ON om.user_id = u.id
        WHERE u.email = $1
        ORDER BY om.created_at ASC
        LIMIT 1
        "#,
    )
    .bind(&record.email)
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(m) = existing_membership {
        tx.commit().await?;
        return Ok(DashboardSession {
            user_id: m.user_id,
            org_id: m.org_id,
            email: m.email,
            role: m.role,
        });
    }

    // New user
    if !crate::registration_enabled() && record.org_id.is_none() {
        return Err(MagicLinkError::RegistrationClosed);
    }

    let user_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO users (id, email, credential_generation)
        VALUES ($1, $2, 1)
        "#,
    )
    .bind(user_id)
    .bind(&record.email)
    .execute(&mut *tx)
    .await?;

    let (final_org_id, final_role) = if let Some(target_org_id) = record.org_id {
        let role = record.role.unwrap_or_else(|| "member".to_string());
        sqlx::query(
            r#"
            INSERT INTO org_members (org_id, user_id, role)
            VALUES ($1, $2, $3)
            "#,
        )
        .bind(target_org_id)
        .bind(user_id)
        .bind(&role)
        .execute(&mut *tx)
        .await?;
        (target_org_id, role)
    } else {
        let org_id = Uuid::new_v4();
        let org_name = format!(
            "{}'s Workspace",
            record.email.split('@').next().unwrap_or("User")
        );
        sqlx::query("SELECT auth_bootstrap_workspace($1, $2, $3)")
            .bind(user_id)
            .bind(org_id)
            .bind(&org_name)
            .execute(&mut *tx)
            .await?;
        (org_id, "owner".to_string())
    };

    tx.commit().await?;

    Ok(DashboardSession {
        user_id,
        org_id: final_org_id,
        email: record.email,
        role: final_role,
    })
}
