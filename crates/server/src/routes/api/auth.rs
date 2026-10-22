use std::sync::Arc;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Redirect, Response},
    routing::{get, post},
    Json, Router,
};
use epure_auth::{
    clear_dashboard_session, establish_dashboard_session, load_credential_generation,
    load_dashboard_session, registration_enabled, session_secure_enabled,
    set_credential_generation, CredentialError, DashboardSession, GitHubAuth, GitHubAuthError,
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
        .route("/github", get(github_start))
        .route("/github/callback", get(github_callback))
        .route("/magic-link", post(request_magic_link))
        .route("/magic-link/verify", get(verify_magic_link_handler))
        .route("/me", get(current_session))
        .route("/organizations", get(list_user_organizations))
        .route("/switch-org", post(switch_organization))
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
    github_enabled: bool,
    password_enabled: bool,
    registration_enabled: bool,
    session_secure: bool,
    mcp_enabled: bool,
}

#[derive(Serialize)]
struct MeResponse {
    user_id: String,
    org_id: String,
    org_name: Option<String>,
    email: String,
    display_name: Option<String>,
    role: String,
    has_password: bool,
    google_linked: bool,
    plan_tier: Option<String>,
}

#[derive(Deserialize)]
struct SwitchOrgBody {
    org_id: uuid::Uuid,
}

#[derive(Serialize)]
struct UserOrganizationItem {
    id: uuid::Uuid,
    name: String,
    role: String,
    plan_tier: String,
    member_count: i64,
    is_current: bool,
}

#[derive(Serialize)]
struct UserOrganizationsResponse {
    organizations: Vec<UserOrganizationItem>,
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
struct OAuthCallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
}

#[derive(Deserialize)]
struct GoogleStartQuery {
    invite: Option<String>,
}

fn oauth_login_redirect(error: &str) -> Response {
    Redirect::to(&format!("/login?error={error}")).into_response()
}

#[allow(clippy::result_large_err)]
fn parse_oauth_callback(query: &OAuthCallbackQuery) -> Result<(String, String), Response> {
    if query
        .error
        .as_deref()
        .is_some_and(|value| !value.is_empty())
    {
        return Err(oauth_login_redirect("oauth_denied"));
    }
    match (
        query.code.as_deref().filter(|v| !v.is_empty()),
        query.state.as_deref().filter(|v| !v.is_empty()),
    ) {
        (Some(code), Some(state)) => Ok((code.to_string(), state.to_string())),
        _ => Err(oauth_login_redirect("oauth_invalid")),
    }
}

async fn oauth_begin_session(session: &Session) -> Result<(), StatusCode> {
    // Drop stale browser cookies whose id is missing from the store (common after DB resets).
    session
        .cycle_id()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn auth_config(State(state): State<Arc<AppState>>) -> Json<AuthConfigResponse> {
    Json(AuthConfigResponse {
        google_enabled: state.google.is_some(),
        github_enabled: state.github.is_some(),
        password_enabled: true,
        registration_enabled: registration_enabled(),
        session_secure: session_secure_enabled(),
        mcp_enabled: state.mcp_enabled,
    })
}

async fn register(
    State(state): State<Arc<AppState>>,
    session: Session,
    Json(body): Json<CredentialsBody>,
) -> Result<impl IntoResponse, StatusCode> {
    let invite_token = body
        .invite_token
        .as_deref()
        .map(str::trim)
        .filter(|token| !token.is_empty());
    if invite_token.is_none() && !registration_enabled() {
        return Err(StatusCode::FORBIDDEN);
    }

    let dashboard = state
        .credentials
        .register(&body.email, &body.password, invite_token)
        .await
        .map_err(map_credential_error)?;

    let generation = credential_generation(&state, dashboard.user_id).await?;
    establish_dashboard_session(&session, &dashboard, generation)
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

    let generation = credential_generation(&state, dashboard.user_id).await?;
    establish_dashboard_session(&session, &dashboard, generation)
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
    oauth_begin_session(&session).await?;
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
    Query(query): Query<OAuthCallbackQuery>,
) -> Result<Response, StatusCode> {
    let google = state.google.as_ref().ok_or(StatusCode::NOT_FOUND)?;
    let (code, state_param) = match parse_oauth_callback(&query) {
        Ok(values) => values,
        Err(response) => {
            tracing::warn!("google oauth callback rejected: missing or denied parameters");
            return Ok(response);
        }
    };

    let expected_state = match session
        .get::<String>(OAUTH_STATE_KEY)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    {
        Some(value) => value,
        None => {
            tracing::warn!("google oauth callback: session missing oauth state (stale cookie?)");
            return Ok(oauth_login_redirect("oauth_state"));
        }
    };

    if expected_state != state_param {
        tracing::warn!("google oauth callback: state mismatch");
        return Ok(oauth_login_redirect("oauth_state"));
    }

    let invite_token = session
        .remove::<String>(OAUTH_INVITE_KEY)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let dashboard = match google
        .authenticate_code(&code, invite_token.as_deref())
        .await
    {
        Ok(dashboard) => dashboard,
        Err(GoogleAuthError::RegistrationClosed) => {
            return Ok(Redirect::to("/login?error=registration_closed").into_response());
        }
        Err(error) => {
            tracing::warn!("google oauth token exchange failed: {error}");
            return Ok(oauth_login_redirect("oauth_google"));
        }
    };

    let generation = credential_generation(&state, dashboard.user_id).await?;
    establish_dashboard_session(&session, &dashboard, generation)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Redirect::to("/").into_response())
}

