use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post},
    Extension, Json, Router,
};
use epure_auth::DashboardSession;
use epure_storage::webhooks::{self, CreateWebhookParams, WebhookRow};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::rbac::{require_min_role, Role};
use crate::lifecycle::webhooks as webhook_dispatch;
use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/webhooks", get(list_webhooks).post(create_webhook))
        .route("/webhooks/{id}", delete(delete_webhook))
        .route("/webhooks/{id}/test", post(test_webhook))
        .route("/webhooks/{id}/rotate-secret", post(rotate_webhook_secret))
        .with_state(state)
}

#[derive(Deserialize)]
struct ProjectQuery {
    project_id: Uuid,
}

#[derive(Deserialize)]
struct CreateBody {
    project_id: Uuid,
    url: String,
    format: String,
    events: Option<Vec<String>>,
}

#[derive(Serialize)]
struct WebhooksResponse {
    webhooks: Vec<WebhookRow>,
}

#[derive(Serialize)]
struct DeletedResponse {
    deleted: bool,
}

#[derive(Serialize)]
struct TestWebhookResponse {
    sent: bool,
}

fn validate_format(format: &str) -> bool {
    matches!(format, "slack" | "discord" | "generic")
}

fn validate_events(events: &[String]) -> bool {
    !events.is_empty()
        && events
            .iter()
            .all(|event| event == "issue_created" || event == "regression")
}


async fn list_webhooks(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Query(query): Query<ProjectQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let rows = webhooks::list_for_project(&state.pools.app, dashboard.org_id, query.project_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(WebhooksResponse { webhooks: rows }))
}

async fn create_webhook(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Json(body): Json<CreateBody>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;

    if !validate_format(&body.format)
        || !webhook_dispatch::validate_webhook_url(body.url.trim()).await
    {
        return Err(StatusCode::BAD_REQUEST);
    }

    let events = body
        .events
        .unwrap_or_else(|| vec!["issue_created".to_string(), "regression".to_string()]);
    if !validate_events(&events) {
        return Err(StatusCode::BAD_REQUEST);
    }

    let row = webhooks::create_webhook(
        &state.pools.app,
        dashboard.org_id,
        CreateWebhookParams {
            project_id: body.project_id,
            url: body.url.trim().to_string(),
            format: body.format,
            events,
        },
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(row)))
}

async fn delete_webhook(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;

    let deleted = webhooks::delete_webhook(&state.pools.app, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !deleted {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(DeletedResponse { deleted: true }))
}

async fn rotate_webhook_secret(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;

    let row = webhooks::rotate_signing_secret(&state.pools.app, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match row {
        Some(row) => Ok(Json(row)),
        None => Err(StatusCode::NOT_FOUND),
    }
}

async fn test_webhook(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;

    webhook_dispatch::dispatch_test(&state.pools.app, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(TestWebhookResponse { sent: true }))
}
