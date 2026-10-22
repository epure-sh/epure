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

use crate::routes::api::rbac::{require_min_role, Role};
use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/alerts", get(list_alerts))
        .route("/alerts/{id}", patch(patch_alert))
        .route("/alerts/test-email", post(test_email_alert))
        .route(
            "/projects/{project_id}/email-alerts",
            get(get_email_alert_settings).patch(update_email_alert_settings),
        )
        .route(
            "/projects/{project_id}/alerts/test-email",
            post(test_email_alert),
        )
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

#[derive(Serialize, Deserialize)]
pub struct ProjectEmailAlertSettings {
    pub email_alerts_enabled: bool,
    pub email_alert_recipients: Vec<String>,
    pub email_alert_on_regression: bool,
    pub email_alert_on_spike: bool,
}

#[derive(Deserialize)]
pub struct UpdateProjectEmailAlertSettings {
    pub email_alerts_enabled: Option<bool>,
    pub email_alert_recipients: Option<Vec<String>>,
    pub email_alert_on_regression: Option<bool>,
    pub email_alert_on_spike: Option<bool>,
}

async fn get_email_alert_settings(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(project_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Member)?;

    let mut tx = epure_storage::rls::begin_org_transaction(&state.pools.app, dashboard.org_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let row = sqlx::query_as::<_, (bool, Option<Vec<String>>, bool, bool)>(
        r#"
        SELECT email_alerts_enabled, email_alert_recipients, email_alert_on_regression, email_alert_on_spike
        FROM projects
        WHERE id = $1
        "#,
    )
    .bind(project_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ProjectEmailAlertSettings {
        email_alerts_enabled: row.0,
        email_alert_recipients: row.1.unwrap_or_default(),
        email_alert_on_regression: row.2,
        email_alert_on_spike: row.3,
    }))
}

async fn update_email_alert_settings(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(project_id): Path<Uuid>,
    Json(body): Json<UpdateProjectEmailAlertSettings>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;

    let mut tx = epure_storage::rls::begin_org_transaction(&state.pools.app, dashboard.org_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let existing = sqlx::query_as::<_, (bool, Option<Vec<String>>, bool, bool)>(
        r#"
        SELECT email_alerts_enabled, email_alert_recipients, email_alert_on_regression, email_alert_on_spike
        FROM projects
        WHERE id = $1
        FOR UPDATE
        "#,
    )
    .bind(project_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    let new_enabled = body.email_alerts_enabled.unwrap_or(existing.0);
    let new_recipients = body.email_alert_recipients.or(existing.1);
    let new_on_regression = body.email_alert_on_regression.unwrap_or(existing.2);
    let new_on_spike = body.email_alert_on_spike.unwrap_or(existing.3);

    sqlx::query(
        r#"
        UPDATE projects
        SET
            email_alerts_enabled = $2,
            email_alert_recipients = $3,
            email_alert_on_regression = $4,
            email_alert_on_spike = $5
        WHERE id = $1
        "#,
    )
    .bind(project_id)
    .bind(new_enabled)
    .bind(&new_recipients)
    .bind(new_on_regression)
    .bind(new_on_spike)
    .execute(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ProjectEmailAlertSettings {
        email_alerts_enabled: new_enabled,
        email_alert_recipients: new_recipients.unwrap_or_default(),
        email_alert_on_regression: new_on_regression,
        email_alert_on_spike: new_on_spike,
    }))
}
