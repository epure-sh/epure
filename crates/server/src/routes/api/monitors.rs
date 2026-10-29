use std::collections::HashMap;
use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Extension, Json, Router,
};
use epure_auth::DashboardSession;
use epure_storage::monitors::{
    self, CreateMonitorParams, MonitorCheckInRow, MonitorRow, RecordCheckInParams,
    UpdateMonitorParams,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::rbac::{require_min_role, Role};
use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/monitors", get(list_monitors).post(create_monitor))
        .route(
            "/monitors/{id}",
            get(get_monitor)
                .patch(update_monitor)
                .delete(delete_monitor),
        )
        .route(
            "/monitors/{id}/check-ins",
            axum::routing::post(post_check_in),
        )
        .with_state(state)
}

#[derive(Deserialize)]
struct ProjectQuery {
    project_id: Uuid,
}

#[derive(Serialize)]
struct MonitorListItem {
    #[serde(flatten)]
    monitor: MonitorRow,
    recent_check_ins: Vec<MonitorCheckInRow>,
}

#[derive(Serialize)]
struct MonitorsResponse {
    monitors: Vec<MonitorListItem>,
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
    name: Option<String>,
    schedule: Option<String>,
    schedule_type: Option<String>,
    timezone: Option<String>,
    environment: Option<String>,
    checkin_margin_mins: Option<i32>,
    max_runtime_mins: Option<i32>,
    failure_issue_threshold: Option<i32>,
}

#[derive(Deserialize)]
struct UpdateMonitorBody {
    name: Option<String>,
    schedule: Option<String>,
    schedule_type: Option<String>,
    timezone: Option<String>,
    environment: Option<String>,
    checkin_margin_mins: Option<i32>,
    max_runtime_mins: Option<i32>,
    failure_issue_threshold: Option<i32>,
    paused: Option<bool>,
}

#[derive(Deserialize)]
struct PostCheckInBody {
    status: Option<String>,
    duration_ms: Option<f64>,
}

#[derive(Serialize)]
struct DeletedResponse {
    deleted: bool,
}

fn trim_opt(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|s| !s.is_empty())
}

async fn list_monitors(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Query(query): Query<ProjectQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let rows = monitors::list_for_project(&state.pools.app, dashboard.org_id, query.project_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let check_ins = monitors::list_recent_check_ins_for_project(
        &state.pools.app,
        dashboard.org_id,
        query.project_id,
        30,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut by_monitor: HashMap<Uuid, Vec<MonitorCheckInRow>> = HashMap::new();
    for ci in check_ins {
        by_monitor.entry(ci.monitor_id).or_default().push(ci);
    }

    let monitors = rows
        .into_iter()
        .map(|monitor| {
            let recent_check_ins = by_monitor.remove(&monitor.id).unwrap_or_default();
            MonitorListItem {
                monitor,
                recent_check_ins,
            }
        })
        .collect();

    Ok(Json(MonitorsResponse { monitors }))
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

    let check_ins = monitors::list_check_ins(&state.pools.app, dashboard.org_id, id, 50)
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

    let row = monitors::create_monitor(
        &state.pools.app,
        dashboard.org_id,
        body.project_id,
        CreateMonitorParams {
            slug: &slug,
            name: trim_opt(body.name.as_deref()),
            schedule: trim_opt(body.schedule.as_deref()),
            schedule_type: trim_opt(body.schedule_type.as_deref()),
            timezone: trim_opt(body.timezone.as_deref()),
            environment: trim_opt(body.environment.as_deref()),
            checkin_margin_mins: body.checkin_margin_mins,
            max_runtime_mins: body.max_runtime_mins,
            failure_issue_threshold: body.failure_issue_threshold,
        },
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(row)))
}

async fn update_monitor(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateMonitorBody>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Member)?;

    let row = monitors::update_monitor(
        &state.pools.app,
        dashboard.org_id,
        id,
        UpdateMonitorParams {
            name: trim_opt(body.name.as_deref()),
            schedule: trim_opt(body.schedule.as_deref()),
            schedule_type: trim_opt(body.schedule_type.as_deref()),
            timezone: trim_opt(body.timezone.as_deref()),
            environment: trim_opt(body.environment.as_deref()),
            checkin_margin_mins: body.checkin_margin_mins,
            max_runtime_mins: body.max_runtime_mins,
            failure_issue_threshold: body.failure_issue_threshold,
            paused: body.paused,
            next_check_in_at: None,
        },
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(row))
}

async fn post_check_in(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
    Json(body): Json<PostCheckInBody>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Member)?;

    let monitor = monitors::get_monitor(&state.pools.app, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let status = body.status.unwrap_or_else(|| "ok".to_string());
    let row = monitors::record_check_in(
        &state.pools.app,
        dashboard.org_id,
        monitor.project_id,
        RecordCheckInParams {
            slug: monitor.slug,
            check_in_id: Some(format!("test_{}", Uuid::new_v4())),
            status,
            duration_ms: body.duration_ms.or(Some(14.0)),
            schedule: monitor.schedule,
            schedule_type: monitor.schedule_type,
            timezone: monitor.timezone,
            environment: monitor.environment,
            checkin_margin_mins: Some(monitor.checkin_margin_mins),
            max_runtime_mins: Some(monitor.max_runtime_mins),
            failure_issue_threshold: Some(monitor.failure_issue_threshold),
            ..Default::default()
        },
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
