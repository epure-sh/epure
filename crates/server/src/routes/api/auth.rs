use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Redirect, Response},
    routing::{get, post},
    Json, Router,
};
use epure_auth::{
    clear_dashboard_identity, clear_dashboard_session, establish_dashboard_session,
    load_credential_generation, load_dashboard_session, password_auth_enabled,
    registration_enabled, session_secure_enabled, set_credential_generation, CredentialError,
    DashboardSession, GitHubAuth, GitHubAuthError, GoogleAuth, GoogleAuthError,
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
        .route("/two-factor/verify", post(verify_second_factor))
        .route("/two-factor/enable", post(enable_two_factor))
        .route("/two-factor/disable", post(disable_two_factor))
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
        .route(
            "/organizations",
            get(list_user_organizations).post(create_workspace),
        )
        .route(
            "/organizations/{id}",
            axum::routing::patch(rename_workspace).delete(delete_workspace),
        )
        .route("/switch-org", post(switch_organization))
        .route("/profile", axum::routing::patch(update_profile))
        .route("/password", axum::routing::patch(change_password))
        .route("/two-factor", get(two_factor_status))
        .route("/two-factor/setup", post(begin_two_factor_setup))
        .route("/account/export", get(export_account))
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
    github_linked: bool,
    plan_tier: Option<String>,
    two_factor_enabled: bool,
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
    billing_workspace_id: Option<uuid::Uuid>,
}

#[derive(Serialize)]
struct UserOrganizationsResponse {
    organizations: Vec<UserOrganizationItem>,
    scale_billing_workspace_id: Option<uuid::Uuid>,
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
    from: Option<String>,
}

fn safe_login_return(value: Option<&str>) -> String {
    let Some(value) = value.filter(|v| {
        v.starts_with('/')
            && !v.starts_with("//")
            && !v.contains('\\')
            && !v.chars().any(char::is_control)
    }) else {
        return "/".into();
    };
    let Ok(url) = reqwest::Url::parse(&format!("https://epure.invalid{value}")) else {
        return "/".into();
    };
    if url.origin().ascii_serialization() != "https://epure.invalid" {
        return "/".into();
    }
    format!(
        "{}{}{}",
        url.path(),
        url.query().map(|v| format!("?{v}")).unwrap_or_default(),
        url.fragment().map(|v| format!("#{v}")).unwrap_or_default()
    )
}
async fn finish_social_login(session: &Session) -> Result<Response, StatusCode> {
    let value = session
        .remove::<String>("auth_return_to")
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Redirect::to(&safe_login_return(value.as_deref())).into_response())
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
        password_enabled: password_auth_enabled(),
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
    if !password_auth_enabled() {
        return Err(StatusCode::NOT_FOUND);
    }
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
) -> Result<Response, StatusCode> {
    if !password_auth_enabled() {
        return Err(StatusCode::NOT_FOUND);
    }
    let dashboard = state
        .credentials
        .login(&body.email, &body.password)
        .await
        .map_err(map_credential_error)?;

    let generation = credential_generation(&state, dashboard.user_id).await?;
    match sign_in(&state, &session, &dashboard, generation).await? {
        SignIn::Complete => Ok(StatusCode::NO_CONTENT.into_response()),
        SignIn::SecondFactorRequired => Ok((
            StatusCode::OK,
            Json(serde_json::json!({ "two_factor_required": true })),
        )
            .into_response()),
    }
}

const TWO_FACTOR_PENDING_KEY: &str = "two_factor_pending";
const TWO_FACTOR_PENDING_TTL_SECS: i64 = 5 * 60;

#[derive(Serialize, Deserialize)]
struct PendingSecondFactor {
    dashboard: DashboardSession,
    generation: i64,
    expires_at: i64,
    return_to: Option<String>,
}

enum SignIn {
    Complete,
    SecondFactorRequired,
}

