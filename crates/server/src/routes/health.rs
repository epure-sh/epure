use axum::extract::State;
use axum::{routing::get, Json, Router};
use serde::Serialize;
use std::sync::Arc;

use crate::pipeline::worker::lost_event_count;
use crate::state::AppState;

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
}

#[derive(Serialize)]
struct ReadyResponse {
    status: &'static str,
    database: &'static str,
    lost_event_count: u64,
    queue_depth: usize,
    ingest_lag_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    git_sha: Option<String>,
}

fn optional_env(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok" })
}

async fn health_ready(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ReadyResponse>, axum::http::StatusCode> {
    for pool in [&state.pools.app, &state.pools.ingest] {
        sqlx::query("SELECT 1").execute(pool).await.map_err(|e| {
            tracing::warn!("readiness database check failed: {e}");
            axum::http::StatusCode::SERVICE_UNAVAILABLE
        })?;
    }
    Ok(Json(ReadyResponse {
        status: "ok",
        database: "ok",
        lost_event_count: lost_event_count(),
        queue_depth: state
            .ingest_tx
            .max_capacity()
            .saturating_sub(state.ingest_tx.capacity()),
        ingest_lag_ms: state.outcomes.lag_ms(),
        version: optional_env("EPURE_VERSION"),
        git_sha: optional_env("EPURE_GIT_SHA"),
    }))
}

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/health/ready", get(health_ready))
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    #[tokio::test]
    async fn health_returns_ok() {
        let app = Router::new().route("/health", get(health));
        let response = app
            .oneshot(Request::get("/health").body(Body::empty()).unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        assert_eq!(body, r#"{"status":"ok"}"#);
    }
}
