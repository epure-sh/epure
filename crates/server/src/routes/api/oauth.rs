use std::net::SocketAddr;
use std::sync::Arc;

use axum::{
    extract::{ConnectInfo, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{delete, get, post},
    Extension, Json, Router,
};
use epure_auth::DashboardSession;
use epure_storage::oauth::{
    self, approve_device_code, consume_oauth_code, issue_oauth_tokens, list_user_authorizations,
    lookup_device_code_by_user_code, lookup_refresh_token, poll_device_code, revoke_authorization,
    rotate_oauth_tokens, store_device_code, store_oauth_code, CreateDeviceCodeParams,
    CreateOAuthCodeParams, IssueTokensTxParams, RotateTokensTxParams,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::state::AppState;

pub fn top_level_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/.well-known/oauth-authorization-server",
            get(get_oauth_metadata),
        )
        .route("/oauth/token", post(post_oauth_token))
        .route("/oauth/device/code", post(post_device_code))
        .with_state(state)
}

pub fn protected_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/oauth/info", get(get_oauth_info))
        .route("/oauth/authorize", post(post_oauth_authorize))
        .route("/oauth/device/verify", get(get_device_verify))
        .route("/oauth/device/approve", post(post_device_approve))
        .route("/user/connected-apps", get(get_connected_apps))
        .route("/user/connected-apps/{id}", delete(delete_connected_app))
        .with_state(state)
}

fn get_public_url() -> String {
    std::env::var("EPURE_PUBLIC_URL")
        .unwrap_or_else(|_| "https://epure.sh".to_string())
        .trim_end_matches('/')
        .to_string()
}

// ---------------------------------------------------------------------------
// RFC 8414 Authorization Server Metadata (for Cursor / Claude Code MCP)
// ---------------------------------------------------------------------------

async fn get_oauth_metadata() -> impl IntoResponse {
    let base = get_public_url();
    Json(json!({
        "issuer": base,
        "authorization_endpoint": format!("{base}/oauth/authorize"),
        "token_endpoint": format!("{base}/oauth/token"),
        "device_authorization_endpoint": format!("{base}/oauth/device/code"),
        "response_types_supported": ["code"],
        "grant_types_supported": [
            "authorization_code",
            "refresh_token",
            "urn:ietf:params:oauth:grant-type:device_code"
        ],
        "code_challenge_methods_supported": ["S256"],
        "scopes_supported": ["read:agent", "write:triage", "write:admin"],
        "token_endpoint_auth_methods_supported": ["none"]
    }))
}

// ---------------------------------------------------------------------------
// OAuth Token Endpoint: /oauth/token
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct TokenRequest {
    grant_type: String,
    code: Option<String>,
    code_verifier: Option<String>,
    redirect_uri: Option<String>,
    #[allow(dead_code)]
    client_id: Option<String>,
    refresh_token: Option<String>,
    device_code: Option<String>,
}

#[derive(Serialize)]
struct TokenResponse {
    access_token: String,
    token_type: String,
    expires_in: i64,
    refresh_token: String,
    scope: String,
    org_id: Uuid,
    user_id: Uuid,
}

