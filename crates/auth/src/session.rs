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

fn session_secure_enabled() -> bool {
    std::env::var("EPURE_SESSION_SECURE")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(true)
}

pub async fn init_session_store(pool: PgPool) -> Result<PostgresStore, sqlx::Error> {
    let store = PostgresStore::new(pool);
    store.migrate().await?;
    Ok(store)
}

pub fn spawn_session_cleanup(store: PostgresStore) {
    tokio::spawn(store.continuously_delete_expired(std::time::Duration::from_secs(15 * 60)));
}

pub async fn establish_dashboard_session(
    session: &Session,
    dashboard: &DashboardSession,
) -> Result<(), SessionError> {
    session
        .insert(SESSION_USER_ID, dashboard.user_id.to_string())
        .await?;
    session
        .insert(SESSION_ORG_ID, dashboard.org_id.to_string())
        .await?;
    session.insert(SESSION_EMAIL, dashboard.email.clone()).await?;
    session.insert(SESSION_ROLE, dashboard.role.clone()).await?;
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
