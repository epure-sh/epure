use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, patch},
    Extension, Json, Router,
};
use epure_auth::DashboardSession;
use epure_storage::alerts::{self, AlertListFilter};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/alerts", get(list_alerts))
        .route("/alerts/{id}", patch(patch_alert))
        .with_state(state)
}

#[derive(Deserialize)]
struct ListQuery {
    limit: Option<i64>,
    project_id: Option<Uuid>,
    environment: Option<String>,
    view: Option<String>,
}

#[derive(Serialize)]
struct AlertsResponse {
    alerts: Vec<alerts::AlertRow>,
}

#[derive(Deserialize)]
struct PatchAlertBody {
    read: Option<bool>,
    ignored: Option<bool>,
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
        dashboard.user_id,
        limit,
        query.project_id,
        query.environment.as_deref(),
        AlertListFilter::parse(query.view.as_deref()),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(AlertsResponse { alerts: rows }))
}

async fn patch_alert(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
    Json(body): Json<PatchAlertBody>,
) -> Result<impl IntoResponse, StatusCode> {
    if body.read.is_none() && body.ignored.is_none() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let row = alerts::patch_alert(
        &state.pools.app,
        dashboard.org_id,
        dashboard.user_id,
        id,
        alerts::PatchAlertParams {
            read: body.read,
            ignored: body.ignored,
        },
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(row))
}