async fn post_oauth_token(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(body): Json<TokenRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let client_ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or(s).trim().to_string())
        .unwrap_or_else(|| addr.ip().to_string());

    let user_agent = headers
        .get(header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);

    match body.grant_type.as_str() {
        "authorization_code" => {
            let code = body.code.as_deref().ok_or_else(|| {
                (
                    StatusCode::BAD_REQUEST,
                    Json(json!({"error": "invalid_request", "error_description": "missing code"})),
                )
            })?;
            let verifier = body
                .code_verifier
                .as_deref()
                .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"error": "invalid_request", "error_description": "missing code_verifier"}))))?;

            let code_hash = epure_auth::oauth::sha256_hash(code.as_bytes());
            let stored_code = consume_oauth_code(&state.pools.app, &code_hash)
                .await
                .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "server_error"}))))?
                .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"error": "invalid_grant", "error_description": "code invalid or expired"}))))?;

            if let Some(ref req_uri) = body.redirect_uri {
                if req_uri != &stored_code.redirect_uri {
                    return Err((
                        StatusCode::BAD_REQUEST,
                        Json(
                            json!({"error": "invalid_grant", "error_description": "redirect_uri mismatch"}),
                        ),
                    ));
                }
            }

            if stored_code.code_challenge_method == "S256" {
                if !epure_auth::oauth::verify_pkce_s256(verifier, &stored_code.code_challenge) {
                    return Err((
                        StatusCode::BAD_REQUEST,
                        Json(
                            json!({"error": "invalid_grant", "error_description": "PKCE verification failed"}),
                        ),
                    ));
                }
            } else {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({"error": "unsupported_challenge_method"})),
                ));
            }

            let (access_token, access_prefix, access_hash) =
                epure_auth::oauth::generate_access_token().map_err(|_| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({"error": "server_error"})),
                    )
                })?;
            let (refresh_token, refresh_prefix, refresh_hash) =
                epure_auth::oauth::generate_refresh_token().map_err(|_| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({"error": "server_error"})),
                    )
                })?;

            let issued = issue_oauth_tokens(
                &state.pools.app,
                IssueTokensTxParams {
                    user_id: stored_code.user_id,
                    org_id: stored_code.org_id,
                    client_id: stored_code.client_id,
                    client_name: stored_code.client_name,
                    scopes: stored_code.scopes.clone(),
                    ip_address: Some(client_ip),
                    user_agent,
                    access_token_prefix: access_prefix,
                    access_token_hash: access_hash,
                    refresh_token_prefix: refresh_prefix,
                    refresh_token_hash: refresh_hash,
                },
            )
            .await
            .map_err(|err| {
                tracing::error!("failed to issue oauth tokens: {err}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": "server_error"})),
                )
            })?;

            Ok(Json(TokenResponse {
                access_token,
                token_type: "Bearer".to_string(),
                expires_in: issued.expires_in,
                refresh_token,
                scope: stored_code.scopes.join(" "),
                org_id: stored_code.org_id,
                user_id: stored_code.user_id,
            }))
        }

        "refresh_token" => {
            let rt = body
                .refresh_token
                .as_deref()
                .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"error": "invalid_request", "error_description": "missing refresh_token"}))))?;

            let prefix = epure_auth::oauth::parse_refresh_token_prefix(rt).ok_or_else(|| {
                (
                    StatusCode::BAD_REQUEST,
                    Json(json!({"error": "invalid_grant"})),
                )
            })?;

            let lookup = lookup_refresh_token(&state.pools.app, &prefix)
                .await
                .map_err(|_| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({"error": "server_error"})),
                    )
                })?
                .ok_or_else(|| {
                    (
                        StatusCode::BAD_REQUEST,
                        Json(json!({"error": "invalid_grant"})),
                    )
                })?;

            if !epure_auth::oauth::verify_token_hash(rt, &lookup.refresh_token_hash) {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({"error": "invalid_grant"})),
                ));
            }

            let (new_access_token, new_access_prefix, new_access_hash) =
                epure_auth::oauth::generate_access_token().map_err(|_| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({"error": "server_error"})),
                    )
                })?;
            let (new_refresh_token, new_refresh_prefix, new_refresh_hash) =
                epure_auth::oauth::generate_refresh_token().map_err(|_| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({"error": "server_error"})),
                    )
                })?;

            let issued = rotate_oauth_tokens(
                &state.pools.app,
                RotateTokensTxParams {
                    authorization_id: lookup.authorization_id,
                    old_agent_token_id: lookup.agent_token_id,
                    org_id: lookup.org_id,
                    user_id: lookup.user_id,
                    client_name: lookup.client_id.clone(),
                    scopes: lookup.scopes.clone(),
                    new_access_token_prefix: new_access_prefix,
                    new_access_token_hash: new_access_hash,
                    new_refresh_token_prefix: new_refresh_prefix,
                    new_refresh_token_hash: new_refresh_hash,
                },
            )
            .await
            .map_err(|err| {
                tracing::error!("failed to rotate oauth tokens: {err}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": "server_error"})),
                )
            })?;

            Ok(Json(TokenResponse {
                access_token: new_access_token,
                token_type: "Bearer".to_string(),
                expires_in: issued.expires_in,
                refresh_token: new_refresh_token,
                scope: lookup.scopes.join(" "),
                org_id: lookup.org_id,
                user_id: lookup.user_id,
            }))
        }

        "urn:ietf:params:oauth:grant-type:device_code" => {
            let dc = body
                .device_code
                .as_deref()
                .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"error": "invalid_request", "error_description": "missing device_code"}))))?;

            let dc_hash = epure_auth::oauth::sha256_hash(dc.as_bytes());
            let dev_row = poll_device_code(&state.pools.app, &dc_hash)
                .await
                .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "server_error"}))))?
                .ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({"error": "invalid_grant", "error_description": "device code expired or invalid"}))))?;

            match dev_row.status.as_str() {
                "pending" => Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({"error": "authorization_pending"})),
                )),
                "denied" => Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({"error": "access_denied"})),
                )),
                "approved" => {
                    let user_id = dev_row.user_id.ok_or_else(|| {
                        (
                            StatusCode::INTERNAL_SERVER_ERROR,
                            Json(json!({"error": "server_error"})),
                        )
                    })?;
                    let org_id = dev_row.org_id.ok_or_else(|| {
                        (
                            StatusCode::INTERNAL_SERVER_ERROR,
                            Json(json!({"error": "server_error"})),
                        )
                    })?;

                    let (access_token, access_prefix, access_hash) =
                        epure_auth::oauth::generate_access_token().map_err(|_| {
                            (
                                StatusCode::INTERNAL_SERVER_ERROR,
                                Json(json!({"error": "server_error"})),
                            )
                        })?;
                    let (refresh_token, refresh_prefix, refresh_hash) =
                        epure_auth::oauth::generate_refresh_token().map_err(|_| {
                            (
                                StatusCode::INTERNAL_SERVER_ERROR,
                                Json(json!({"error": "server_error"})),
                            )
                        })?;

                    let issued = issue_oauth_tokens(
                        &state.pools.app,
                        IssueTokensTxParams {
                            user_id,
                            org_id,
                            client_id: dev_row.client_id,
                            client_name: dev_row.client_name,
                            scopes: dev_row.scopes.clone(),
                            ip_address: Some(client_ip),
                            user_agent,
                            access_token_prefix: access_prefix,
                            access_token_hash: access_hash,
                            refresh_token_prefix: refresh_prefix,
                            refresh_token_hash: refresh_hash,
                        },
                    )
                    .await
                    .map_err(|err| {
                        tracing::error!("failed to issue oauth tokens from device code: {err}");
                        (
                            StatusCode::INTERNAL_SERVER_ERROR,
                            Json(json!({"error": "server_error"})),
                        )
                    })?;

                    Ok(Json(TokenResponse {
                        access_token,
                        token_type: "Bearer".to_string(),
                        expires_in: issued.expires_in,
                        refresh_token,
                        scope: dev_row.scopes.join(" "),
                        org_id,
                        user_id,
                    }))
                }
                _ => Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({"error": "invalid_grant"})),
                )),
            }
        }

        _ => Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "unsupported_grant_type"})),
        )),
    }
}

