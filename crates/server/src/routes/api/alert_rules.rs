use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, patch},
    Extension, Json, Router,
};
use epure_auth::DashboardSession;
use epure_storage::alert_rules::{
    self, AlertRuleFilters, CreateAlertRuleParams, UpdateAlertRuleParams,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::rbac::{require_min_role, Role};
use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/alert-rules", get(list_rules).post(create_rule))
        .route("/alert-rules/{id}", patch(update_rule).delete(delete_rule))
        .route("/alerts/rules", get(list_rules).post(create_rule))
        .route("/alerts/rules/{id}", patch(update_rule).delete(delete_rule))
        .with_state(state)
}

#[derive(Deserialize)]
struct ProjectQuery {
    project_id: Option<String>,
}

#[derive(Deserialize)]
struct CreateBody {
    project_id: String,
    name: String,
    kind: String,
    environment: Option<String>,
    threshold: Option<i32>,
    #[serde(default)]
    filters_json: Option<AlertRuleFilters>,
    enabled: Option<bool>,
}

#[derive(Deserialize)]
struct UpdateBody {
    name: Option<String>,
    enabled: Option<bool>,
    environment: Option<Option<String>>,
    threshold: Option<Option<i32>>,
    filters_json: Option<AlertRuleFilters>,
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
    let project_id = match query.project_id.as_deref() {
        Some(raw) if !raw.trim().is_empty() => {
            let pid = epure_storage::projects::resolve_project_id(
                &state.pools.app,
                dashboard.org_id,
                raw.trim(),
            )
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            match pid {
                Some(id) => Some(id),
                None => return Err(StatusCode::NOT_FOUND),
            }
        }
        _ => None,
    };

    let rows = match project_id {
        Some(pid) => alert_rules::list_for_project(&state.pools.app, dashboard.org_id, pid).await,
        None => alert_rules::list_for_org(&state.pools.app, dashboard.org_id).await,
    }
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

    let project_id = epure_storage::projects::resolve_project_id(
        &state.pools.app,
        dashboard.org_id,
        body.project_id.trim(),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    let row = alert_rules::create_rule(
        &state.pools.app,
        dashboard.org_id,
        CreateAlertRuleParams {
            project_id,
            name,
            kind: body.kind,
            environment: normalize_environment(body.environment),
            threshold: body.threshold,
            filters_json: body.filters_json.unwrap_or_default(),
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
            filters_json: body.filters_json,
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