/// Single entry for every primary login (password, magic link, Google, GitHub).
/// With 2FA on, it parks a short-lived pending state instead of a session.
async fn sign_in(
    state: &AppState,
    session: &Session,
    dashboard: &DashboardSession,
    generation: i64,
) -> Result<SignIn, StatusCode> {
    let needs_code = epure_auth::two_factor::is_enabled(&state.pools.app, dashboard.user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if !needs_code {
        establish_dashboard_session(session, dashboard, generation)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        return Ok(SignIn::Complete);
    }
    let return_to = session
        .remove::<String>("auth_return_to")
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    clear_dashboard_identity(session)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    session
        .cycle_id()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    session
        .insert(
            TWO_FACTOR_PENDING_KEY,
            PendingSecondFactor {
                dashboard: dashboard.clone(),
                generation,
                expires_at: chrono::Utc::now().timestamp() + TWO_FACTOR_PENDING_TTL_SECS,
                return_to,
            },
        )
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    session
        .save()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(SignIn::SecondFactorRequired)
}

fn second_factor_redirect() -> Response {
    Redirect::to("/login?step=two-factor").into_response()
}

#[derive(Deserialize)]
struct TwoFactorCodeBody {
    code: String,
}

/// Second step of login: 401 wrong code, 410 no pending sign-in (expired or absent).
async fn verify_second_factor(
    State(state): State<Arc<AppState>>,
    session: Session,
    Json(body): Json<TwoFactorCodeBody>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pending = session
        .get::<PendingSecondFactor>(TWO_FACTOR_PENDING_KEY)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::GONE)?;
    if chrono::Utc::now().timestamp() > pending.expires_at {
        let _ = session.remove_value(TWO_FACTOR_PENDING_KEY).await;
        return Err(StatusCode::GONE);
    }
    let valid = epure_auth::two_factor::verify_login_code(
        &state.pools.app,
        pending.dashboard.user_id,
        &body.code,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if !valid {
        return Err(StatusCode::UNAUTHORIZED);
    }
    // A password change or revocation during the 5 minutes invalidates the attempt.
    if credential_generation(&state, pending.dashboard.user_id).await? != pending.generation {
        let _ = session.remove_value(TWO_FACTOR_PENDING_KEY).await;
        return Err(StatusCode::GONE);
    }
    session
        .remove_value(TWO_FACTOR_PENDING_KEY)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    session
        .cycle_id()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    establish_dashboard_session(&session, &pending.dashboard, pending.generation)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({
        "return_to": safe_login_return(pending.return_to.as_deref()),
    })))
}

async fn two_factor_status(
    State(state): State<Arc<AppState>>,
    session: Session,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let dashboard = fresh_session(&state, &session).await?;
    let status = epure_auth::two_factor::status(&state.pools.app, dashboard.user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({
        "enabled": status.enabled,
        "recovery_codes_left": status.recovery_codes_left,
    })))
}

/// 409 when 2FA is already on (disable first to re-enroll).
async fn begin_two_factor_setup(
    State(state): State<Arc<AppState>>,
    session: Session,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let dashboard = fresh_session(&state, &session).await?;
    let setup =
        epure_auth::two_factor::begin_setup(&state.pools.app, dashboard.user_id, &dashboard.email)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::CONFLICT)?;
    Ok(Json(
        serde_json::json!({ "secret": setup.secret, "uri": setup.uri }),
    ))
}

/// 400 when the code does not match the pending secret.
async fn enable_two_factor(
    State(state): State<Arc<AppState>>,
    session: Session,
    Json(body): Json<TwoFactorCodeBody>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let dashboard = fresh_session(&state, &session).await?;
    let codes =
        epure_auth::two_factor::confirm_setup(&state.pools.app, dashboard.user_id, &body.code)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::BAD_REQUEST)?;
    Ok(Json(serde_json::json!({ "recovery_codes": codes })))
}

/// 400 when the code (TOTP or recovery) is wrong (not 401: the session stays valid).
async fn disable_two_factor(
    State(state): State<Arc<AppState>>,
    session: Session,
    Json(body): Json<TwoFactorCodeBody>,
) -> Result<StatusCode, StatusCode> {
    let dashboard = fresh_session(&state, &session).await?;
    let disabled = epure_auth::two_factor::disable(&state.pools.app, dashboard.user_id, &body.code)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if disabled {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::BAD_REQUEST)
    }
}

