use axum::{
    extract::Json,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::post,
    Router,
};
use epure_mcp::{JsonRpcRequest, McpHandler};
use std::sync::Arc;

use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/mcp", post(post_mcp))
        .route("/api/mcp", post(post_mcp))
        .with_state(state)
}

async fn post_mcp(headers: HeaderMap, Json(req): Json<JsonRpcRequest>) -> impl IntoResponse {
    let token = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .unwrap_or("")
        .to_string();

    let public_url = epure_storage::epure_public_url();
    let handler = McpHandler::new(public_url, token);
    let res = handler.handle_request(req).await;
    (StatusCode::OK, Json(res))
}