// ---------------------------------------------------------------------------
// RFC 8628 Device Code Endpoint: /oauth/device/code
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct DeviceCodeRequest {
    client_id: String,
    client_name: Option<String>,
    scope: Option<String>,
}

#[derive(Serialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    verification_uri_complete: String,
    expires_in: i64,
    interval: u32,
}

async fn post_device_code(
    State(state): State<Arc<AppState>>,
    Json(body): Json<DeviceCodeRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let base = get_public_url();
    let device_code = format!("epure_dc_{}", uuid::Uuid::new_v4().simple());
    let user_code = epure_auth::oauth::generate_user_code();
    let dc_hash = epure_auth::oauth::sha256_hash(device_code.as_bytes());

    let scopes = body
        .scope
        .as_deref()
        .map(|s| s.split_whitespace().map(str::to_string).collect())
        .unwrap_or_else(|| vec!["read:agent".to_string(), "write:triage".to_string()]);

    let client_name = body.client_name.unwrap_or_else(|| body.client_id.clone());

    store_device_code(
        &state.pools.app,
        CreateDeviceCodeParams {
            device_code_hash: dc_hash,
            user_code: user_code.clone(),
            client_id: body.client_id,
            client_name,
            scopes,
        },
    )
    .await
    .map_err(|err| {
        tracing::error!("failed to store device code: {err}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let verification_uri = format!("{base}/activate");
    let verification_uri_complete = format!("{base}/activate?user_code={user_code}");

    Ok(Json(DeviceCodeResponse {
        device_code,
        user_code,
        verification_uri,
        verification_uri_complete,
        expires_in: oauth::OAUTH_DEVICE_CODE_LIFETIME_MINS * 60,
        interval: 5,
    }))
}

// ---------------------------------------------------------------------------
// Protected User Endpoints (Session Authenticated)
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct AuthorizeInfoQuery {
    client_id: String,
    redirect_uri: Option<String>,
}

#[derive(Serialize)]
struct OrgSummary {
    id: Uuid,
    name: String,
    role: String,
}

async fn get_oauth_info(
    State(state): State<Arc<AppState>>,
    Extension(session): Extension<DashboardSession>,
    Query(query): Query<AuthorizeInfoQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let orgs = sqlx::query_as::<_, (Uuid, String, String)>(
        r#"
        SELECT o.id, o.name, om.role
        FROM organizations o
        JOIN org_members om ON om.org_id = o.id
        WHERE om.user_id = $1
        ORDER BY o.name ASC
        "#,
    )
    .bind(session.user_id)
    .fetch_all(&state.pools.app)
    .await
    .map_err(|err| {
        tracing::error!("failed to list user orgs for oauth: {err}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let org_list: Vec<OrgSummary> = orgs
        .into_iter()
        .map(|(id, name, role)| OrgSummary { id, name, role })
        .collect();

    Ok(Json(json!({
        "client_id": query.client_id,
        "redirect_uri": query.redirect_uri,
        "current_org_id": session.org_id,
        "organizations": org_list,
    })))
}

#[derive(Deserialize)]
struct AuthorizeApprovalRequest {
    client_id: String,
    client_name: Option<String>,
    org_id: Uuid,
    redirect_uri: String,
    code_challenge: String,
    code_challenge_method: Option<String>,
    scopes: Option<Vec<String>>,
    state: Option<String>,
}

async fn post_oauth_authorize(
    State(state): State<Arc<AppState>>,
    Extension(session): Extension<DashboardSession>,
    Json(body): Json<AuthorizeApprovalRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Verify membership in approved org
    let is_member = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM org_members WHERE user_id = $1 AND org_id = $2)",
    )
    .bind(session.user_id)
    .bind(body.org_id)
    .fetch_one(&state.pools.app)
    .await
    .unwrap_or(false);

    if !is_member {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"error": "not_member_of_org"})),
        ));
    }

    let code = format!("epure_ac_{}", uuid::Uuid::new_v4().simple());
    let code_hash = epure_auth::oauth::sha256_hash(code.as_bytes());

    let scopes = body
        .scopes
        .unwrap_or_else(|| vec!["read:agent".to_string(), "write:triage".to_string()]);
    let client_name = body.client_name.unwrap_or_else(|| body.client_id.clone());

    store_oauth_code(
        &state.pools.app,
        CreateOAuthCodeParams {
            code_hash,
            client_id: body.client_id,
            user_id: session.user_id,
            org_id: body.org_id,
            redirect_uri: body.redirect_uri.clone(),
            code_challenge: body.code_challenge,
            code_challenge_method: body
                .code_challenge_method
                .unwrap_or_else(|| "S256".to_string()),
            scopes,
            client_name,
        },
    )
    .await
    .map_err(|err| {
        tracing::error!("failed to store oauth code: {err}");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "server_error"})),
        )
    })?;

    let mut redirect = body.redirect_uri;
    let delimiter = if redirect.contains('?') { '&' } else { '?' };
    redirect.push(delimiter);
    redirect.push_str(&format!("code={code}"));
    if let Some(st) = body.state {
        redirect.push_str(&format!("&state={}", urlencoding::encode(&st)));
    }

    Ok(Json(json!({
        "code": code,
        "redirect_uri": redirect
    })))
}

