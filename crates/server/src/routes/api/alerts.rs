use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, patch, post},
    Extension, Json, Router,
};
use epure_auth::DashboardSession;
use epure_storage::alerts::{self, AlertListFilter};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/alerts", get(list_alerts))
        .route("/alerts/{id}", patch(patch_alert))
        .route("/alerts/test-email", post(test_email_alert))
        .with_state(state)
}

#[derive(Deserialize)]
struct ListQuery {
    limit: Option<i64>,
    project_id: Option<Uuid>,
    environment: Option<String>,
    view: Option<String>,
}

#[derive(Serialize)]
struct AlertsResponse {
    alerts: Vec<alerts::AlertRow>,
}

#[derive(Deserialize)]
struct PatchAlertBody {
    read: Option<bool>,
    ignored: Option<bool>,
}

async fn list_alerts(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Query(query): Query<ListQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let rows = alerts::list_alerts(
        &state.pools.app,
        dashboard.org_id,
        dashboard.user_id,
        limit,
        query.project_id,
        query.environment.as_deref(),
        AlertListFilter::parse(query.view.as_deref()),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(AlertsResponse { alerts: rows }))
}

async fn patch_alert(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
    Json(body): Json<PatchAlertBody>,
) -> Result<impl IntoResponse, StatusCode> {
    if body.read.is_none() && body.ignored.is_none() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let row = alerts::patch_alert(
        &state.pools.app,
        dashboard.org_id,
        dashboard.user_id,
        id,
        alerts::PatchAlertParams {
            read: body.read,
            ignored: body.ignored,
        },
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(row))
}

#[derive(Deserialize)]
struct TestEmailBody {
    recipient: Option<String>,
}

#[derive(Serialize)]
struct TestEmailResponse {
    sent: bool,
    recipient: String,
    resend_id: Option<String>,
    error: Option<String>,
}

async fn test_email_alert(
    State(_state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Json(body): Json<Option<TestEmailBody>>,
) -> Result<impl IntoResponse, StatusCode> {
    let to_email = body
        .and_then(|b| b.recipient)
        .filter(|e| !e.trim().is_empty())
        .unwrap_or_else(|| dashboard.email.clone());

    if to_email.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let subject = "[Test Alert] Epure Email Alerting via Resend (alert.epure.sh)".to_string();
    let html = r#"<!DOCTYPE html><html><body style="font-family: sans-serif; background: #0c0d0e; color: #fff; padding: 24px;">
        <div style="max-width: 500px; margin: 0 auto; background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 24px;">
            <h2 style="margin: 0 0 12px 0; color: #fff;">Epure Email Alert Verification</h2>
            <p style="color: #a1a1aa; font-size: 14px;">Your Resend alerting integration is working correctly. You will receive notifications here for issue regressions and critical spikes.</p>
            <p style="color: #71717a; font-size: 12px;">Sent from alerts@alert.epure.sh</p>
        </div></body></html>"#.to_string();
    let text = "Epure Email Alert Verification: Resend alerting is working correctly.".to_string();

    match crate::lifecycle::resend::send_resend_email(vec![to_email.clone()], subject, html, text)
        .await
    {
        Ok(id) => Ok(Json(TestEmailResponse {
            sent: true,
            recipient: to_email,
            resend_id: Some(id),
            error: None,
        })),
        Err(err) => Ok(Json(TestEmailResponse {
            sent: false,
            recipient: to_email,
            resend_id: None,
            error: Some(err),
        })),
    }
}
