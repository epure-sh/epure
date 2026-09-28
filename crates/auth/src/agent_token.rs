use std::sync::LazyLock;

use epure_storage::agent_tokens::{
    self, parse_token_prefix, touch_last_used, AgentTokenLookupRow, SCOPE_READ_AGENT,
};
use epure_storage::members as member_store;
use epure_storage::PgPool;
use thiserror::Error;
use uuid::Uuid;

use crate::password::{hash_password, verify_password, PasswordError};

/// Argon2 work for unknown prefixes so valid-prefix vs missing-prefix timing is less distinguishable.
static TIMING_SINK_HASH: LazyLock<Vec<u8>> = LazyLock::new(|| {
    hash_password("epure_pat_timing_sink_not_a_real_credential").expect("timing sink hash")
});

#[derive(Clone, Debug)]
pub struct AgentTokenSession {
    pub token_id: Uuid,
    pub user_id: Uuid,
    pub org_id: Uuid,
    pub role: String,
    pub scopes: Vec<String>,
}

#[derive(Debug, Error)]
pub enum AgentTokenError {
    #[error("invalid token")]
    Invalid,
    #[error("token revoked or expired")]
    Revoked,
    #[error("missing scope")]
    Forbidden,
    #[error(transparent)]
    Password(#[from] PasswordError),
    #[error(transparent)]
    Storage(#[from] sqlx::Error),
}

pub async fn authenticate_agent_token(
    pool: &PgPool,
    bearer: &str,
) -> Result<AgentTokenSession, AgentTokenError> {
    let token = bearer.trim();
    if token.is_empty() {
        return Err(AgentTokenError::Invalid);
    }

    let prefix = parse_token_prefix(token).ok_or(AgentTokenError::Invalid)?;
    let row = agent_tokens::lookup_by_prefix(pool, &prefix).await?;

    let row = match row {
        Some(row) => row,
        None => {
            let _ = verify_password(token, &TIMING_SINK_HASH);
            return Err(AgentTokenError::Invalid);
        }
    };

    verify_row(token, &row)?;

    let role = epure_storage::rls::with_request_user(row.user_id, async {
        member_store::get_member_role(pool, row.org_id, row.user_id).await
    })
    .await?
    .ok_or(AgentTokenError::Invalid)?;

    let _ = touch_last_used(pool, row.id).await;

    Ok(AgentTokenSession {
        token_id: row.id,
        user_id: row.user_id,
        org_id: row.org_id,
        role,
        scopes: row.scopes,
    })
}

fn verify_row(full_token: &str, row: &AgentTokenLookupRow) -> Result<(), AgentTokenError> {
    if row.revoked_at.is_some() {
        return Err(AgentTokenError::Revoked);
    }
    if let Some(expires) = row.expires_at {
        if expires <= chrono::Utc::now() {
            return Err(AgentTokenError::Revoked);
        }
    }

    let ok = verify_password(full_token, &row.secret_hash)?;
    if !ok {
        return Err(AgentTokenError::Invalid);
    }
    Ok(())
}

pub fn require_scope(session: &AgentTokenSession, scope: &str) -> Result<(), AgentTokenError> {
    if agent_tokens::has_scope(&session.scopes, scope) {
        Ok(())
    } else {
        Err(AgentTokenError::Forbidden)
    }
}

pub fn require_read(session: &AgentTokenSession) -> Result<(), AgentTokenError> {
    require_scope(session, SCOPE_READ_AGENT)
}