#[derive(Deserialize)]
struct GitHubStartQuery {
    invite: Option<String>,
}

async fn github_start(
    State(state): State<Arc<AppState>>,
    session: Session,
    Query(query): Query<GitHubStartQuery>,
) -> Result<Response, StatusCode> {
    let github = state.github.as_ref().ok_or(StatusCode::NOT_FOUND)?;
    oauth_begin_session(&session).await?;
    let state_token = GitHubAuth::generate_state();
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

    Ok(Redirect::to(&github.authorize_url(&state_token)).into_response())
}

async fn github_callback(
    State(state): State<Arc<AppState>>,
    session: Session,
    Query(query): Query<OAuthCallbackQuery>,
) -> Result<Response, StatusCode> {
    let github = state.github.as_ref().ok_or(StatusCode::NOT_FOUND)?;
    let (code, state_param) = match parse_oauth_callback(&query) {
        Ok(values) => values,
        Err(response) => {
            tracing::warn!("github oauth callback rejected: missing or denied parameters");
            return Ok(response);
        }
    };

    let expected_state = match session
        .get::<String>(OAUTH_STATE_KEY)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    {
        Some(value) => value,
        None => {
            tracing::warn!("github oauth callback: session missing oauth state (stale cookie?)");
            return Ok(oauth_login_redirect("oauth_state"));
        }
    };

    if expected_state != state_param {
        tracing::warn!("github oauth callback: state mismatch");
        return Ok(oauth_login_redirect("oauth_state"));
    }

    let invite_token = session
        .remove::<String>(OAUTH_INVITE_KEY)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let dashboard = match github
        .authenticate_code(&code, invite_token.as_deref())
        .await
    {
        Ok(dashboard) => dashboard,
        Err(GitHubAuthError::RegistrationClosed) => {
            return Ok(Redirect::to("/login?error=registration_closed").into_response());
        }
        Err(error) => {
            tracing::warn!("github oauth failed: {error}");
            return Ok(oauth_login_redirect("oauth_github"));
        }
    };

    let generation = credential_generation(&state, dashboard.user_id).await?;
    establish_dashboard_session(&session, &dashboard, generation)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Redirect::to("/").into_response())
}

#[derive(Deserialize)]
struct MagicLinkRequestBody {
    email: String,
    org_id: Option<uuid::Uuid>,
    role: Option<String>,
}

#[derive(Serialize)]
struct MagicLinkRequestResponse {
    sent: bool,
    dev_link: Option<String>,
}

async fn request_magic_link(
    State(state): State<Arc<AppState>>,
    Json(body): Json<MagicLinkRequestBody>,
) -> Result<Json<MagicLinkRequestResponse>, StatusCode> {
    let token = epure_auth::create_magic_link(
        &state.pools.app,
        &body.email,
        body.org_id,
        body.role.as_deref(),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let public_url = epure_storage::epure_public_url();
    let link = format!(
        "{}/api/v1/auth/magic-link/verify?token={}",
        public_url, token
    );
    tracing::info!("magic link requested for {}: {}", body.email, link);

    let dev_mode = epure_storage::allow_dev_db_fallback();
    Ok(Json(MagicLinkRequestResponse {
        sent: true,
        dev_link: if dev_mode { Some(link) } else { None },
    }))
}

#[derive(Deserialize)]
struct VerifyMagicLinkQuery {
    token: String,
}

async fn verify_magic_link_handler(
    State(state): State<Arc<AppState>>,
    session: Session,
    Query(query): Query<VerifyMagicLinkQuery>,
) -> Result<Response, StatusCode> {
    let dashboard = epure_auth::verify_magic_link(&state.pools.app, &query.token)
        .await
        .map_err(|e| match e {
            epure_auth::MagicLinkError::InvalidOrExpiredToken => StatusCode::UNAUTHORIZED,
            epure_auth::MagicLinkError::RegistrationClosed => StatusCode::FORBIDDEN,
            epure_auth::MagicLinkError::Sqlx(_) => StatusCode::INTERNAL_SERVER_ERROR,
        })?;

    let generation = credential_generation(&state, dashboard.user_id).await?;
    establish_dashboard_session(&session, &dashboard, generation)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Redirect::to("/").into_response())
}

