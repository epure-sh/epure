use std::sync::Arc;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Extension, Json, Router,
};
use epure_auth::DashboardSession;
use epure_storage::releases::{self, ReleaseSummary};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/releases", get(list_releases))
        .with_state(state)
}

#[derive(Deserialize)]
struct ListQuery {
    project_id: Uuid,
}

#[derive(Serialize)]
struct ReleasesResponse {
    releases: Vec<ReleaseSummary>,
}

async fn list_releases(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Query(query): Query<ListQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let rows = releases::list_releases_for_project(
        &state.pools.app,
        dashboard.org_id,
        query.project_id,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ReleasesResponse { releases: rows }))
}
