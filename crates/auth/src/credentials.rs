use crate::password::{hash_password_blocking, verify_password_blocking, PasswordError};
use crate::session::DashboardSession;
use sqlx::PgPool;
use thiserror::Error;
use uuid::Uuid;

#[derive(Clone)]
pub struct CredentialAuth {
    pool: PgPool,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct AccountProfile {
    pub user_id: Uuid,
    pub org_id: Uuid,
    pub email: String,
    pub display_name: Option<String>,
    pub role: String,
    pub has_password: bool,
    pub google_linked: bool,
}

#[derive(Debug, Error)]
pub enum CredentialError {
    #[error("invalid email or password")]
    InvalidCredentials,
    #[error("email already registered")]
    EmailTaken,
    #[error("password policy violation")]
    WeakPassword,
    #[error("current password is required")]
    CurrentPasswordRequired,
    #[error("email confirmation does not match")]
    EmailMismatch,
    #[error("transfer workspace ownership before deleting your account")]
    TransferOwnershipRequired,
    #[error("invalid display name")]
    InvalidDisplayName,
    #[error("invalid or expired invitation token")]
    InvalidInviteToken,
    #[error(transparent)]
    Password(#[from] PasswordError),
    #[error(transparent)]
    Sqlx(#[from] sqlx::Error),
}

impl CredentialAuth {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn register(
        &self,
        email: &str,
        password: &str,
        invite_token: Option<&str>,
    ) -> Result<DashboardSession, CredentialError> {
        let normalized = normalize_email(email);
        validate_password(password)?;

        if self.find_user_id(&normalized).await?.is_some() {
            return Err(CredentialError::EmailTaken);
        }

        let password_hash = hash_password_blocking(password.to_string()).await?;
        let user_id = Uuid::new_v4();

        if let Some(token) = invite_token {
            let invitation =
                epure_storage::members::find_pending_invitation_by_token(&self.pool, token)
                    .await?
                    .filter(|invitation| invitation.email == normalized)
                    .ok_or(CredentialError::InvalidInviteToken)?;

            sqlx::query("SELECT auth_insert_user($1, $2, $3, NULL)")
                .bind(user_id)
                .bind(&normalized)
                .bind(&password_hash)
                .execute(&self.pool)
                .await?;

            epure_storage::members::accept_invitation(
                &self.pool,
                invitation.id,
                user_id,
                invitation.org_id,
                &invitation.role,
            )
            .await?;

            return Ok(DashboardSession {
                user_id,
                org_id: invitation.org_id,
                email: normalized,
                role: invitation.role,
            });
        }

        let org_id = Uuid::new_v4();
        let org_name = org_name_from_email(&normalized);

        sqlx::query("SELECT auth_insert_user($1, $2, $3, NULL)")
            .bind(user_id)
            .bind(&normalized)
            .bind(&password_hash)
            .execute(&self.pool)
            .await?;

        sqlx::query("SELECT auth_bootstrap_workspace($1, $2, $3, $4, $5)")
            .bind(user_id)
            .bind(org_id)
            .bind(&org_name)
            .bind(format!("{org_name} Project"))
            .bind(slug_from_email(&normalized))
            .execute(&self.pool)
            .await?;

        Ok(DashboardSession {
            user_id,
            org_id,
            email: normalized,
            role: "owner".to_string(),
        })
    }

    pub async fn login(
        &self,
        email: &str,
        password: &str,
    ) -> Result<DashboardSession, CredentialError> {
        let normalized = normalize_email(email);

        let row = sqlx::query_as::<_, UserAuthRow>(
            r#"
            SELECT id, email, password_hash, google_sub
            FROM auth_lookup_user_by_email($1)
            "#,
        )
        .bind(&normalized)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(CredentialError::InvalidCredentials)?;

        let Some(hash) = row.password_hash else {
            return Err(CredentialError::InvalidCredentials);
        };

        if !verify_password_blocking(password.to_string(), hash).await? {
            return Err(CredentialError::InvalidCredentials);
        }

        let membership = sqlx::query_as::<_, MembershipRow>(
            r#"
            SELECT org_id, role
            FROM auth_lookup_membership($1)
            "#,
        )
        .bind(row.id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(CredentialError::InvalidCredentials)?;

        Ok(DashboardSession {
            user_id: row.id,
            org_id: membership.org_id,
            email: row.email,
            role: membership.role,
        })
    }

    pub async fn accept_invitation(
        &self,
        user_id: Uuid,
        email: &str,
        invite_token: &str,
    ) -> Result<DashboardSession, CredentialError> {
        let normalized = normalize_email(email);
        let invitation =
            epure_storage::members::find_pending_invitation_by_token(&self.pool, invite_token)
                .await?
                .filter(|invitation| invitation.email == normalized)
                .ok_or(CredentialError::InvalidInviteToken)?;

        epure_storage::members::accept_invitation(
            &self.pool,
            invitation.id,
            user_id,
            invitation.org_id,
            &invitation.role,
        )
        .await?;

        Ok(DashboardSession {
            user_id,
            org_id: invitation.org_id,
            email: normalized,
            role: invitation.role,
        })
    }

    pub async fn account_profile(
        &self,
        user_id: Uuid,
        org_id: Uuid,
    ) -> Result<AccountProfile, CredentialError> {
        let pool = self.pool.clone();
        epure_storage::rls::with_request_user(user_id, async move {
            let mut tx = epure_storage::rls::begin_org_transaction(&pool, org_id).await?;
            let row = sqlx::query_as::<_, AccountProfileRow>(
                r#"
                SELECT
                    u.id,
                    u.email::text AS email,
                    u.display_name,
                    u.password_hash,
                    u.google_sub,
                    om.role
                FROM users u
                INNER JOIN org_members om ON om.user_id = u.id
                WHERE u.id = $1 AND om.org_id = $2
                "#,
            )
            .bind(user_id)
            .bind(org_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(CredentialError::InvalidCredentials)?;
            tx.commit().await?;
            Ok(AccountProfile {
                user_id: row.id,
                org_id,
                email: row.email,
                display_name: row.display_name,
                role: row.role,
                has_password: row.password_hash.is_some(),
                google_linked: row.google_sub.is_some(),
            })
        })
        .await
    }

    pub async fn update_profile(
        &self,
        user_id: Uuid,
        display_name: Option<&str>,
    ) -> Result<(), CredentialError> {
        let normalized = normalize_display_name(display_name)?;
        sqlx::query("SELECT auth_set_display_name($1, $2)")
            .bind(user_id)
            .bind(normalized)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn change_password(
        &self,
        user_id: Uuid,
        current_password: Option<&str>,
        new_password: &str,
    ) -> Result<(), CredentialError> {
        validate_password(new_password)?;

        let row = sqlx::query_as::<_, UserAuthRow>(
            r#"
            SELECT id, email, password_hash, google_sub
            FROM auth_lookup_user_by_id($1)
            "#,
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(CredentialError::InvalidCredentials)?;

        if let Some(hash) = row.password_hash {
            let current = current_password.ok_or(CredentialError::CurrentPasswordRequired)?;
            if !verify_password_blocking(current.to_string(), hash).await? {
                return Err(CredentialError::InvalidCredentials);
            }
        }

        let password_hash = hash_password_blocking(new_password.to_string()).await?;
        sqlx::query("SELECT auth_set_password($1, $2)")
            .bind(user_id)
            .bind(password_hash)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn delete_account(
        &self,
        user_id: Uuid,
        org_id: Uuid,
        password: Option<&str>,
        confirm_email: &str,
    ) -> Result<(), CredentialError> {
        let normalized = normalize_email(confirm_email);
        let row = sqlx::query_as::<_, UserAuthRow>(
            r#"
            SELECT id, email, password_hash, google_sub
            FROM auth_lookup_user_by_id($1)
            "#,
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(CredentialError::InvalidCredentials)?;

        if row.email != normalized {
            return Err(CredentialError::EmailMismatch);
        }

        if let Some(hash) = row.password_hash {
            let current = password.ok_or(CredentialError::CurrentPasswordRequired)?;
            if !verify_password_blocking(current.to_string(), hash).await? {
                return Err(CredentialError::InvalidCredentials);
            }
        }

        let pool = self.pool.clone();
        epure_storage::rls::with_request_user(user_id, async move {
            let mut tx = epure_storage::rls::begin_org_transaction(&pool, org_id).await?;

            let role = sqlx::query_scalar::<_, String>(
                r#"
                SELECT role
                FROM org_members
                WHERE user_id = $1 AND org_id = $2
                FOR UPDATE
                "#,
            )
            .bind(user_id)
            .bind(org_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(CredentialError::InvalidCredentials)?;

            let member_count = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*)::bigint FROM org_members WHERE org_id = $1 FOR UPDATE",
            )
            .bind(org_id)
            .fetch_one(&mut *tx)
            .await?;

            if role == "owner" && member_count > 1 {
                return Err(CredentialError::TransferOwnershipRequired);
            }

            if role == "owner" && member_count == 1 {
                sqlx::query("DELETE FROM organizations WHERE id = $1")
                    .bind(org_id)
                    .execute(&mut *tx)
                    .await?;
            } else {
                sqlx::query("DELETE FROM org_members WHERE org_id = $1 AND user_id = $2")
                    .bind(org_id)
                    .bind(user_id)
                    .execute(&mut *tx)
                    .await?;
            }

            tx.commit().await?;
            sqlx::query("SELECT auth_delete_user($1)")
                .bind(user_id)
                .execute(&pool)
                .await?;
            Ok(())
        })
        .await
    }

    async fn find_user_id(&self, email: &str) -> Result<Option<Uuid>, sqlx::Error> {
        sqlx::query_scalar("SELECT id FROM auth_lookup_user_by_email($1)")
            .bind(email)
            .fetch_optional(&self.pool)
            .await
    }
}

fn normalize_email(email: &str) -> String {
    email.trim().to_lowercase()
}

fn validate_password(password: &str) -> Result<(), CredentialError> {
    if password.len() < 8 {
        return Err(CredentialError::WeakPassword);
    }
    Ok(())
}

fn normalize_display_name(display_name: Option<&str>) -> Result<Option<String>, CredentialError> {
    match display_name {
        None => Ok(None),
        Some(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                return Ok(None);
            }
            if trimmed.len() > 64 {
                return Err(CredentialError::InvalidDisplayName);
            }
            Ok(Some(trimmed.to_string()))
        }
    }
}

fn org_name_from_email(email: &str) -> String {
    email
        .split('@')
        .next()
        .unwrap_or("Workspace")
        .chars()
        .take(48)
        .collect()
}

fn slug_from_email(email: &str) -> String {
    let base = email
        .split('@')
        .next()
        .unwrap_or("workspace")
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .take(32)
        .collect::<String>()
        .to_lowercase();
    format!("{base}-{}", &Uuid::new_v4().simple().to_string()[..8])
}

#[derive(sqlx::FromRow)]
struct UserAuthRow {
    id: Uuid,
    email: String,
    password_hash: Option<Vec<u8>>,
    #[allow(dead_code)]
    google_sub: Option<String>,
}

#[derive(sqlx::FromRow)]
struct AccountProfileRow {
    id: Uuid,
    email: String,
    display_name: Option<String>,
    password_hash: Option<Vec<u8>>,
    google_sub: Option<String>,
    role: String,
}

#[derive(sqlx::FromRow)]
struct MembershipRow {
    org_id: Uuid,
    role: String,
}
