//! Two-factor (TOTP) enrollment and verification against the auth_totp_* functions.

use crate::totp;
use sqlx::PgPool;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

pub const ISSUER: &str = "Epure";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TwoFactorStatus {
    pub enabled: bool,
    pub recovery_codes_left: i32,
}

pub struct SetupInfo {
    /// Base32 secret for manual entry.
    pub secret: String,
    /// `otpauth://` URI for QR codes and mobile deep links.
    pub uri: String,
}

#[derive(sqlx::FromRow)]
struct StateRow {
    secret: Vec<u8>,
    enabled: bool,
    recovery_left: i32,
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

async fn load(pool: &PgPool, user_id: Uuid) -> Result<Option<StateRow>, sqlx::Error> {
    sqlx::query_as::<_, StateRow>("SELECT secret, enabled, recovery_left FROM auth_totp_state($1)")
        .bind(user_id)
        .fetch_optional(pool)
        .await
}

pub async fn status(pool: &PgPool, user_id: Uuid) -> Result<TwoFactorStatus, sqlx::Error> {
    Ok(match load(pool, user_id).await? {
        Some(row) if row.enabled => TwoFactorStatus {
            enabled: true,
            recovery_codes_left: row.recovery_left,
        },
        _ => TwoFactorStatus {
            enabled: false,
            recovery_codes_left: 0,
        },
    })
}

pub async fn is_enabled(pool: &PgPool, user_id: Uuid) -> Result<bool, sqlx::Error> {
    Ok(status(pool, user_id).await?.enabled)
}

/// Create a pending secret. `None` when 2FA is already enabled.
pub async fn begin_setup(
    pool: &PgPool,
    user_id: Uuid,
    account: &str,
) -> Result<Option<SetupInfo>, sqlx::Error> {
    let secret = totp::generate_secret();
    let stored: bool = sqlx::query_scalar("SELECT auth_totp_begin($1, $2)")
        .bind(user_id)
        .bind(&secret)
        .fetch_one(pool)
        .await?;
    if !stored {
        return Ok(None);
    }
    Ok(Some(SetupInfo {
        secret: totp::base32_encode(&secret),
        uri: totp::provisioning_uri(&secret, account, ISSUER),
    }))
}

/// Confirm the pending secret with a first code. Returns recovery codes on success.
pub async fn confirm_setup(
    pool: &PgPool,
    user_id: Uuid,
    code: &str,
) -> Result<Option<Vec<String>>, sqlx::Error> {
    let Some(row) = load(pool, user_id).await? else {
        return Ok(None);
    };
    if row.enabled {
        return Ok(None);
    }
    let Some(counter) = totp::verify(&row.secret, code, now_secs()) else {
        return Ok(None);
    };
    let codes = totp::generate_recovery_codes();
    let hashes: Vec<Vec<u8>> = codes.iter().map(|c| totp::hash_recovery_code(c)).collect();
    let enabled: bool = sqlx::query_scalar("SELECT auth_totp_enable($1, $2, $3)")
        .bind(user_id)
        .bind(counter as i64)
        .bind(&hashes)
        .fetch_one(pool)
        .await?;
    Ok(enabled.then_some(codes))
}

/// Verify a login code: a fresh TOTP code (never reused) or an unused recovery code.
pub async fn verify_login_code(
    pool: &PgPool,
    user_id: Uuid,
    code: &str,
) -> Result<bool, sqlx::Error> {
    let Some(row) = load(pool, user_id).await? else {
        return Ok(false);
    };
    if !row.enabled {
        return Ok(false);
    }
    if let Some(counter) = totp::verify(&row.secret, code, now_secs()) {
        return sqlx::query_scalar("SELECT auth_totp_accept($1, $2)")
            .bind(user_id)
            .bind(counter as i64)
            .fetch_one(pool)
            .await;
    }
    let cleaned: String = code.chars().filter(|c| c.is_ascii_alphanumeric()).collect();
    if cleaned.len() != 12 {
        return Ok(false);
    }
    sqlx::query_scalar("SELECT auth_totp_use_recovery($1, $2)")
        .bind(user_id)
        .bind(totp::hash_recovery_code(code))
        .fetch_one(pool)
        .await
}

/// Turn 2FA off after a valid code (TOTP or recovery).
pub async fn disable(pool: &PgPool, user_id: Uuid, code: &str) -> Result<bool, sqlx::Error> {
    if !verify_login_code(pool, user_id, code).await? {
        return Ok(false);
    }
    sqlx::query("SELECT auth_totp_disable($1)")
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(true)
}
