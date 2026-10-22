use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Extension, Json, Router,
};
use epure_auth::DashboardSession;
use epure_storage::monitors::{self, MonitorCheckInRow, MonitorRow};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::rbac::{require_min_role, Role};
use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/monitors", get(list_monitors).post(create_monitor))
        .route("/monitors/{id}", get(get_monitor).delete(delete_monitor))
        .with_state(state)
}

#[derive(Deserialize)]
struct ProjectQuery {
    project_id: Uuid,
}

#[derive(Serialize)]
struct MonitorsResponse {
    monitors: Vec<MonitorRow>,
}

#[derive(Serialize)]
struct MonitorDetailsResponse {
    monitor: MonitorRow,
    check_ins: Vec<MonitorCheckInRow>,
}

#[derive(Deserialize)]
struct CreateMonitorBody {
    project_id: Uuid,
    slug: String,
    schedule: Option<String>,
    environment: Option<String>,
}

#[derive(Serialize)]
struct DeletedResponse {
    deleted: bool,
}

async fn list_monitors(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Query(query): Query<ProjectQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let rows = monitors::list_for_project(&state.pools.app, dashboard.org_id, query.project_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(MonitorsResponse { monitors: rows }))
}

async fn get_monitor(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let monitor = monitors::get_monitor(&state.pools.app, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let check_ins = monitors::list_check_ins(&state.pools.app, dashboard.org_id, id, 20)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(MonitorDetailsResponse { monitor, check_ins }))
}

async fn create_monitor(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Json(body): Json<CreateMonitorBody>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Member)?;

    let slug = body.slug.trim().to_lowercase();
    if slug.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let schedule = body
        .schedule
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let environment = body
        .environment
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());

    let row = monitors::create_monitor(
        &state.pools.app,
        dashboard.org_id,
        body.project_id,
        &slug,
        schedule,
        environment,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(row)))
}

async fn delete_monitor(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;

    let deleted = monitors::delete_monitor(&state.pools.app, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !deleted {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(DeletedResponse { deleted: true }))
}
