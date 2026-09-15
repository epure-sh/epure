use std::sync::Arc;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Extension, Json, Router,
};
use epure_auth::DashboardSession;
use epure_storage::alerts;
use serde::{Deserialize, Serialize};

use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/alerts", get(list_alerts))
        .with_state(state)
}

#[derive(Deserialize)]
struct ListQuery {
    limit: Option<i64>,
    project_id: Option<uuid::Uuid>,
    environment: Option<String>,
}

#[derive(Serialize)]
struct AlertsResponse {
    alerts: Vec<alerts::AlertRow>,
}

async fn list_alerts(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Query(query): Query<ListQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let rows = alerts::list_alerts(
        &state.pools.app,
        dashboard.org_id,
        limit,
        query.project_id,
        query.environment.as_deref(),
    )
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(AlertsResponse { alerts: rows }))
}
