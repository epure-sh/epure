use crate::session::DashboardSession;
use rand::RngCore;
use reqwest::header::{ACCEPT, USER_AGENT};
use reqwest::Client;
use serde::Deserialize;
use sqlx::PgPool;
use thiserror::Error;
use uuid::Uuid;

const GITHUB_AUTH_URL: &str = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL: &str = "https://api.github.com/user";
const GITHUB_EMAILS_URL: &str = "https://api.github.com/user/emails";

#[derive(Clone)]
pub struct GitHubAuth {
    client_id: String,
    client_secret: String,
    redirect_uri: String,
    http: Client,
    pool: PgPool,
}

#[derive(Debug, Error)]
pub enum GitHubAuthError {
    #[error("github oauth is not configured")]
    NotConfigured,
    #[error("invalid oauth state")]
    InvalidState,
    #[error("github token exchange failed")]
    TokenExchange,
    #[error("github userinfo failed")]
    UserInfo,
    #[error("invalid or expired invitation token")]
    InvalidInviteToken,
    #[error("public registration is closed")]
    RegistrationClosed,
    #[error(transparent)]
    Http(#[from] reqwest::Error),
    #[error(transparent)]
    Sqlx(#[from] sqlx::Error),
}

#[derive(Debug, Deserialize)]
struct GitHubTokenResponse {
    access_token: String,
}

#[derive(Debug, Deserialize)]
struct GitHubUser {
    id: i64,
    login: String,
    email: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GitHubEmail {
    email: String,
    primary: bool,
    verified: bool,
}

#[derive(sqlx::FromRow)]
struct UserMembershipRow {
    user_id: Uuid,
    email: String,
    org_id: Uuid,
    role: String,
}

impl GitHubAuth {
    pub fn from_env(pool: PgPool) -> Option<Self> {
        let client_id = std::env::var("GITHUB_CLIENT_ID").ok()?;
        let client_secret = std::env::var("GITHUB_CLIENT_SECRET").ok()?;
        if client_id.is_empty() || client_secret.is_empty() {
            return None;
        }

        let redirect_uri = std::env::var("GITHUB_REDIRECT_URI")
            .ok()
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| {
                format!(
                    "{}/api/v1/auth/github/callback",
                    epure_storage::epure_public_url()
                )
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
        let scope = urlencoding::encode("user:email read:user");
        format!(
            "{GITHUB_AUTH_URL}?client_id={}&redirect_uri={}&scope={scope}&state={}",
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
    ) -> Result<DashboardSession, GitHubAuthError> {
        let token = self.exchange_code(code).await?;
        let (github_user, primary_email) = self.fetch_user_and_email(&token.access_token).await?;

        let email = primary_email
            .unwrap_or_else(|| format!("{}@users.noreply.github.com", github_user.login));
        let github_id = github_user.id.to_string();

        self.load_or_create_session(&github_id, &github_user.login, &email, invite_token)
            .await
    }

    pub fn for_test(pool: PgPool) -> Self {
        Self {
            client_id: "test-github-client".to_string(),
            client_secret: "test-github-secret".to_string(),
            redirect_uri: "http://localhost/github/callback".to_string(),
            http: Client::new(),
            pool,
        }
    }

    async fn exchange_code(&self, code: &str) -> Result<GitHubTokenResponse, GitHubAuthError> {
        let response = self
            .http
            .post(GITHUB_TOKEN_URL)
            .header(ACCEPT, "application/json")
            .header(USER_AGENT, "epure-cloud-auth/0.1.7")
            .form(&[
                ("code", code),
                ("client_id", self.client_id.as_str()),
                ("client_secret", self.client_secret.as_str()),
                ("redirect_uri", self.redirect_uri.as_str()),
            ])
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::warn!(
                status = %status,
                body = %body,
                redirect_uri = %self.redirect_uri,
                "github oauth token exchange failed"
            );
            return Err(GitHubAuthError::TokenExchange);
        }

        response.json().await.map_err(GitHubAuthError::from)
    }

    async fn fetch_user_and_email(
        &self,
        access_token: &str,
    ) -> Result<(GitHubUser, Option<String>), GitHubAuthError> {
        let user_resp = self
            .http
            .get(GITHUB_USER_URL)
            .bearer_auth(access_token)
            .header(USER_AGENT, "epure-cloud-auth/0.1.7")
            .send()
            .await?;

        if !user_resp.status().is_success() {
            return Err(GitHubAuthError::UserInfo);
        }

        let user: GitHubUser = user_resp.json().await?;
        let mut email = user.email.clone();

        if email.is_none() {
            let emails_resp = self
                .http
                .get(GITHUB_EMAILS_URL)
                .bearer_auth(access_token)
                .header(USER_AGENT, "epure-cloud-auth/0.1.7")
                .send()
                .await;

            if let Ok(resp) = emails_resp {
                if resp.status().is_success() {
                    if let Ok(emails) = resp.json::<Vec<GitHubEmail>>().await {
                        if let Some(primary) = emails.into_iter().find(|e| e.primary && e.verified)
                        {
                            email = Some(primary.email);
                        }
                    }
                }
            }
        }

        Ok((user, email))
    }

    async fn load_or_create_session(
        &self,
        github_id: &str,
        github_login: &str,
        email: &str,
        invite_token: Option<&str>,
    ) -> Result<DashboardSession, GitHubAuthError> {
        let normalized = email.trim().to_lowercase();

        // 1. Existing user by github_id
        if let Some(session) = self.session_by_github_id(github_id).await? {
            return Ok(session);
        }

        // 2. Existing user by email -> link github_id
        if let Some(session) = self
            .link_github_by_email(github_id, github_login, &normalized)
            .await?
        {
            return Ok(session);
        }

        // 3. User with pending invite
        if let Some(token) = invite_token {
            return self
                .create_user_with_invitation(github_id, github_login, &normalized, token)
                .await;
        }

        // 4. Registration closed check
        if !crate::registration_enabled() {
            return Err(GitHubAuthError::RegistrationClosed);
        }

        // 5. Create new user with workspace
        self.create_user_with_org(github_id, github_login, &normalized)
            .await
    }

    async fn session_by_github_id(
        &self,
        github_id: &str,
    ) -> Result<Option<DashboardSession>, GitHubAuthError> {
        let row = sqlx::query_as::<_, UserMembershipRow>(
            r#"
            SELECT u.id AS user_id, u.email::text AS email, om.org_id, om.role
            FROM users u
            INNER JOIN org_members om ON om.user_id = u.id
            WHERE u.github_id = $1
            ORDER BY om.created_at ASC
            LIMIT 1
            "#,
        )
        .bind(github_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| DashboardSession {
            user_id: r.user_id,
            org_id: r.org_id,
            email: r.email,
            role: r.role,
        }))
    }

    async fn link_github_by_email(
        &self,
        github_id: &str,
        github_login: &str,
        email: &str,
    ) -> Result<Option<DashboardSession>, GitHubAuthError> {
        let user = sqlx::query_as::<_, (Uuid, String)>(
            r#"
            UPDATE users
            SET github_id = $1, github_login = $2
            WHERE email = $3
            RETURNING id, email::text
            "#,
        )
        .bind(github_id)
        .bind(github_login)
        .bind(email)
        .fetch_optional(&self.pool)
        .await?;

        let Some((user_id, email_text)) = user else {
            return Ok(None);
        };

        let membership = sqlx::query_as::<_, (Uuid, String)>(
            r#"
            SELECT org_id, role
            FROM org_members
            WHERE user_id = $1
            ORDER BY created_at ASC
            LIMIT 1
            "#,
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(membership.map(|(org_id, role)| DashboardSession {
            user_id,
            org_id,
            email: email_text,
            role,
        }))
    }

    async fn create_user_with_invitation(
        &self,
        github_id: &str,
        github_login: &str,
        email: &str,
        invite_token: &str,
    ) -> Result<DashboardSession, GitHubAuthError> {
        let invitation =
            epure_storage::members::find_pending_invitation_by_token(&self.pool, invite_token)
                .await?
                .filter(|inv| inv.email == email)
                .ok_or(GitHubAuthError::InvalidInviteToken)?;

        let user_id = Uuid::new_v4();

        sqlx::query(
            r#"
            INSERT INTO users (id, email, github_id, github_login, credential_generation)
            VALUES ($1, $2, $3, $4, 1)
            "#,
        )
        .bind(user_id)
        .bind(email)
        .bind(github_id)
        .bind(github_login)
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

        Ok(DashboardSession {
            user_id,
            org_id: invitation.org_id,
            email: email.to_string(),
            role: invitation.role,
        })
    }

    async fn create_user_with_org(
        &self,
        github_id: &str,
        github_login: &str,
        email: &str,
    ) -> Result<DashboardSession, GitHubAuthError> {
        let user_id = Uuid::new_v4();
        let org_id = Uuid::new_v4();
        let org_name = format!("{}'s Team", github_login);

        sqlx::query(
            r#"
            INSERT INTO users (id, email, github_id, github_login, credential_generation)
            VALUES ($1, $2, $3, $4, 1)
            "#,
        )
        .bind(user_id)
        .bind(email)
        .bind(github_id)
        .bind(github_login)
        .execute(&self.pool)
        .await?;

        sqlx::query("SELECT auth_bootstrap_workspace($1, $2, $3)")
            .bind(user_id)
            .bind(org_id)
            .bind(&org_name)
            .execute(&self.pool)
            .await?;

        Ok(DashboardSession {
            user_id,
            org_id,
            email: email.to_string(),
            role: "owner".to_string(),
        })
    }
}
