use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

pub const SCOPE_READ_AGENT: &str = "read:agent";
pub const SCOPE_WRITE_TRIAGE: &str = "write:triage";
pub const SCOPE_WRITE_ADMIN: &str = "write:admin";

pub const TOKEN_PREFIX: &str = "epure_pat_";
pub const TOKEN_PREFIX_DISPLAY_LEN: usize = 8;

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct AgentTokenRow {
    pub id: Uuid,
    pub org_id: Uuid,
    pub user_id: Uuid,
    pub label: String,
    pub token_prefix: String,
    pub scopes: Vec<String>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct CreatedAgentToken {
    pub id: Uuid,
    pub label: String,
    pub token: String,
    pub token_prefix: String,
    pub scopes: Vec<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct AgentTokenLookupRow {
    pub id: Uuid,
    pub org_id: Uuid,
    pub user_id: Uuid,
    pub secret_hash: Vec<u8>,
    pub scopes: Vec<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub revoked_at: Option<DateTime<Utc>>,
}

pub fn parse_token_prefix(full_token: &str) -> Option<String> {
    let rest = full_token.strip_prefix(TOKEN_PREFIX)?;
    if rest.len() < TOKEN_PREFIX_DISPLAY_LEN + 16 {
        return None;
    }
    Some(rest[..TOKEN_PREFIX_DISPLAY_LEN].to_string())
}

pub fn scopes_valid(scopes: &[String]) -> bool {
    !scopes.is_empty()
        && scopes.iter().all(|scope| {
            scope == SCOPE_READ_AGENT || scope == SCOPE_WRITE_TRIAGE || scope == SCOPE_WRITE_ADMIN
        })
        && scopes.contains(&SCOPE_READ_AGENT.to_string())
}

pub async fn lookup_by_prefix(
    pool: &PgPool,
    prefix: &str,
) -> Result<Option<AgentTokenLookupRow>, sqlx::Error> {
    sqlx::query_as::<_, AgentTokenLookupRow>(
        r#"
        SELECT id, org_id, user_id, secret_hash, scopes, expires_at, revoked_at
        FROM auth_lookup_agent_token($1)
        "#,
    )
    .bind(prefix)
    .fetch_optional(pool)
    .await
}

pub async fn touch_last_used(pool: &PgPool, token_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("SELECT auth_touch_agent_token($1)")
        .bind(token_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_for_org(pool: &PgPool, org_id: Uuid) -> Result<Vec<AgentTokenRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let rows = sqlx::query_as::<_, AgentTokenRow>(
        r#"
        SELECT
            id,
            org_id,
            user_id,
            label,
            token_prefix,
            scopes,
            last_used_at,
            expires_at,
            revoked_at,
            created_at
        FROM agent_tokens
        WHERE org_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(org_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

pub async fn insert_token(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
    label: &str,
    token_prefix: &str,
    secret_hash: &[u8],
    scopes: &[String],
) -> Result<AgentTokenRow, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, AgentTokenRow>(
        r#"
        INSERT INTO agent_tokens (org_id, user_id, label, token_prefix, secret_hash, scopes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
            id,
            org_id,
            user_id,
            label,
            token_prefix,
            scopes,
            last_used_at,
            expires_at,
            revoked_at,
            created_at
        "#,
    )
    .bind(org_id)
    .bind(user_id)
    .bind(label)
    .bind(token_prefix)
    .bind(secret_hash)
    .bind(scopes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

pub async fn revoke_token(
    pool: &PgPool,
    org_id: Uuid,
    token_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let result = sqlx::query(
        r#"
        UPDATE agent_tokens
        SET revoked_at = now()
        WHERE id = $1 AND org_id = $2 AND revoked_at IS NULL
        "#,
    )
    .bind(token_id)
    .bind(org_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(result.rows_affected() > 0)
}

pub fn has_scope(scopes: &[String], required: &str) -> bool {
    scopes.iter().any(|scope| scope == required)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_token_prefix_extracts_display_prefix() {
        let secret = "abcdefgh0123456789012345678901234567890";
        let full = format!("{TOKEN_PREFIX}{secret}");
        assert_eq!(parse_token_prefix(&full).as_deref(), Some("abcdefgh"));
    }

    #[test]
    fn parse_token_prefix_rejects_short_or_wrong_prefix() {
        assert!(parse_token_prefix("not_a_pat").is_none());
        assert!(parse_token_prefix("epure_pat_short").is_none());
    }

    #[test]
    fn scopes_valid_requires_read_agent() {
        assert!(scopes_valid(&[SCOPE_READ_AGENT.to_string()]));
        assert!(scopes_valid(&[
            SCOPE_READ_AGENT.to_string(),
            SCOPE_WRITE_TRIAGE.to_string(),
        ]));
        assert!(!scopes_valid(&[SCOPE_WRITE_TRIAGE.to_string()]));
        assert!(!scopes_valid(&[]));
        assert!(!scopes_valid(&[
            "admin:all".to_string(),
            SCOPE_READ_AGENT.to_string()
        ]));
    }
}