async fn current_session(
    State(state): State<Arc<AppState>>,
    session: Session,
) -> Result<Json<MeResponse>, StatusCode> {
    let dashboard = fresh_session(&state, &session).await?;

    let profile = state
        .credentials
        .account_profile(dashboard.user_id, dashboard.org_id)
        .await
        .map_err(map_credential_error)?;

    Ok(Json(MeResponse {
        user_id: profile.user_id.to_string(),
        org_id: profile.org_id.to_string(),
        org_name: profile.org_name,
        email: profile.email,
        display_name: profile.display_name,
        role: profile.role,
        has_password: profile.has_password,
        google_linked: profile.google_linked,
        plan_tier: profile.plan_tier,
    }))
}

async fn list_user_organizations(
    State(state): State<Arc<AppState>>,
    session: Session,
) -> Result<Json<UserOrganizationsResponse>, StatusCode> {
    let dashboard = fresh_session(&state, &session).await?;

    let rows = sqlx::query_as::<_, (uuid::Uuid, String, String, String, i64, chrono::DateTime<chrono::Utc>)>(
        "SELECT org_id, name, role, plan_tier, member_count, created_at FROM auth_list_user_organizations($1)",
    )
    .bind(dashboard.user_id)
    .fetch_all(&state.pools.app)
    .await
    .map_err(|err| {
        tracing::error!("failed to fetch user organizations: {err}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let items = rows
        .into_iter()
        .map(
            |(id, name, role, plan_tier, member_count, _)| UserOrganizationItem {
                is_current: id == dashboard.org_id,
                id,
                name,
                role,
                plan_tier,
                member_count,
            },
        )
        .collect();

    Ok(Json(UserOrganizationsResponse {
        organizations: items,
    }))
}

async fn switch_organization(
    State(state): State<Arc<AppState>>,
    session: Session,
    Json(body): Json<SwitchOrgBody>,
) -> Result<impl IntoResponse, StatusCode> {
    let mut dashboard = fresh_session(&state, &session).await?;

    let verified = sqlx::query_as::<_, (uuid::Uuid, String, String, String)>(
        "SELECT org_id, name, role, plan_tier FROM auth_verify_org_membership($1, $2)",
    )
    .bind(dashboard.user_id)
    .bind(body.org_id)
    .fetch_optional(&state.pools.app)
    .await
    .map_err(|err| {
        tracing::error!("failed to verify org membership: {err}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::FORBIDDEN)?;

    dashboard.org_id = verified.0;
    dashboard.role = verified.2;

    let generation = credential_generation(&state, dashboard.user_id).await?;
    establish_dashboard_session(&session, &dashboard, generation)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({
        "success": true,
        "org_id": verified.0,
        "org_name": verified.1,
        "role": dashboard.role,
        "plan_tier": verified.3,
    })))
}

async fn update_profile(
    State(state): State<Arc<AppState>>,
    session: Session,
    Json(body): Json<UpdateProfileBody>,
) -> Result<StatusCode, StatusCode> {
    let dashboard = fresh_session(&state, &session).await?;

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
    let dashboard = fresh_session(&state, &session).await?;

    let generation = state
        .credentials
        .change_password(
            dashboard.user_id,
            body.current_password.as_deref(),
            &body.new_password,
        )
        .await
        .map_err(map_credential_error)?;
    set_credential_generation(&session, generation)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}

async fn delete_account(
    State(state): State<Arc<AppState>>,
    session: Session,
    Json(body): Json<DeleteAccountBody>,
) -> Result<StatusCode, StatusCode> {
    let dashboard = fresh_session(&state, &session).await?;

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
    let dashboard = fresh_session(&state, &session).await?;

    let updated = state
        .credentials
        .accept_invitation(dashboard.user_id, &dashboard.email, &body.invite_token)
        .await
        .map_err(map_credential_error)?;

    let generation = credential_generation(&state, updated.user_id).await?;
    establish_dashboard_session(&session, &updated, generation)
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

async fn credential_generation(state: &AppState, user_id: uuid::Uuid) -> Result<i64, StatusCode> {
    state
        .credentials
        .credential_generation(user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)
}

async fn fresh_session(
    state: &AppState,
    session: &tower_sessions::Session,
) -> Result<DashboardSession, StatusCode> {
    let dashboard = load_dashboard_session(session)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;
    let presented = load_credential_generation(session)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;
    let current = credential_generation(state, dashboard.user_id).await?;
    if presented != current {
        let _ = clear_dashboard_session(session).await;
        return Err(StatusCode::UNAUTHORIZED);
    }
    Ok(dashboard)
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
