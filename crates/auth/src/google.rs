use crate::session::DashboardSession;
use rand::RngCore;
use reqwest::Client;
use serde::Deserialize;
use sqlx::PgPool;
use thiserror::Error;
use uuid::Uuid;

const GOOGLE_AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL: &str = "https://openidconnect.googleapis.com/v1/userinfo";

#[derive(Clone)]
pub struct GoogleAuth {
    client_id: String,
    client_secret: String,
    redirect_uri: String,
    http: Client,
    pool: PgPool,
}

#[derive(Debug, Error)]
pub enum GoogleAuthError {
    #[error("google oauth is not configured")]
    NotConfigured,
    #[error("invalid oauth state")]
    InvalidState,
    #[error("google token exchange failed")]
    TokenExchange,
    #[error("google userinfo failed")]
    UserInfo,
    #[error("invalid or expired invitation token")]
    InvalidInviteToken,
    #[error(transparent)]
    Http(#[from] reqwest::Error),
    #[error(transparent)]
    Sqlx(#[from] sqlx::Error),
}

#[derive(Debug, Deserialize)]
struct GoogleTokenResponse {
    access_token: String,
}

#[derive(Debug, Deserialize)]
struct GoogleUserInfo {
    sub: String,
    email: String,
    email_verified: Option<bool>,
}

impl GoogleAuth {
    pub fn from_env(pool: PgPool) -> Option<Self> {
        let client_id = std::env::var("GOOGLE_CLIENT_ID").ok()?;
        let client_secret = std::env::var("GOOGLE_CLIENT_SECRET").ok()?;
        if client_id.is_empty() || client_secret.is_empty() {
            return None;
        }

        let redirect_uri = std::env::var("GOOGLE_REDIRECT_URI").unwrap_or_else(|_| {
            let public_url = std::env::var("EPURE_PUBLIC_URL")
                .unwrap_or_else(|_| "http://localhost:8080".to_string());
            format!("{public_url}/api/v1/auth/google/callback")
        });

        Some(Self {
            client_id,
            client_secret,
            redirect_uri,
            http: Client::new(),
            pool,
        })
    }

    pub fn is_configured(&self) -> bool {
        !self.client_id.is_empty() && !self.client_secret.is_empty()
    }

    pub fn authorize_url(&self, state: &str) -> String {
        let scope = urlencoding::encode("openid email profile");
        format!(
            "{GOOGLE_AUTH_URL}?client_id={}&redirect_uri={}&response_type=code&scope={scope}&state={}&access_type=online&prompt=select_account",
            urlencoding::encode(&self.client_id),
            urlencoding::encode(&self.redirect_uri),
            urlencoding::encode(state),
        )
    }

    pub fn generate_state() -> String {
        let mut bytes = [0u8; 16];
        rand::rng().fill_bytes(&mut bytes);
        hex::encode(bytes)
    }

    pub async fn authenticate_code(
        &self,
        code: &str,
        invite_token: Option<&str>,
    ) -> Result<DashboardSession, GoogleAuthError> {
        let token = self.exchange_code(code).await?;
        let profile = self.fetch_userinfo(&token.access_token).await?;

        if profile.email_verified == Some(false) {
            return Err(GoogleAuthError::UserInfo);
        }

        self.load_or_create_session(&profile.sub, &profile.email, invite_token)
            .await
    }

    /// Exercises the Google signup DB path without live OAuth (integration tests).
    pub fn for_test(pool: PgPool) -> Self {
        Self {
            client_id: "test-client".to_string(),
            client_secret: "test-secret".to_string(),
            redirect_uri: "http://localhost/callback".to_string(),
            http: Client::new(),
            pool,
        }
    }

    pub async fn signup_new_user(
        &self,
        google_sub: &str,
        email: &str,
        invite_token: Option<&str>,
    ) -> Result<DashboardSession, GoogleAuthError> {
        self.load_or_create_session(google_sub, email, invite_token).await
    }

    async fn exchange_code(&self, code: &str) -> Result<GoogleTokenResponse, GoogleAuthError> {
        let response = self
            .http
            .post(GOOGLE_TOKEN_URL)
            .form(&[
                ("code", code),
                ("client_id", self.client_id.as_str()),
                ("client_secret", self.client_secret.as_str()),
                ("redirect_uri", self.redirect_uri.as_str()),
                ("grant_type", "authorization_code"),
            ])
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(GoogleAuthError::TokenExchange);
        }

        response.json().await.map_err(GoogleAuthError::from)
    }

    async fn fetch_userinfo(&self, access_token: &str) -> Result<GoogleUserInfo, GoogleAuthError> {
        let response = self
            .http
            .get(GOOGLE_USERINFO_URL)
            .bearer_auth(access_token)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(GoogleAuthError::UserInfo);
        }

        response.json().await.map_err(GoogleAuthError::from)
    }

