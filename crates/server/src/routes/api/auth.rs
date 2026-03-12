use std::sync::Arc;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Redirect, Response},
    routing::{get, post},
    Json, Router,
};
use epure_auth::{
    clear_dashboard_session, establish_dashboard_session, load_dashboard_session, CredentialError,
    GoogleAuth, GoogleAuthError,
};
use serde::{Deserialize, Serialize};
use tower_sessions::Session;

use crate::rate_limit::login_rate_limit;
use crate::state::AppState;

const OAUTH_STATE_KEY: &str = "oauth_state";
const OAUTH_INVITE_KEY: &str = "oauth_invite_token";

pub fn router(state: Arc<AppState>) -> Router {
    let credentials = Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route_layer(axum::middleware::from_fn(login_rate_limit));

    Router::new()
        .route("/config", get(auth_config))
        .merge(credentials)
        .route("/google", get(google_start))
        .route("/google/callback", get(google_callback))
        .route("/me", get(current_session))
        .route("/profile", axum::routing::patch(update_profile))
        .route("/password", axum::routing::patch(change_password))
        .route("/account", axum::routing::delete(delete_account))
        .route("/accept-invitation", post(accept_invitation))
        .route("/logout", post(logout))
        .with_state(state)
}

#[derive(Deserialize)]
struct CredentialsBody {
    email: String,
    password: String,
    invite_token: Option<String>,
}

#[derive(Deserialize)]
struct AcceptInvitationBody {
    invite_token: String,
}

#[derive(Serialize)]
struct AuthConfigResponse {
    google_enabled: bool,
    password_enabled: bool,
}

#[derive(Serialize)]
struct MeResponse {
    user_id: String,
    org_id: String,
    email: String,
    display_name: Option<String>,
    role: String,
    has_password: bool,
    google_linked: bool,
}

#[derive(Deserialize)]
struct UpdateProfileBody {
    display_name: Option<String>,
}

#[derive(Deserialize)]
struct ChangePasswordBody {
    current_password: Option<String>,
    new_password: String,
}

#[derive(Deserialize)]
struct DeleteAccountBody {
    confirm_email: String,
    password: Option<String>,
}

#[derive(Deserialize)]
struct GoogleCallbackQuery {
    code: String,
    state: String,
}

#[derive(Deserialize)]
struct GoogleStartQuery {
    invite: Option<String>,
}

async fn auth_config(State(state): State<Arc<AppState>>) -> Json<AuthConfigResponse> {
    Json(AuthConfigResponse {
        google_enabled: state.google.is_some(),
        password_enabled: true,
    })
}

async fn register(
    State(state): State<Arc<AppState>>,
    session: Session,
    Json(body): Json<CredentialsBody>,
) -> Result<impl IntoResponse, StatusCode> {
    let dashboard = state
        .credentials
        .register(&body.email, &body.password, body.invite_token.as_deref())
        .await
        .map_err(map_credential_error)?;

    establish_dashboard_session(&session, &dashboard)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}

async fn login(
    State(state): State<Arc<AppState>>,
    session: Session,
    Json(body): Json<CredentialsBody>,
) -> Result<impl IntoResponse, StatusCode> {
    let dashboard = state
        .credentials
        .login(&body.email, &body.password)
        .await
        .map_err(map_credential_error)?;

    establish_dashboard_session(&session, &dashboard)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}

async fn google_start(
    State(state): State<Arc<AppState>>,
    session: Session,
    Query(query): Query<GoogleStartQuery>,
) -> Result<Response, StatusCode> {
    // Cloud only — 404 when GOOGLE_CLIENT_ID / SECRET are unset (OSS default).
    let google = state.google.as_ref().ok_or(StatusCode::NOT_FOUND)?;
    let state_token = GoogleAuth::generate_state();
    session
        .insert(OAUTH_STATE_KEY, state_token.clone())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if let Some(invite_token) = query
        .invite
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
    {
        session
            .insert(OAUTH_INVITE_KEY, invite_token)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    } else {
        session
            .remove::<String>(OAUTH_INVITE_KEY)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }
    session
        .save()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Redirect::to(&google.authorize_url(&state_token)).into_response())
}

