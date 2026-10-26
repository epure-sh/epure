use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use thiserror::Error;
use tower_sessions::session_store::ExpiredDeletion;
use tower_sessions::{Expiry, Session, SessionManagerLayer};
use tower_sessions_sqlx_store::PostgresStore;
use uuid::Uuid;

pub const SESSION_USER_ID: &str = "user_id";
pub const SESSION_ORG_ID: &str = "org_id";
pub const SESSION_EMAIL: &str = "email";
pub const SESSION_ROLE: &str = "role";
pub const SESSION_CREDENTIAL_GENERATION: &str = "credential_generation";

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DashboardSession {
    pub user_id: Uuid,
    pub org_id: Uuid,
    pub email: String,
    pub role: String,
}

#[derive(Debug, Error)]
pub enum SessionError {
    #[error("session missing required fields")]
    MissingFields,
    #[error("session credentials revoked")]
    StaleCredentials,
    #[error(transparent)]
    Store(#[from] tower_sessions::session::Error),
}

pub fn build_session_layer(store: PostgresStore) -> SessionManagerLayer<PostgresStore> {
    let secure = session_secure_enabled();
    // __Host- prefix requires Secure; browsers reject it on plain HTTP dev.
    let cookie_name = if secure {
        "__Host-epure.sid"
    } else {
        "epure.sid"
    };

    SessionManagerLayer::new(store)
        .with_name(cookie_name)
        .with_http_only(true)
        .with_same_site(tower_sessions::cookie::SameSite::Lax)
        .with_secure(secure)
        .with_path("/")
        .with_expiry(Expiry::OnInactivity(time::Duration::days(14)))
}

pub fn session_secure_enabled() -> bool {
    std::env::var("EPURE_SESSION_SECURE")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(true)
}

pub async fn bootstrap_session_store(superuser: PgPool) -> Result<(), sqlx::Error> {
    let store = PostgresStore::new(superuser.clone());
    store.migrate().await?;
    sqlx::query("GRANT USAGE ON SCHEMA tower_sessions TO epure_app")
        .execute(&superuser)
        .await?;
    sqlx::query(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tower_sessions.session TO epure_app",
    )
    .execute(&superuser)
    .await?;
    Ok(())
}

pub async fn init_session_store(pool: PgPool) -> Result<PostgresStore, sqlx::Error> {
    Ok(PostgresStore::new(pool))
}

pub fn spawn_session_cleanup(store: PostgresStore) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        if let Err(err) = store
            .continuously_delete_expired(std::time::Duration::from_secs(15 * 60))
            .await
        {
            tracing::error!("session cleanup task ended: {err}");
        }
    })
}

pub async fn establish_dashboard_session(
    session: &Session,
    dashboard: &DashboardSession,
    credential_generation: i64,
) -> Result<(), SessionError> {
    session
        .insert(SESSION_USER_ID, dashboard.user_id.to_string())
        .await?;
    session
        .insert(SESSION_ORG_ID, dashboard.org_id.to_string())
        .await?;
    session
        .insert(SESSION_EMAIL, dashboard.email.clone())
        .await?;
    session.insert(SESSION_ROLE, dashboard.role.clone()).await?;
    session
        .insert(SESSION_CREDENTIAL_GENERATION, credential_generation)
        .await?;
    session.save().await?;
    Ok(())
}

pub async fn load_credential_generation(session: &Session) -> Result<i64, SessionError> {
    session
        .get::<i64>(SESSION_CREDENTIAL_GENERATION)
        .await?
        .ok_or(SessionError::MissingFields)
}

pub async fn set_credential_generation(
    session: &Session,
    credential_generation: i64,
) -> Result<(), SessionError> {
    session
        .insert(SESSION_CREDENTIAL_GENERATION, credential_generation)
        .await?;
    session.save().await?;
    Ok(())
}

pub async fn load_dashboard_session(session: &Session) -> Result<DashboardSession, SessionError> {
    let user_id = session
        .get::<String>(SESSION_USER_ID)
        .await?
        .ok_or(SessionError::MissingFields)?;
    let org_id = session
        .get::<String>(SESSION_ORG_ID)
        .await?
        .ok_or(SessionError::MissingFields)?;
    let email = session
        .get::<String>(SESSION_EMAIL)
        .await?
        .ok_or(SessionError::MissingFields)?;
    let role = session
        .get::<String>(SESSION_ROLE)
        .await?
        .ok_or(SessionError::MissingFields)?;

    Ok(DashboardSession {
        user_id: user_id.parse().map_err(|_| SessionError::MissingFields)?,
        org_id: org_id.parse().map_err(|_| SessionError::MissingFields)?,
        email,
        role,
    })
}

pub async fn clear_dashboard_session(session: &Session) -> Result<(), SessionError> {
    session.flush().await?;
    Ok(())
}

/// Invalidate session when password or credential rotation bumped generation in DB.
pub async fn ensure_session_credentials(
    credentials: &crate::credentials::CredentialAuth,
    session: &Session,
    user_id: Uuid,
) -> Result<(), SessionError> {
    let presented = load_credential_generation(session).await?;
    let current = credentials
        .credential_generation(user_id)
        .await
        .map_err(|_| SessionError::MissingFields)?
        .ok_or(SessionError::MissingFields)?;
    if presented != current {
        clear_dashboard_session(session).await?;
        return Err(SessionError::StaleCredentials);
    }
    Ok(())
}

/// Cookie session with live credential check and current org role (dashboard API parity).
pub async fn load_dashboard_session_for_api(
    credentials: &crate::credentials::CredentialAuth,
    app_pool: &PgPool,
    session: &Session,
) -> Result<DashboardSession, SessionError> {
    let dashboard = load_dashboard_session(session).await?;
    ensure_session_credentials(credentials, session, dashboard.user_id).await?;
    epure_storage::rls::with_request_user(dashboard.user_id, async {
        let role =
            epure_storage::members::get_member_role(app_pool, dashboard.org_id, dashboard.user_id)
                .await
                .map_err(|_| SessionError::MissingFields)?
                .ok_or(SessionError::MissingFields)?;
        Ok(DashboardSession {
            user_id: dashboard.user_id,
            org_id: dashboard.org_id,
            email: dashboard.email,
            role,
        })
    })
    .await
}
