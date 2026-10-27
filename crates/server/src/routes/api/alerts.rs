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
use epure_storage::issues;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::routes::api::rbac::{require_min_role, Role};
use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/alerts", get(list_alerts))
        .route("/alerts/simulate", post(simulate_alert))
        .route("/alerts/{id}", patch(patch_alert))
        .route("/alerts/test-email", post(test_email_alert))
        .route(
            "/projects/{project_id}/alerts/simulate",
            post(simulate_project_alert),
        )
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
    offset: Option<i64>,
    project_id: Option<String>,
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

#[derive(Deserialize)]
struct SimulateAlertBody {
    project_id: Option<String>,
    kind: Option<String>,
}

async fn list_alerts(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Query(query): Query<ListQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let offset = query.offset.unwrap_or(0).max(0);
    let environment = query.environment.as_deref().and_then(|e| {
        let trimmed = e.trim();
        if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("all") {
            None
        } else {
            Some(trimmed)
        }
    });

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

    let rows = alerts::list_alerts(
        &state.pools.app,
        alerts::ListAlertsParams {
            org_id: dashboard.org_id,
            user_id: dashboard.user_id,
            limit,
            offset,
            project_id,
            environment,
            filter: AlertListFilter::parse(query.view.as_deref()),
        },
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

    if body.read.is_some() {
        if let Some(issue_id) = row.issue_id {
            let status = if body.read == Some(true) {
                "resolved"
            } else {
                "unresolved"
            };
            let _ = issues::update_issue_status(
                &state.pools.app,
                dashboard.org_id,
                issue_id,
                status,
            )
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        }
    }

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

async fn simulate_alert(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Json(body): Json<Option<SimulateAlertBody>>,
) -> Result<impl IntoResponse, StatusCode> {
    let body = body.unwrap_or(SimulateAlertBody {
        project_id: None,
        kind: None,
    });
    simulate_alert_impl(
        &state,
        dashboard.org_id,
        body.project_id.as_deref(),
        body.kind.as_deref(),
    )
    .await
}

async fn simulate_project_alert(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(project_ref): Path<String>,
    Json(body): Json<Option<SimulateAlertBody>>,
) -> Result<impl IntoResponse, StatusCode> {
    let kind = body.and_then(|b| b.kind);
    simulate_alert_impl(
        &state,
        dashboard.org_id,
        Some(&project_ref),
        kind.as_deref(),
    )
    .await
}

async fn simulate_alert_impl(
    state: &AppState,
    org_id: Uuid,
    project_ref: Option<&str>,
    kind: Option<&str>,
) -> Result<Json<alerts::AlertRow>, StatusCode> {
    let (project_id, project_name) = match project_ref {
        Some(raw) if !raw.trim().is_empty() => {
            let pid =
                epure_storage::projects::resolve_project_id(&state.pools.app, org_id, raw.trim())
                    .await
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
                    .ok_or(StatusCode::NOT_FOUND)?;
            let mut tx = epure_storage::rls::begin_org_transaction(&state.pools.app, org_id)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            let name: Option<String> =
                sqlx::query_scalar("SELECT name FROM projects WHERE id = $1")
                    .bind(pid)
                    .fetch_optional(&mut *tx)
                    .await
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            tx.commit()
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            (pid, name.unwrap_or_else(|| "Production App".to_string()))
        }
        _ => {
            let mut tx = epure_storage::rls::begin_org_transaction(&state.pools.app, org_id)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            let row: Option<(Uuid, String)> = sqlx::query_as(
                "SELECT id, name FROM projects WHERE org_id = $1 ORDER BY created_at ASC LIMIT 1",
            )
            .bind(org_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            tx.commit()
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            row.ok_or(StatusCode::NOT_FOUND)?
        }
    };

    let alert_kind = match kind.unwrap_or("velocity_spike") {
        "regression" => "regression",
        "new_issue" | "issue_created" => "new_issue",
        "event_milestone" => "event_milestone",
        "users_affected" => "users_affected",
        "ingest_cap_hit" => "ingest_cap_hit",
        "custom" => "custom",
        _ => "velocity_spike",
    };

    let mut tx = epure_storage::rls::begin_org_transaction(&state.pools.app, org_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let existing_issue: Option<(Uuid, String)> = sqlx::query_as::<_, (Uuid, String)>(
        "SELECT id, title FROM issues WHERE project_id = $1 ORDER BY last_seen_at DESC LIMIT 1",
    )
    .bind(project_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let (issue_id, issue_title) = match existing_issue {
        Some((id, title)) => (Some(id), title),
        None => (
            None,
            "CheckoutServiceTimeout: Stripe webhook call timed out after 30s".to_string(),
        ),
    };

    let issue_id = if alert_kind == "ingest_cap_hit" {
        None
    } else {
        issue_id
    };

    let payload = match alert_kind {
        "regression" => serde_json::json!({
            "title": issue_title,
            "release": "v2.1.4",
            "resolved_in_release": "v2.0.1",
            "environment": "production",
            "message": format!("Exception '{}' returned in release v2.1.4 after being marked resolved", issue_title)
        }),
        "new_issue" => serde_json::json!({
            "title": issue_title,
            "release": "v2.1.4",
            "environment": "production",
            "message": "New exception group created from ingest"
        }),
        "event_milestone" => serde_json::json!({
            "title": issue_title,
            "threshold": 1000,
            "event_count": 1042,
            "environment": "production"
        }),
        "users_affected" => serde_json::json!({
            "title": issue_title,
            "threshold": 50,
            "unique_user_count": 58,
            "environment": "production"
        }),
        "ingest_cap_hit" => serde_json::json!({
            "project_name": project_name,
            "cap_per_hour": 10000,
            "message": format!("Hourly ingest cap (10000) reached for {} — new events are rejected until next hour", project_name)
        }),
        "custom" => serde_json::json!({
            "title": issue_title,
            "rule_name": "High Severity Exception Trigger",
            "environment": "production",
            "threshold": 300,
            "message": format!("Custom alert rule matched for issue '{}'", issue_title)
        }),
        _ => serde_json::json!({
            "title": issue_title,
            "current_window": 42,
            "previous_window": 8,
            "ratio": 5.25,
            "environment": "production",
            "message": "Event velocity surged 5.25x in the last 15 minutes"
        }),
    };

    let id = alerts::insert_alert(
        &state.pools.app,
        alerts::InsertAlertParams {
            org_id,
            project_id,
            issue_id,
            kind: alert_kind.to_string(),
            payload_json: payload.clone(),
        },
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let row = alerts::AlertRow {
        id,
        org_id,
        project_id,
        issue_id,
        kind: alert_kind.to_string(),
        fired_at: chrono::Utc::now(),
        payload_json: payload,
        read_at: None,
        ignored: false,
    };

    Ok(Json(row))
}
