use axum::{
    extract::{Json, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::post,
    Router,
};
use epure_mcp::{JsonRpcError, JsonRpcRequest, JsonRpcResponse, McpHandler};
use serde_json::json;
use std::sync::Arc;

use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/mcp", post(post_mcp).get(get_mcp_status))
        .route("/api/mcp", post(post_mcp).get(get_mcp_status))
        .with_state(state)
}

async fn get_mcp_status(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    if !state.mcp_enabled {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({
                "status": "disabled",
                "message": "MCP server is deactivated on this Epure instance. Activate by setting EPURE_MCP_ENABLED=true or passing --enable-mcp."
            })),
        );
    }

    (
        StatusCode::OK,
        Json(json!({
            "status": "active",
            "server": "epure-mcp",
            "protocol": epure_mcp::MCP_PROTOCOL_VERSION,
        })),
    )
}

async fn post_mcp(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<JsonRpcRequest>,
) -> impl IntoResponse {
    if !state.mcp_enabled {
        let err_resp = JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id: req.id,
            result: None,
            error: Some(JsonRpcError {
                code: -32601,
                message: "MCP server is deactivated on this Epure instance. Activate by setting EPURE_MCP_ENABLED=true or passing --enable-mcp.".to_string(),
                data: None,
            }),
        };
        return (StatusCode::NOT_FOUND, Json(err_resp));
    }

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
