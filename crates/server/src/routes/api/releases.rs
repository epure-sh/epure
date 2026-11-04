use std::sync::Arc;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Extension, Json, Router,
};
use epure_auth::DashboardSession;
use epure_storage::{
    projects,
    releases::{self, ReleaseSummary},
};
use serde::{Deserialize, Serialize};

use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/releases", get(list_releases))
        .route("/releases/health", get(get_release_health))
        .route(
            "/projects/{project_id}/releases/health",
            get(get_project_release_health),
        )
        .with_state(state)
}

#[derive(Deserialize)]
struct ListQuery {
    project_id: String,
}

#[derive(Deserialize)]
struct HealthQuery {
    project_id: Option<String>,
    release: Option<String>,
    environment: Option<String>,
    window: Option<String>,
}

#[derive(Serialize)]
struct ReleasesResponse {
    releases: Vec<ReleaseSummary>,
}

#[derive(Serialize)]
struct ReleaseHealthResponse {
    stats: Vec<releases::ReleaseHealthStat>,
}

fn parse_window_since(window: Option<&str>) -> chrono::DateTime<chrono::Utc> {
    let now = chrono::Utc::now();
    match window.unwrap_or("24h") {
        "1h" => now - chrono::Duration::hours(1),
        "7d" => now - chrono::Duration::days(7),
        "30d" => now - chrono::Duration::days(30),
        _ => now - chrono::Duration::hours(24),
    }
}

async fn get_release_health(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Query(query): Query<HealthQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let project_id_str = query.project_id.as_deref().ok_or(StatusCode::BAD_REQUEST)?;
    let project_id =
        projects::resolve_project_id(&state.pools.app, dashboard.org_id, project_id_str)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::NOT_FOUND)?;

    let since = parse_window_since(query.window.as_deref());
    let stats = releases::get_release_health_stats(
        &state.pools.app,
        dashboard.org_id,
        project_id,
        query.release.as_deref(),
        query.environment.as_deref(),
        since,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ReleaseHealthResponse { stats }))
}

async fn get_project_release_health(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    axum::extract::Path(project_id_str): axum::extract::Path<String>,
    Query(query): Query<HealthQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let project_id =
        projects::resolve_project_id(&state.pools.app, dashboard.org_id, &project_id_str)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::NOT_FOUND)?;

    let since = parse_window_since(query.window.as_deref());
    let stats = releases::get_release_health_stats(
        &state.pools.app,
        dashboard.org_id,
        project_id,
        query.release.as_deref(),
        query.environment.as_deref(),
        since,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ReleaseHealthResponse { stats }))
}

async fn list_releases(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Query(query): Query<ListQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let project_id =
        projects::resolve_project_id(&state.pools.app, dashboard.org_id, &query.project_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::NOT_FOUND)?;

    let rows = releases::list_releases_for_project(&state.pools.app, dashboard.org_id, project_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ReleasesResponse { releases: rows }))
}