async fn google_start(
    State(state): State<Arc<AppState>>,
    session: Session,
    Query(query): Query<GoogleStartQuery>,
) -> Result<Response, StatusCode> {
    // Cloud only — 404 when GOOGLE_CLIENT_ID / SECRET are unset (OSS default).
    let google = state.google.as_ref().ok_or(StatusCode::NOT_FOUND)?;
    oauth_begin_session(&session).await?;
    session
        .insert("auth_return_to", safe_login_return(query.from.as_deref()))
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
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
    match sign_in(&state, &session, &dashboard, generation).await? {
        SignIn::Complete => finish_social_login(&session).await,
        SignIn::SecondFactorRequired => Ok(second_factor_redirect()),
    }
}

#[derive(Deserialize)]
struct GitHubStartQuery {
    invite: Option<String>,
    from: Option<String>,
}

async fn github_start(
    State(state): State<Arc<AppState>>,
    session: Session,
    Query(query): Query<GitHubStartQuery>,
) -> Result<Response, StatusCode> {
    let github = state.github.as_ref().ok_or(StatusCode::NOT_FOUND)?;
    oauth_begin_session(&session).await?;
    session
        .insert("auth_return_to", safe_login_return(query.from.as_deref()))
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
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
    match sign_in(&state, &session, &dashboard, generation).await? {
        SignIn::Complete => finish_social_login(&session).await,
        SignIn::SecondFactorRequired => Ok(second_factor_redirect()),
    }
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
    let dev_mode = epure_storage::allow_dev_db_fallback();
    if dev_mode {
        tracing::debug!(email = %body.email, "magic link issued (dev)");
    } else {
        tracing::info!(email = %body.email, "magic link requested");
    }
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
    match sign_in(&state, &session, &dashboard, generation).await? {
        SignIn::Complete => Ok(Redirect::to("/").into_response()),
        SignIn::SecondFactorRequired => Ok(second_factor_redirect()),
    }
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
        github_linked: profile.github_linked,
        plan_tier: profile.plan_tier,
        two_factor_enabled: epure_auth::two_factor::is_enabled(&state.pools.app, dashboard.user_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
    }))
}

async fn list_user_organizations(
    State(state): State<Arc<AppState>>,
    session: Session,
) -> Result<Json<UserOrganizationsResponse>, StatusCode> {
    let dashboard = fresh_session(&state, &session).await?;

    let rows = sqlx::query_as::<_, (uuid::Uuid, String, String, String, i64, Option<uuid::Uuid>)>(
        "SELECT org_id, name, role, plan_tier, member_count, NULLIF(ingest_billing_workspace(org_id),org_id) FROM auth_list_user_organizations($1)",
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
            |(id, name, role, plan_tier, member_count, billing_workspace_id)| {
                UserOrganizationItem {
                    is_current: id == dashboard.org_id,
                    id,
                    name,
                    role,
                    plan_tier,
                    member_count,
                    billing_workspace_id,
                }
            },
        )
        .collect();

    let scale_billing_workspace_id = if epure_core::entitlement::is_cloud() {
        sqlx::query_scalar("SELECT auth_scale_billing_workspace($1,$2)")
            .bind(dashboard.user_id)
            .bind(dashboard.org_id)
            .fetch_one(&state.pools.app)
            .await
            .map_err(workspace_db_error)?
    } else {
        None
    };
    Ok(Json(UserOrganizationsResponse {
        organizations: items,
        scale_billing_workspace_id,
    }))
}

#[derive(Deserialize)]
struct WorkspaceName {
    name: String,
    billing_workspace_id: Option<uuid::Uuid>,
}

fn workspace_db_error(error: sqlx::Error) -> StatusCode {
    tracing::error!(%error, "workspace operation failed");
    StatusCode::INTERNAL_SERVER_ERROR
}

fn validated_workspace_name(name: &str) -> Result<&str, StatusCode> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 64 || name.chars().any(char::is_control) {
        return Err(StatusCode::BAD_REQUEST);
    }
    Ok(name)
}

