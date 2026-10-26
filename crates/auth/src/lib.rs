pub mod agent_token;
pub mod api_pat;
pub mod credentials;
pub mod dsn;
pub mod github;
pub mod google;
pub mod magic_link;
pub mod oauth;
pub mod password;
pub mod password_auth;
pub mod registration;
pub mod session;

pub use agent_token::{
    authenticate_agent_token, require_read, require_scope, AgentTokenError, AgentTokenSession,
};
pub use api_pat::ApiPatAuth;
pub use credentials::{AccountProfile, CredentialAuth, CredentialError};
pub use dsn::{DsnAuthError, DsnRecord, DsnValidator};
pub use github::{GitHubAuth, GitHubAuthError};
pub use google::{GoogleAuth, GoogleAuthError};
pub use magic_link::{create_magic_link, verify_magic_link, MagicLinkError};
pub use password::{
    dev_seed_password_hash, hash_password, hash_password_blocking, is_stored_password_hash,
    verify_password, verify_password_blocking, PasswordError,
};
pub use password_auth::{password_auth_enabled, password_auth_enabled_from};
pub use registration::{registration_enabled, registration_enabled_from};
pub use session::{
    bootstrap_session_store, build_session_layer, clear_dashboard_session,
    ensure_session_credentials, establish_dashboard_session, init_session_store,
    load_credential_generation, load_dashboard_session, load_dashboard_session_for_api,
    session_secure_enabled, set_credential_generation, spawn_session_cleanup, DashboardSession,
    SessionError,
};
pub use tower_sessions_sqlx_store::PostgresStore;
