use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, patch},
    Extension, Json, Router,
};
use epure_auth::DashboardSession;
use epure_storage::alert_rules::{self, CreateAlertRuleParams, UpdateAlertRuleParams};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::rbac::{require_min_role, Role};
use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/alert-rules", get(list_rules).post(create_rule))
        .route("/alert-rules/{id}", patch(update_rule).delete(delete_rule))
        .with_state(state)
}

#[derive(Deserialize)]
struct ProjectQuery {
    project_id: Uuid,
}

#[derive(Deserialize)]
struct CreateBody {
    project_id: Uuid,
    name: String,
    kind: String,
    environment: Option<String>,
    threshold: Option<i32>,
    enabled: Option<bool>,
}

#[derive(Deserialize)]
struct UpdateBody {
    name: Option<String>,
    enabled: Option<bool>,
    environment: Option<Option<String>>,
    threshold: Option<Option<i32>>,
}

#[derive(Serialize)]
struct RulesResponse {
    rules: Vec<alert_rules::AlertRuleRow>,
}

#[derive(Serialize)]
struct DeletedResponse {
    deleted: bool,
}

fn normalize_environment(value: Option<String>) -> Option<String> {
    value.and_then(|raw| {
        let trimmed = raw.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

async fn list_rules(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Query(query): Query<ProjectQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let rows = alert_rules::list_for_project(&state.pools.app, dashboard.org_id, query.project_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(RulesResponse { rules: rows }))
}

async fn create_rule(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Json(body): Json<CreateBody>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;

    let name = body.name.trim().to_string();
    if name.is_empty() || !alert_rules::validate_kind(&body.kind) {
        return Err(StatusCode::BAD_REQUEST);
    }

    let row = alert_rules::create_rule(
        &state.pools.app,
        dashboard.org_id,
        CreateAlertRuleParams {
            project_id: body.project_id,
            name,
            kind: body.kind,
            environment: normalize_environment(body.environment),
            threshold: body.threshold,
            enabled: body.enabled.unwrap_or(true),
        },
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(row)))
}

async fn update_rule(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateBody>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;

    let name = body.name.map(|value| value.trim().to_string());
    if name.as_ref().is_some_and(|value| value.is_empty()) {
        return Err(StatusCode::BAD_REQUEST);
    }

    let row = alert_rules::update_rule(
        &state.pools.app,
        dashboard.org_id,
        id,
        UpdateAlertRuleParams {
            name,
            enabled: body.enabled,
            environment: body.environment.map(normalize_environment),
            threshold: body.threshold,
        },
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(row))
}

async fn delete_rule(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;

    let deleted = alert_rules::delete_rule(&state.pools.app, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !deleted {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(DeletedResponse { deleted: true }))
}