    async fn load_or_create_session(
        &self,
        google_sub: &str,
        email: &str,
        invite_token: Option<&str>,
    ) -> Result<DashboardSession, GoogleAuthError> {
        let normalized = email.trim().to_lowercase();

        if let Some(session) = self.session_by_google_sub(google_sub).await? {
            return Ok(session);
        }

        if let Some(session) = self
            .link_google_sub_by_email(google_sub, &normalized)
            .await?
        {
            return Ok(session);
        }

        if let Some(token) = invite_token {
            return self
                .create_user_with_invitation(google_sub, &normalized, token)
                .await;
        }

        self.create_user_with_org(google_sub, &normalized).await
    }

    async fn session_by_google_sub(
        &self,
        google_sub: &str,
    ) -> Result<Option<DashboardSession>, GoogleAuthError> {
        let row = sqlx::query_as::<_, UserMembershipRow>(
            r#"
            SELECT u.id AS user_id, u.email::text AS email, om.org_id, om.role
            FROM users u
            JOIN org_members om ON om.user_id = u.id
            WHERE u.google_sub = $1
            ORDER BY om.created_at ASC
            LIMIT 1
            "#,
        )
        .bind(google_sub)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|row| DashboardSession {
            user_id: row.user_id,
            org_id: row.org_id,
            email: row.email,
            role: row.role,
        }))
    }

    async fn link_google_sub_by_email(
        &self,
        google_sub: &str,
        email: &str,
    ) -> Result<Option<DashboardSession>, GoogleAuthError> {
        let row = sqlx::query_as::<_, UserMembershipRow>(
            r#"
            SELECT u.id AS user_id, u.email::text AS email, om.org_id, om.role
            FROM users u
            JOIN org_members om ON om.user_id = u.id
            WHERE u.email = $1
            ORDER BY om.created_at ASC
            LIMIT 1
            "#,
        )
        .bind(email)
        .fetch_optional(&self.pool)
        .await?;

        let Some(row) = row else {
            return Ok(None);
        };

        sqlx::query("UPDATE users SET google_sub = $2 WHERE id = $1")
            .bind(row.user_id)
            .bind(google_sub)
            .execute(&self.pool)
            .await?;

        Ok(Some(DashboardSession {
            user_id: row.user_id,
            org_id: row.org_id,
            email: row.email,
            role: row.role,
        }))
    }

    async fn create_user_with_invitation(
        &self,
        google_sub: &str,
        email: &str,
        invite_token: &str,
    ) -> Result<DashboardSession, GoogleAuthError> {
        let invitation =
            epure_storage::members::find_pending_invitation_by_token(&self.pool, invite_token)
                .await?
                .filter(|invitation| invitation.email == email)
                .ok_or(GoogleAuthError::InvalidInviteToken)?;

        let user_id = Uuid::new_v4();
        let mut tx = self.pool.begin().await?;

        sqlx::query(
            r#"
            INSERT INTO users (id, email, google_sub)
            VALUES ($1, $2, $3)
            "#,
        )
        .bind(user_id)
        .bind(email)
        .bind(google_sub)
        .execute(&mut *tx)
        .await?;

        epure_storage::members::accept_invitation_in_tx(
            &mut tx,
            invitation.id,
            user_id,
            invitation.org_id,
            &invitation.role,
        )
        .await?;

        tx.commit().await?;

        Ok(DashboardSession {
            user_id,
            org_id: invitation.org_id,
            email: email.to_string(),
            role: invitation.role,
        })
    }

    async fn create_user_with_org(
        &self,
        google_sub: &str,
        email: &str,
    ) -> Result<DashboardSession, GoogleAuthError> {
        let user_id = Uuid::new_v4();
        let org_id = Uuid::new_v4();
        let org_name = email.split('@').next().unwrap_or("Workspace").to_string();

        let mut tx = self.pool.begin().await?;

        sqlx::query(
            r#"
            INSERT INTO users (id, email, google_sub)
            VALUES ($1, $2, $3)
            "#,
        )
        .bind(user_id)
        .bind(email)
        .bind(google_sub)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO organizations (id, name)
            VALUES ($1, $2)
            "#,
        )
        .bind(org_id)
        .bind(&org_name)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO projects (id, org_id, name, slug, retention_days)
            VALUES ($1, $2, $3, $4, 30)
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(org_id)
        .bind(format!("{org_name} Project"))
        .bind(format!(
            "{}-{}",
            org_name.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>().to_lowercase(),
            &Uuid::new_v4().simple().to_string()[..8]
        ))
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO org_members (org_id, user_id, role)
            VALUES ($1, $2, 'owner')
            "#,
        )
        .bind(org_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(DashboardSession {
            user_id,
            org_id,
            email: email.to_string(),
            role: "owner".to_string(),
        })
    }
}

#[derive(sqlx::FromRow)]
struct UserMembershipRow {
    user_id: Uuid,
    email: String,
    org_id: Uuid,
    role: String,
}
