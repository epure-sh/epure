use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

pub const OAUTH_ACCESS_TOKEN_LIFETIME_DAYS: i64 = 30;
pub const OAUTH_REFRESH_TOKEN_LIFETIME_DAYS: i64 = 180;
pub const OAUTH_CODE_LIFETIME_MINS: i64 = 10;
pub const OAUTH_DEVICE_CODE_LIFETIME_MINS: i64 = 15;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OAuthAuthorizationRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub org_id: Uuid,
    pub client_id: String,
    pub client_name: String,
    pub scopes: Vec<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub last_used_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct OAuthCodeRow {
    pub client_id: String,
    pub user_id: Uuid,
    pub org_id: Uuid,
    pub redirect_uri: String,
    pub code_challenge: String,
    pub code_challenge_method: String,
    pub scopes: Vec<String>,
    pub client_name: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct OAuthRefreshTokenLookup {
    pub token_id: Uuid,
    pub authorization_id: Uuid,
    pub agent_token_id: Uuid,
    pub refresh_token_hash: Vec<u8>,
    pub expires_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub org_id: Uuid,
    pub client_id: String,
    pub scopes: Vec<String>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct OAuthDeviceCodeRow {
    pub device_code_hash: Vec<u8>,
    pub user_code: String,
    pub client_id: String,
    pub client_name: String,
    pub user_id: Option<Uuid>,
    pub org_id: Option<Uuid>,
    pub scopes: Vec<String>,
    pub status: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

pub struct CreateOAuthCodeParams {
    pub code_hash: Vec<u8>,
    pub client_id: String,
    pub user_id: Uuid,
    pub org_id: Uuid,
    pub redirect_uri: String,
    pub code_challenge: String,
    pub code_challenge_method: String,
    pub scopes: Vec<String>,
    pub client_name: String,
}

pub async fn store_oauth_code(
    pool: &PgPool,
    params: CreateOAuthCodeParams,
) -> Result<(), sqlx::Error> {
    let expires_at = Utc::now() + Duration::minutes(OAUTH_CODE_LIFETIME_MINS);
    sqlx::query(
        r#"
        INSERT INTO oauth_codes (
            code_hash, client_id, user_id, org_id, redirect_uri,
            code_challenge, code_challenge_method, scopes, client_name, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        "#,
    )
    .bind(params.code_hash)
    .bind(params.client_id)
    .bind(params.user_id)
    .bind(params.org_id)
    .bind(params.redirect_uri)
    .bind(params.code_challenge)
    .bind(params.code_challenge_method)
    .bind(&params.scopes)
    .bind(params.client_name)
    .bind(expires_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn consume_oauth_code(
    pool: &PgPool,
    code_hash: &[u8],
) -> Result<Option<OAuthCodeRow>, sqlx::Error> {
    sqlx::query_as::<_, OAuthCodeRow>(
        r#"
        UPDATE oauth_codes
        SET used_at = now()
        WHERE code_hash = $1
          AND used_at IS NULL
          AND expires_at > now()
        RETURNING client_id, user_id, org_id, redirect_uri,
                  code_challenge, code_challenge_method, scopes,
                  client_name, expires_at
        "#,
    )
    .bind(code_hash)
    .fetch_optional(pool)
    .await
}

pub struct CreateDeviceCodeParams {
    pub device_code_hash: Vec<u8>,
    pub user_code: String,
    pub client_id: String,
    pub client_name: String,
    pub scopes: Vec<String>,
}

pub async fn store_device_code(
    pool: &PgPool,
    params: CreateDeviceCodeParams,
) -> Result<(), sqlx::Error> {
    let expires_at = Utc::now() + Duration::minutes(OAUTH_DEVICE_CODE_LIFETIME_MINS);
    sqlx::query(
        r#"
        INSERT INTO oauth_device_codes (
            device_code_hash, user_code, client_id, client_name, scopes, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(params.device_code_hash)
    .bind(params.user_code)
    .bind(params.client_id)
    .bind(params.client_name)
    .bind(&params.scopes)
    .bind(expires_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn lookup_device_code_by_user_code(
    pool: &PgPool,
    user_code: &str,
) -> Result<Option<OAuthDeviceCodeRow>, sqlx::Error> {
    sqlx::query_as::<_, OAuthDeviceCodeRow>(
        r#"
        SELECT device_code_hash, user_code, client_id, client_name,
               user_id, org_id, scopes, status, expires_at, created_at
        FROM oauth_device_codes
        WHERE user_code = $1
          AND expires_at > now()
        "#,
    )
    .bind(user_code)
    .fetch_optional(pool)
    .await
}

pub async fn approve_device_code(
    pool: &PgPool,
    user_code: &str,
    user_id: Uuid,
    org_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"
        UPDATE oauth_device_codes
        SET status = 'approved',
            user_id = $2,
            org_id = $3
        WHERE user_code = $1
          AND status = 'pending'
          AND expires_at > now()
        "#,
    )
    .bind(user_code)
    .bind(user_id)
    .bind(org_id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn poll_device_code(
    pool: &PgPool,
    device_code_hash: &[u8],
) -> Result<Option<OAuthDeviceCodeRow>, sqlx::Error> {
    sqlx::query_as::<_, OAuthDeviceCodeRow>(
        r#"
        SELECT device_code_hash, user_code, client_id, client_name,
               user_id, org_id, scopes, status, expires_at, created_at
        FROM oauth_device_codes
        WHERE device_code_hash = $1
          AND expires_at > now()
        "#,
    )
    .bind(device_code_hash)
    .fetch_optional(pool)
    .await
}

pub struct IssueTokensTxParams {
    pub user_id: Uuid,
    pub org_id: Uuid,
    pub client_id: String,
    pub client_name: String,
    pub scopes: Vec<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub access_token_prefix: String,
    pub access_token_hash: Vec<u8>,
    pub refresh_token_prefix: String,
    pub refresh_token_hash: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct IssuedTokensResult {
    pub authorization_id: Uuid,
    pub agent_token_id: Uuid,
    pub expires_in: i64,
}

pub async fn issue_oauth_tokens(
    pool: &PgPool,
    params: IssueTokensTxParams,
) -> Result<IssuedTokensResult, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let now = Utc::now();
    let access_expires_at = now + Duration::days(OAUTH_ACCESS_TOKEN_LIFETIME_DAYS);
    let refresh_expires_at = now + Duration::days(OAUTH_REFRESH_TOKEN_LIFETIME_DAYS);

    let authorization_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO oauth_authorizations (
            user_id, org_id, client_id, client_name, scopes, ip_address, user_agent, last_used_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
        "#,
    )
    .bind(params.user_id)
    .bind(params.org_id)
    .bind(&params.client_id)
    .bind(&params.client_name)
    .bind(&params.scopes)
    .bind(&params.ip_address)
    .bind(&params.user_agent)
    .bind(now)
    .fetch_one(&mut *tx)
    .await?;

    let agent_token_label = format!("OAuth: {}", params.client_name);
    let agent_token_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO agent_tokens (
            org_id, user_id, label, token_prefix, secret_hash, scopes, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        "#,
    )
    .bind(params.org_id)
    .bind(params.user_id)
    .bind(agent_token_label)
    .bind(&params.access_token_prefix)
    .bind(&params.access_token_hash)
    .bind(&params.scopes)
    .bind(access_expires_at)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO oauth_tokens (
            authorization_id, agent_token_id, refresh_token_prefix, refresh_token_hash, expires_at
        )
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(authorization_id)
    .bind(agent_token_id)
    .bind(&params.refresh_token_prefix)
    .bind(&params.refresh_token_hash)
    .bind(refresh_expires_at)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(IssuedTokensResult {
        authorization_id,
        agent_token_id,
        expires_in: OAUTH_ACCESS_TOKEN_LIFETIME_DAYS * 86400,
    })
}

pub async fn lookup_refresh_token(
    pool: &PgPool,
    refresh_token_prefix: &str,
) -> Result<Option<OAuthRefreshTokenLookup>, sqlx::Error> {
    sqlx::query_as::<_, OAuthRefreshTokenLookup>(
        r#"
        SELECT token_id, authorization_id, agent_token_id, refresh_token_hash,
               expires_at, revoked_at, user_id, org_id, client_id, scopes
        FROM oauth_lookup_refresh_token($1)
        "#,
    )
    .bind(refresh_token_prefix)
    .fetch_optional(pool)
    .await
}

pub struct RotateTokensTxParams {
    pub authorization_id: Uuid,
    pub old_agent_token_id: Uuid,
    pub org_id: Uuid,
    pub user_id: Uuid,
    pub client_name: String,
    pub scopes: Vec<String>,
    pub new_access_token_prefix: String,
    pub new_access_token_hash: Vec<u8>,
    pub new_refresh_token_prefix: String,
    pub new_refresh_token_hash: Vec<u8>,
}

pub async fn rotate_oauth_tokens(
    pool: &PgPool,
    params: RotateTokensTxParams,
) -> Result<IssuedTokensResult, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let now = Utc::now();
    let access_expires_at = now + Duration::days(OAUTH_ACCESS_TOKEN_LIFETIME_DAYS);
    let refresh_expires_at = now + Duration::days(OAUTH_REFRESH_TOKEN_LIFETIME_DAYS);

    // Revoke old tokens
    sqlx::query("UPDATE agent_tokens SET revoked_at = $1 WHERE id = $2")
        .bind(now)
        .bind(params.old_agent_token_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("UPDATE oauth_tokens SET revoked_at = $1 WHERE authorization_id = $2")
        .bind(now)
        .bind(params.authorization_id)
        .execute(&mut *tx)
        .await?;

    // Create new agent token
    let agent_token_label = format!("OAuth: {}", params.client_name);
    let new_agent_token_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO agent_tokens (
            org_id, user_id, label, token_prefix, secret_hash, scopes, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        "#,
    )
    .bind(params.org_id)
    .bind(params.user_id)
    .bind(agent_token_label)
    .bind(&params.new_access_token_prefix)
    .bind(&params.new_access_token_hash)
    .bind(&params.scopes)
    .bind(access_expires_at)
    .fetch_one(&mut *tx)
    .await?;

    // Insert new oauth token row
    sqlx::query(
        r#"
        INSERT INTO oauth_tokens (
            authorization_id, agent_token_id, refresh_token_prefix, refresh_token_hash, expires_at
        )
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(params.authorization_id)
    .bind(new_agent_token_id)
    .bind(&params.new_refresh_token_prefix)
    .bind(&params.new_refresh_token_hash)
    .bind(refresh_expires_at)
    .execute(&mut *tx)
    .await?;

    // Update last_used_at on authorization
    sqlx::query("UPDATE oauth_authorizations SET last_used_at = $1 WHERE id = $2")
        .bind(now)
        .bind(params.authorization_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(IssuedTokensResult {
        authorization_id: params.authorization_id,
        agent_token_id: new_agent_token_id,
        expires_in: OAUTH_ACCESS_TOKEN_LIFETIME_DAYS * 86400,
    })
}

pub async fn list_user_authorizations(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<OAuthAuthorizationRow>, sqlx::Error> {
    sqlx::query_as::<_, OAuthAuthorizationRow>(
        r#"
        SELECT id, user_id, org_id, client_id, client_name, scopes,
               ip_address, user_agent, last_used_at, created_at
        FROM oauth_authorizations
        WHERE user_id = $1 AND revoked_at IS NULL
        ORDER BY last_used_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}

pub async fn revoke_authorization(
    pool: &PgPool,
    user_id: Uuid,
    authorization_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let now = Utc::now();

    let result = sqlx::query(
        r#"
        UPDATE oauth_authorizations
        SET revoked_at = $1
        WHERE id = $2 AND user_id = $3 AND revoked_at IS NULL
        "#,
    )
    .bind(now)
    .bind(authorization_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Ok(false);
    }

    // Revoke linked oauth_tokens and agent_tokens
    sqlx::query(
        r#"
        UPDATE agent_tokens
        SET revoked_at = $1
        WHERE id IN (
            SELECT agent_token_id FROM oauth_tokens WHERE authorization_id = $2
        )
        "#,
    )
    .bind(now)
    .bind(authorization_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        UPDATE oauth_tokens
        SET revoked_at = $1
        WHERE authorization_id = $2
        "#,
    )
    .bind(now)
    .bind(authorization_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(true)
}