async fn create_workspace(
    State(state): State<Arc<AppState>>,
    session: Session,
    Json(body): Json<WorkspaceName>,
) -> Result<impl IntoResponse, StatusCode> {
    let dashboard = fresh_session(&state, &session).await?;
    if !epure_core::entitlement::is_cloud() {
        return Err(StatusCode::FORBIDDEN);
    }
    let name = validated_workspace_name(&body.name)?;
    let billing_workspace = body.billing_workspace_id.ok_or(StatusCode::BAD_REQUEST)?;
    let id: Option<uuid::Uuid> = sqlx::query_scalar("SELECT auth_create_workspace($1,$2,$3)")
        .bind(dashboard.user_id)
        .bind(billing_workspace)
        .bind(name)
        .fetch_one(&state.pools.app)
        .await
        .map_err(workspace_db_error)?;
    let id = id.ok_or(StatusCode::FORBIDDEN)?;
    Ok((StatusCode::CREATED, Json(serde_json::json!({"id":id}))))
}

async fn rename_workspace(
    State(state): State<Arc<AppState>>,
    session: Session,
    Path(id): Path<uuid::Uuid>,
    Json(body): Json<WorkspaceName>,
) -> Result<StatusCode, StatusCode> {
    let dashboard = fresh_session(&state, &session).await?;
    let name = validated_workspace_name(&body.name)?;
    let renamed: bool = sqlx::query_scalar("SELECT auth_rename_workspace($1,$2,$3)")
        .bind(dashboard.user_id)
        .bind(id)
        .bind(name)
        .fetch_one(&state.pools.app)
        .await
        .map_err(workspace_db_error)?;
    if !renamed {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn delete_workspace(
    State(state): State<Arc<AppState>>,
    session: Session,
    Path(id): Path<uuid::Uuid>,
    Json(body): Json<WorkspaceName>,
) -> Result<StatusCode, StatusCode> {
    let dashboard = fresh_session(&state, &session).await?;
    let outcome: String = sqlx::query_scalar("SELECT auth_delete_empty_workspace($1,$2,$3,$4)")
        .bind(dashboard.user_id)
        .bind(dashboard.org_id)
        .bind(id)
        .bind(body.name)
        .fetch_one(&state.pools.app)
        .await
        .map_err(workspace_db_error)?;
    match outcome.as_str() {
        "deleted" => Ok(StatusCode::NO_CONTENT),
        "forbidden" => Err(StatusCode::FORBIDDEN),
        _ => Err(StatusCode::CONFLICT),
    }
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
    if !password_auth_enabled() {
        return Err(StatusCode::NOT_FOUND);
    }
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

async fn export_account(
    State(state): State<Arc<AppState>>,
    session: Session,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let dashboard = fresh_session(&state, &session).await?;
    let body: Option<serde_json::Value> = sqlx::query_scalar("SELECT auth_export_account($1)")
        .bind(dashboard.user_id)
        .fetch_optional(&state.pools.app)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(body.ok_or(StatusCode::NOT_FOUND)?))
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
    let role =
        sqlx::query_scalar::<_, String>("SELECT role FROM auth_verify_org_membership($1, $2)")
            .bind(dashboard.user_id)
            .bind(dashboard.org_id)
            .fetch_optional(&state.pools.app)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let Some(role) = role else {
        let _ = clear_dashboard_session(session).await;
        return Err(StatusCode::UNAUTHORIZED);
    };
    Ok(DashboardSession { role, ..dashboard })
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

#[cfg(test)]
mod login_return_tests {
    use super::*;
    #[test]
    fn keeps_consent_query_and_blocks_external_returns() {
        assert_eq!(
            safe_login_return(Some("/oauth/authorize?client_id=app&state=test")),
            "/oauth/authorize?client_id=app&state=test"
        );
        for value in [
            "//evil.invalid",
            "/\\evil.invalid",
            "https://evil.invalid",
            "/\r\nLocation: evil",
        ] {
            assert_eq!(safe_login_return(Some(value)), "/");
        }
    }
}
