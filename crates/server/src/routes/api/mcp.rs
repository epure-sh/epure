use crate::state::AppState;
use axum::{
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use epure_mcp::{JsonRpcRequest, McpHandler};
use serde_json::json;
use std::sync::Arc;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/mcp", get(no_stream).post(post_mcp).delete(no_stream))
        .route("/api/mcp", get(no_stream).post(post_mcp).delete(no_stream))
        .route("/.well-known/oauth-protected-resource", get(metadata))
        .route("/.well-known/oauth-protected-resource/mcp", get(metadata))
        .with_state(state)
}
async fn metadata() -> impl IntoResponse {
    let base = epure_storage::epure_public_url();
    Json(
        json!({"resource":format!("{}/mcp",base.trim_end_matches('/')),"authorization_servers":[base],"bearer_methods_supported":["header"],"scopes_supported":["read:agent","write:triage","write:admin"],"resource_name":"Epure application monitoring"}),
    )
}
fn challenge(status: StatusCode, scope: &str) -> Response {
    let base = epure_storage::epure_public_url();
    let error = if status == StatusCode::FORBIDDEN {
        "insufficient_scope"
    } else {
        "invalid_token"
    };
    (status,[(header::WWW_AUTHENTICATE,format!("Bearer error=\"{error}\", resource_metadata=\"{}/.well-known/oauth-protected-resource/mcp\", scope=\"{scope}\"",base.trim_end_matches('/')))],Json(json!({"error":error}))).into_response()
}
async fn authorize(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<(String, epure_auth::AgentTokenSession), Box<Response>> {
    if !state.mcp_enabled {
        return Err(Box::new(
            (StatusCode::NOT_FOUND, Json(json!({"error":"mcp_disabled"}))).into_response(),
        ));
    }
    if let Some(origin) = headers.get(header::ORIGIN).and_then(|v| v.to_str().ok()) {
        let public = epure_storage::epure_public_url();
        if origin != public.trim_end_matches('/') && origin != "https://claude.ai" {
            return Err(Box::new(StatusCode::FORBIDDEN.into_response()));
        }
    }
    let bearer = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .unwrap_or("");
    let session = epure_auth::authenticate_agent_token(&state.pools.app, bearer)
        .await
        .map_err(|_| Box::new(challenge(StatusCode::UNAUTHORIZED, "read:agent")))?;
    let audience: Option<String> = sqlx::query_scalar("SELECT oauth_mcp_token_audience($1)")
        .bind(session.token_id)
        .fetch_optional(&state.pools.app)
        .await
        .map_err(|_| Box::new(StatusCode::INTERNAL_SERVER_ERROR.into_response()))?
        .flatten();
    if audience.as_deref() != Some("/mcp") {
        return Err(Box::new(challenge(StatusCode::UNAUTHORIZED, "read:agent")));
    }
    Ok((bearer.to_string(), session))
}
async fn no_stream(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    if let Err(response) = authorize(&state, &headers).await {
        return *response;
    }
    // Stateless Streamable HTTP: JSON POST responses, no server-initiated SSE/session stream.
    (StatusCode::METHOD_NOT_ALLOWED, [(header::ALLOW, "POST")]).into_response()
}
async fn post_mcp(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<JsonRpcRequest>,
) -> Response {
    let (token, session) = match authorize(&state, &headers).await {
        Ok(value) => value,
        Err(response) => return *response,
    };
    if req.jsonrpc != "2.0"
        || req
            .id
            .as_ref()
            .is_some_and(|v| !v.is_string() && !v.is_number() && !v.is_null())
    {
        return (StatusCode::BAD_REQUEST,Json(json!({"jsonrpc":"2.0","id":null,"error":{"code":-32600,"message":"Invalid Request"}}))).into_response();
    }
    if headers
        .get("mcp-protocol-version")
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| !["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"].contains(&v))
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error":"unsupported_protocol_version"})),
        )
            .into_response();
    }
    if req.id.is_none() {
        return StatusCode::ACCEPTED.into_response();
    }
    if req.method == "tools/call" {
        let params = req.params.as_ref().cloned().unwrap_or(json!({}));
        let args = params.get("arguments").cloned().unwrap_or(json!({}));
        if let Ok((method, path, _)) =
            epure_mcp::runtime::request_spec(params["name"].as_str().unwrap_or(""), &args)
        {
            if let Ok(method) = method.parse() {
                if super::pat_scopes::pat_missing_scopes(&method, &path, &session.scopes).is_some()
                {
                    let required = ["read:agent", "write:triage", "write:admin"]
                        .into_iter()
                        .find(|scope| {
                            super::pat_scopes::pat_missing_scopes(
                                &method,
                                &path,
                                &[scope.to_string()],
                            )
                            .is_none()
                        });
                    let Some(required) = required else {
                        return (StatusCode::FORBIDDEN, Json(json!({"error":"forbidden"})))
                            .into_response();
                    };
                    let scopes = ["read:agent", "write:triage", "write:admin"]
                        .into_iter()
                        .filter(|scope| {
                            *scope == required
                                || session.scopes.iter().any(|granted| granted == scope)
                        })
                        .collect::<Vec<_>>()
                        .join(" ");
                    return challenge(StatusCode::FORBIDDEN, &scopes);
                }
            }
        }
    }
    // The OAuth credential is issued by this same Epure instance and used only for its resource API.
    // The internal origin is configured by the operator, never supplied by the caller.
    let internal =
        std::env::var("EPURE_INTERNAL_URL").unwrap_or_else(|_| epure_storage::epure_public_url());
    let handler = McpHandler::new(internal, token);
    let reply = handler.handle_request(req).await;
    ([(header::CACHE_CONTROL, "no-store")], Json(reply)).into_response()
}
// Keep imports limited to the extractor surface used by this transport.