#[derive(Deserialize)]
struct DeviceVerifyQuery {
    user_code: String,
}

async fn get_device_verify(
    State(state): State<Arc<AppState>>,
    Extension(_session): Extension<DashboardSession>,
    Query(query): Query<DeviceVerifyQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let row = lookup_device_code_by_user_code(&state.pools.app, &query.user_code)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(json!({
        "user_code": row.user_code,
        "client_name": row.client_name,
        "scopes": row.scopes,
        "status": row.status
    })))
}

#[derive(Deserialize)]
struct DeviceApproveRequest {
    user_code: String,
    org_id: Uuid,
}

async fn post_device_approve(
    State(state): State<Arc<AppState>>,
    Extension(session): Extension<DashboardSession>,
    Json(body): Json<DeviceApproveRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let success = approve_device_code(
        &state.pools.app,
        &body.user_code,
        session.user_id,
        body.org_id,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !success {
        return Err(StatusCode::BAD_REQUEST);
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn get_connected_apps(
    State(state): State<Arc<AppState>>,
    Extension(session): Extension<DashboardSession>,
) -> Result<impl IntoResponse, StatusCode> {
    let apps = list_user_authorizations(&state.pools.app, session.user_id)
        .await
        .map_err(|err| {
            tracing::error!("failed to list connected apps: {err}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(json!({ "connected_apps": apps })))
}

#[derive(Deserialize)]
struct RevokeParams {
    id: Uuid,
}

async fn delete_connected_app(
    State(state): State<Arc<AppState>>,
    Extension(session): Extension<DashboardSession>,
    axum::extract::Path(RevokeParams { id }): axum::extract::Path<RevokeParams>,
) -> Result<impl IntoResponse, StatusCode> {
    let success = revoke_authorization(&state.pools.app, session.user_id, id)
        .await
        .map_err(|err| {
            tracing::error!("failed to revoke authorization: {err}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if !success {
        return Err(StatusCode::NOT_FOUND);
    }
    Ok(StatusCode::NO_CONTENT)
}
