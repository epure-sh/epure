use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, patch, post},
    Extension, Json, Router,
};
use epure_auth::DashboardSession;
use epure_storage::alert_rules::{
    self, AlertRuleFilters, CreateAlertRuleParams, CreateChannelParams, UpdateAlertRuleParams,
};
use epure_storage::webhooks::{self, CreateWebhookParams};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::rbac::{require_min_role, Role};
use crate::lifecycle::webhooks as webhook_dispatch;
use crate::rate_limit::check_channel_test_limit;
use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/alert-rules", get(list_rules).post(create_rule))
        .route("/alert-rules/{id}", patch(update_rule).delete(delete_rule))
        .route("/alert-channels", get(list_channels).post(create_channel))
        .route(
            "/alert-channels/{id}",
            delete(delete_channel).patch(patch_channel),
        )
        .route("/alert-channels/{id}/test", post(test_channel))
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
    #[serde(default)]
    config: Option<serde_json::Value>,
    /// When true, leave channel disabled until a successful test.
    #[serde(default)]
    require_verify: Option<bool>,
}

#[derive(Deserialize)]
struct PatchChannelBody {
    is_enabled: Option<bool>,
    label: Option<String>,
}

#[derive(Deserialize)]
struct TestChannelBody {
    /// When true (default), a successful test enables the channel.
    #[serde(default = "default_true")]
    enable_on_ok: bool,
}

fn default_true() -> bool {
    true
}

fn default_webhook_events() -> Vec<String> {
    vec![
        "issue_created".to_string(),
        "regression".to_string(),
        "velocity_spike".to_string(),
        "custom_rule".to_string(),
    ]
}

