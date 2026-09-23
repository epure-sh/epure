use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, patch},
    Extension, Json, Router,
};
use epure_auth::DashboardSession;
use epure_storage::events;
use epure_storage::projects::{self, CreateProjectParams, ProjectRow, UpdateProjectParams};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::rbac::{require_min_role, Role};
use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/projects", get(list_projects).post(create_project))
        .route(
            "/projects/{id}",
            patch(update_project).delete(delete_project),
        )
        .route("/projects/{id}/activity", get(project_activity))
        .with_state(state)
}

#[derive(Serialize)]
struct ProjectsResponse {
    projects: Vec<ProjectListItem>,
}

#[derive(Serialize)]
struct ProjectListItem {
    #[serde(flatten)]
    project: ProjectRow,
    role: String,
}

#[derive(Deserialize)]
struct CreateBody {
    name: String,
}

#[derive(Deserialize)]
struct UpdateBody {
    name: Option<String>,
    retention_days: Option<i32>,
    ingest_cap_per_hour: Option<i32>,
}

fn slugify(name: &str) -> String {
    let base: String = name
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    let trimmed = base.trim_matches('-');
    let slug = if trimmed.is_empty() {
        "project".to_string()
    } else {
        trimmed.chars().take(48).collect()
    };
    format!("{slug}-{}", &Uuid::new_v4().simple().to_string()[..8])
}

fn validate_retention(days: i32) -> bool {
    matches!(days, 14 | 30 | 90)
}

async fn list_projects(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
) -> Result<impl IntoResponse, StatusCode> {
    let rows = projects::list_projects(&state.pools.app, dashboard.org_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ProjectsResponse {
        projects: rows
            .into_iter()
            .map(|project| ProjectListItem {
                project,
                role: dashboard.role.clone(),
            })
            .collect(),
    }))
}

async fn create_project(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Json(body): Json<CreateBody>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;

    let name = body.name.trim();
    if name.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let row = projects::create_project(
        &state.pools.app,
        dashboard.org_id,
        CreateProjectParams {
            name: name.to_string(),
            slug: slugify(name),
        },
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(row)))
}

async fn update_project(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateBody>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;

    if let Some(days) = body.retention_days {
        if !validate_retention(days) {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    if let Some(cap) = body.ingest_cap_per_hour {
        if cap < 1 {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    let row = projects::update_project(
        &state.pools.app,
        dashboard.org_id,
        id,
        UpdateProjectParams {
            name: body
                .name
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty()),
            retention_days: body.retention_days,
            ingest_cap_per_hour: body.ingest_cap_per_hour,
        },
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(row))
}

async fn delete_project(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Owner)?;

    let deleted = projects::delete_project(&state.pools.app, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !deleted {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(serde_json::json!({ "deleted": true })))
}

#[derive(Serialize)]
struct ProjectActivityResponse {
    project_id: Uuid,
    buckets: Vec<events::TimelineBucket>,
}

async fn project_activity(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let project = projects::get_project(&state.pools.app, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let buckets = events::project_activity_timeline(&state.pools.app, dashboard.org_id, project.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ProjectActivityResponse {
        project_id: project.id,
        buckets,
    }))
}
