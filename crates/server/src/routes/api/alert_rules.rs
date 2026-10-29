use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, patch, post},
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
        .route("/alert-channels", get(list_channels).post(create_channel))
        .route("/alert-channels/{id}/ping", post(ping_channel))
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
    #[serde(default)]
    triggers: Vec<serde_json::Value>,
    #[serde(default)]
    condition_match: Option<String>,
    #[serde(default)]
    conditions: Vec<serde_json::Value>,
    #[serde(default)]
    payload_options: Option<serde_json::Value>,
    #[serde(default)]
    channel_ids: Vec<Uuid>,
    #[serde(default)]
    cooldown_mins: Option<i32>,
}

#[derive(Deserialize)]
struct UpdateBody {
    name: Option<String>,
    enabled: Option<bool>,
    environment: Option<Option<String>>,
    threshold: Option<Option<i32>>,
    filters_json: Option<AlertRuleFilters>,
    triggers: Option<Vec<serde_json::Value>>,
    condition_match: Option<String>,
    conditions: Option<Vec<serde_json::Value>>,
    payload_options: Option<serde_json::Value>,
    channel_ids: Option<Vec<Uuid>>,
    cooldown_mins: Option<i32>,
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
            triggers: body.triggers,
            condition_match: body.condition_match.unwrap_or_else(|| "all".to_string()),
            conditions: body.conditions,
            payload_options: body
                .payload_options
                .unwrap_or_else(|| serde_json::json!({})),
            channel_ids: body.channel_ids,
            cooldown_mins: body.cooldown_mins.unwrap_or(30).clamp(1, 24 * 60),
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
            triggers: body.triggers,
            condition_match: body.condition_match,
            conditions: body.conditions,
            payload_options: body.payload_options,
            channel_ids: body.channel_ids,
            cooldown_mins: body.cooldown_mins.map(|mins| mins.clamp(1, 24 * 60)),
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

#[derive(Deserialize)]
struct CreateChannelBody {
    project_id: String,
    provider: String,
    label: String,
}

async fn list_channels(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Query(query): Query<ProjectQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let raw = query.project_id.as_deref().unwrap_or("").trim();
    if raw.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    let project_id =
        epure_storage::projects::resolve_project_id(&state.pools.app, dashboard.org_id, raw)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::NOT_FOUND)?;
    let channels = alert_rules::list_channels(&state.pools.app, dashboard.org_id, project_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "channels": channels })))
}

async fn create_channel(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Json(body): Json<CreateChannelBody>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;
    let label = body.label.trim();
    if label.is_empty() || !alert_rules::validate_provider(&body.provider) {
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
    let row = alert_rules::create_channel(
        &state.pools.app,
        dashboard.org_id,
        project_id,
        &body.provider,
        label,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok((StatusCode::CREATED, Json(row)))
}

async fn ping_channel(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let ready = alert_rules::channel_ready(&state.pools.app, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    if !ready {
        return Err(StatusCode::CONFLICT);
    }
    Ok(Json(serde_json::json!({
        "status": "ready",
        "detail": "Channel is saved. A message is sent when this rule matches."
    })))
}