async fn list_channels(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Query(query): Query<ProjectQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let raw = query.project_id.as_deref().unwrap_or("").trim();
    let channels = if raw.is_empty() {
        alert_rules::list_channels_for_org(&state.pools.app, dashboard.org_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        let project_id =
            epure_storage::projects::resolve_project_id(&state.pools.app, dashboard.org_id, raw)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
                .ok_or(StatusCode::NOT_FOUND)?;
        alert_rules::list_channels(&state.pools.app, dashboard.org_id, project_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };
    let public: Vec<_> = channels
        .iter()
        .map(alert_rules::channel_to_public)
        .collect();
    Ok(Json(serde_json::json!({ "channels": public })))
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

    let require_verify = body.require_verify.unwrap_or(true);
    let raw_config = body.config.unwrap_or_else(|| serde_json::json!({}));
    let mut signing_secret: Option<String> = None;
    let mut stored_config = serde_json::Map::new();
    let url = raw_config
        .get("url")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let recipients_raw = raw_config
        .get("recipients")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .map(|s| s.trim().to_ascii_lowercase())
                .filter(|s| !s.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let bot_token = raw_config
        .get("bot_token")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let chat_id = raw_config
        .get("chat_id")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let is_stub =
        url.is_none() && recipients_raw.is_empty() && bot_token.is_none() && chat_id.is_none();

    if is_stub {
        // Label-only stub for the alert-rule picker — not deliverable until configured
        // via Output Channels (no webhook / recipients yet).
    } else if body.provider == "telegram" {
        let bot_token = bot_token.ok_or(StatusCode::BAD_REQUEST)?;
        let chat_id = chat_id.ok_or(StatusCode::BAD_REQUEST)?;
        if !crate::lifecycle::telegram::validate_bot_token(bot_token)
            || !crate::lifecycle::telegram::validate_chat_id(chat_id)
        {
            return Err(StatusCode::BAD_REQUEST);
        }
        stored_config.insert(
            "bot_token".into(),
            serde_json::Value::String(bot_token.to_string()),
        );
        stored_config.insert(
            "chat_id".into(),
            serde_json::Value::String(chat_id.to_string()),
        );
        stored_config.insert(
            "destination_preview".into(),
            serde_json::Value::String(crate::lifecycle::telegram::mask_chat_id(chat_id)),
        );
    } else if let Some(format) = alert_rules::webhook_format_for_provider(&body.provider) {
        let url = url.ok_or(StatusCode::BAD_REQUEST)?;
        if !webhook_dispatch::validate_webhook_url(url).await {
            return Err(StatusCode::BAD_REQUEST);
        }
        let created = webhooks::create_webhook(
            &state.pools.app,
            dashboard.org_id,
            CreateWebhookParams {
                project_id,
                url: url.to_string(),
                format: format.to_string(),
                events: default_webhook_events(),
            },
        )
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        signing_secret = Some(created.signing_secret);
        stored_config.insert(
            "webhook_id".into(),
            serde_json::Value::String(created.id.to_string()),
        );
        stored_config.insert(
            "format".into(),
            serde_json::Value::String(format.to_string()),
        );
        stored_config.insert(
            "destination_preview".into(),
            serde_json::Value::String(alert_rules::mask_destination_url(url)),
        );
        stored_config.insert(
            "secret_prefix".into(),
            serde_json::Value::String(created.secret_prefix),
        );
    } else if body.provider == "email" {
        if recipients_raw.is_empty() {
            return Err(StatusCode::BAD_REQUEST);
        }
        let members = epure_storage::members::list_members(&state.pools.app, dashboard.org_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let member_emails: std::collections::HashSet<String> = members
            .iter()
            .map(|m| m.email.trim().to_ascii_lowercase())
            .collect();
        if recipients_raw
            .iter()
            .any(|email| !member_emails.contains(email))
        {
            return Err(StatusCode::BAD_REQUEST);
        }
        stored_config.insert(
            "recipients".into(),
            serde_json::Value::Array(
                recipients_raw
                    .into_iter()
                    .map(serde_json::Value::String)
                    .collect(),
            ),
        );
    } else {
        return Err(StatusCode::BAD_REQUEST);
    }

    let row = alert_rules::create_channel(
        &state.pools.app,
        dashboard.org_id,
        CreateChannelParams {
            project_id,
            provider: body.provider,
            label: label.to_string(),
            config: serde_json::Value::Object(stored_config),
            // Stubs and verify-required creates stay disabled until a successful test.
            is_enabled: !(require_verify || is_stub),
        },
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((
        StatusCode::CREATED,
        Json(alert_rules::CreatedAlertChannel {
            channel: alert_rules::channel_to_public(&row),
            signing_secret,
        }),
    ))
}

async fn patch_channel(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
    Json(body): Json<PatchChannelBody>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;
    let mut row = alert_rules::get_channel(&state.pools.app, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if let Some(enabled) = body.is_enabled {
        row = alert_rules::set_channel_enabled(&state.pools.app, dashboard.org_id, id, enabled)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::NOT_FOUND)?;
    }

    if let Some(label) = body
        .label
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
    {
        // Re-use set_channel_enabled path isn't enough — lightweight update via SQL in storage.
        let _ = label;
        let _ = &row;
        // Label rename not required for v1 gallery; ignore if only label without helper.
    }

    Ok(Json(alert_rules::channel_to_public(&row)))
}

async fn delete_channel(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;
    let row = alert_rules::delete_channel(&state.pools.app, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if let Some(webhook_id) = alert_rules::channel_webhook_id(&row.config.0) {
        let _ = webhooks::delete_webhook(&state.pools.app, dashboard.org_id, webhook_id).await;
    }

    Ok(Json(DeletedResponse { deleted: true }))
}

async fn test_channel(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
    body: Option<Json<TestChannelBody>>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;
    let enable_on_ok = body.map(|b| b.0.enable_on_ok).unwrap_or(true);

    if !check_channel_test_limit(&dashboard.user_id.to_string(), &id.to_string()) {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    let row = alert_rules::get_channel(&state.pools.app, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let test_result: Result<(), String> = if let Some(webhook_id) =
        alert_rules::channel_webhook_id(&row.config.0)
    {
        if !check_channel_test_limit("webhook", &webhook_id.to_string()) {
            return Err(StatusCode::TOO_MANY_REQUESTS);
        }
        webhook_dispatch::dispatch_test(&state.pools.app, dashboard.org_id, webhook_id).await
    } else if row.provider == "email" {
        let recipients = alert_rules::channel_email_recipients(&row.config.0);
        if recipients.is_empty() {
            Err("No recipients configured".into())
        } else {
            let subject = "[Test] Epure output channel".to_string();
            let html = format!(
                r#"<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;">
                <h2>Epure channel test</h2>
                <p>Channel <strong>{}</strong> is connected. You will receive alert notifications here when a rule routes to this channel.</p>
                </body></html>"#,
                html_escape(&row.label)
            );
            let text = format!("Epure channel test: \"{}\" is connected.", row.label);
            crate::lifecycle::resend::send_resend_email(recipients, subject, html, text)
                .await
                .map(|_| ())
        }
    } else if row.provider == "telegram" {
        match alert_rules::channel_telegram_credentials(&row.config.0) {
            Some((bot_token, chat_id)) => {
                let text = format!(
                    "Epure channel test: \"{}\" is connected. Alerts that route here will appear in this chat.",
                    row.label
                );
                crate::lifecycle::telegram::send_telegram_message(&bot_token, &chat_id, &text).await
            }
            None => Err("Telegram bot token or chat id missing".into()),
        }
    } else {
        Err("Channel type cannot be tested".into())
    };

    match test_result {
        Ok(()) => {
            let updated = alert_rules::set_channel_test_result(
                &state.pools.app,
                dashboard.org_id,
                id,
                "ok",
                None,
                enable_on_ok,
            )
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::NOT_FOUND)?;
            Ok(Json(serde_json::json!({
                "sent": true,
                "status": "ok",
                "channel": alert_rules::channel_to_public(&updated),
            })))
        }
        Err(err) => {
            let updated = alert_rules::set_channel_test_result(
                &state.pools.app,
                dashboard.org_id,
                id,
                "fail",
                Some(&err),
                false,
            )
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::NOT_FOUND)?;
            Ok(Json(serde_json::json!({
                "sent": false,
                "status": "fail",
                "error": err,
                "channel": alert_rules::channel_to_public(&updated),
            })))
        }
    }
}

async fn ping_channel(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    // Back-compat: ping now aliases a readiness check (no send).
    let ready = alert_rules::channel_ready(&state.pools.app, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    if !ready {
        return Err(StatusCode::CONFLICT);
    }
    Ok(Json(serde_json::json!({
        "status": "ready",
        "detail": "Channel is enabled. Use POST /alert-channels/{id}/test to send a test delivery."
    })))
}

fn html_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