async fn google_callback(
    State(state): State<Arc<AppState>>,
    session: Session,
    Query(query): Query<GoogleCallbackQuery>,
) -> Result<Response, StatusCode> {
    let google = state.google.as_ref().ok_or(StatusCode::NOT_FOUND)?;
    let expected_state = session
        .get::<String>(OAUTH_STATE_KEY)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

    if expected_state != query.state {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let invite_token = session
        .remove::<String>(OAUTH_INVITE_KEY)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let dashboard = google
        .authenticate_code(&query.code, invite_token.as_deref())
        .await
        .map_err(map_google_error)?;

    establish_dashboard_session(&session, &dashboard)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Redirect::to("/").into_response())
}

async fn current_session(
    State(state): State<Arc<AppState>>,
    session: Session,
) -> Result<Json<MeResponse>, StatusCode> {
    let dashboard = load_dashboard_session(&session)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let profile = state
        .credentials
        .account_profile(dashboard.user_id, dashboard.org_id)
        .await
        .map_err(map_credential_error)?;

    Ok(Json(MeResponse {
        user_id: profile.user_id.to_string(),
        org_id: profile.org_id.to_string(),
        email: profile.email,
        display_name: profile.display_name,
        role: profile.role,
        has_password: profile.has_password,
        google_linked: profile.google_linked,
    }))
}

async fn update_profile(
    State(state): State<Arc<AppState>>,
    session: Session,
    Json(body): Json<UpdateProfileBody>,
) -> Result<StatusCode, StatusCode> {
    let dashboard = load_dashboard_session(&session)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    state
        .credentials
        .update_profile(dashboard.user_id, body.display_name.as_deref())
        .await
        .map_err(map_credential_error)?;

    Ok(StatusCode::NO_CONTENT)
}

async fn change_password(
    State(state): State<Arc<AppState>>,
    session: Session,
    Json(body): Json<ChangePasswordBody>,
) -> Result<StatusCode, StatusCode> {
    let dashboard = load_dashboard_session(&session)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    state
        .credentials
        .change_password(
            dashboard.user_id,
            body.current_password.as_deref(),
            &body.new_password,
        )
        .await
        .map_err(map_credential_error)?;

    Ok(StatusCode::NO_CONTENT)
}

async fn delete_account(
    State(state): State<Arc<AppState>>,
    session: Session,
    Json(body): Json<DeleteAccountBody>,
) -> Result<StatusCode, StatusCode> {
    let dashboard = load_dashboard_session(&session)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    state
        .credentials
        .delete_account(
            dashboard.user_id,
            dashboard.org_id,
            body.password.as_deref(),
            &body.confirm_email,
        )
        .await
        .map_err(map_credential_error)?;

    clear_dashboard_session(&session)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}

async fn accept_invitation(
    State(state): State<Arc<AppState>>,
    session: Session,
    Json(body): Json<AcceptInvitationBody>,
) -> Result<impl IntoResponse, StatusCode> {
    let dashboard = load_dashboard_session(&session)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let updated = state
        .credentials
        .accept_invitation(dashboard.user_id, &dashboard.email, &body.invite_token)
        .await
        .map_err(map_credential_error)?;

    establish_dashboard_session(&session, &updated)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}

async fn logout(session: Session) -> Result<StatusCode, StatusCode> {
    clear_dashboard_session(&session)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}

fn map_credential_error(error: CredentialError) -> StatusCode {
    match error {
        CredentialError::EmailTaken => StatusCode::CONFLICT,
        CredentialError::WeakPassword
        | CredentialError::CurrentPasswordRequired
        | CredentialError::InvalidDisplayName
        | CredentialError::InvalidInviteToken => StatusCode::BAD_REQUEST,
        CredentialError::EmailMismatch | CredentialError::InvalidCredentials => {
            StatusCode::UNAUTHORIZED
        }
        CredentialError::TransferOwnershipRequired => StatusCode::CONFLICT,
        CredentialError::Password(_) | CredentialError::Sqlx(_) => {
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

fn map_google_error(error: GoogleAuthError) -> StatusCode {
    match error {
        GoogleAuthError::InvalidState
        | GoogleAuthError::TokenExchange
        | GoogleAuthError::UserInfo => StatusCode::UNAUTHORIZED,
        GoogleAuthError::InvalidInviteToken => StatusCode::BAD_REQUEST,
        GoogleAuthError::NotConfigured => StatusCode::NOT_FOUND,
        GoogleAuthError::Http(_) | GoogleAuthError::Sqlx(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}
