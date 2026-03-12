use std::sync::Arc;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Extension, Json, Router,
};
use epure_auth::DashboardSession;
use epure_storage::issues::TimeWindow;
use epure_storage::projects;
use epure_storage::stats;
use serde::Deserialize;
use uuid::Uuid;

use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/stats", get(get_stats))
        .with_state(state)
}

#[derive(Deserialize)]
struct StatsQuery {
    project_id: Uuid,
    environment: Option<String>,
    window: Option<String>,
}

async fn get_stats(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Query(query): Query<StatsQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let project = projects::get_project(&state.pools.app, dashboard.org_id, query.project_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if project.is_none() {
        return Err(StatusCode::NOT_FOUND);
    }

    let time_window = TimeWindow::parse(query.window.as_deref());
    let headline = stats::headline_stats(
        &state.pools.app,
        dashboard.org_id,
        query.project_id,
        query.environment.as_deref(),
        time_window,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(headline))
}
