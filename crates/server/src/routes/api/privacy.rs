use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
    Extension, Json, Router,
};
use epure_auth::DashboardSession;
use epure_envelope::{looks_like_email, pseudonym_for};
use epure_storage::privacy;
use epure_storage::projects;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use super::rbac::{require_min_role, Role};
use crate::state::AppState;

pub fn public_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/privacy", get(privacy_notice))
        .with_state(state)
}

pub fn protected_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/projects/{id}/privacy/export", get(export_subject))
        .route("/projects/{id}/privacy/erase", post(erase_subject))
        .route(
            "/projects/{id}/privacy/strip-identifiers",
            post(strip_identifiers),
        )
        .with_state(state)
}

fn env_optional(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn env_flag(name: &str) -> bool {
    matches!(
        std::env::var(name).ok().as_deref().map(str::trim),
        Some("1") | Some("true") | Some("TRUE") | Some("yes")
    )
}

async fn privacy_notice(State(_state): State<Arc<AppState>>) -> Json<Value> {
    let cloud = env_flag("EPURE_CLOUD");
    let mut subprocessors = Vec::new();
    if env_optional("RESEND_API_KEY").is_some() {
        subprocessors.push(json!({
            "name": "Resend",
            "purpose": "Alert and invitation email",
            "data": "Recipient address and the message Epure sends",
            "configured": true
        }));
    }
    if env_optional("GOOGLE_CLIENT_ID").is_some() {
        subprocessors.push(json!({
            "name": "Google",
            "purpose": "Optional sign-in",
            "data": "The account you choose to sign in with",
            "configured": true
        }));
    }
    if env_optional("GITHUB_CLIENT_ID").is_some() {
        subprocessors.push(json!({
            "name": "GitHub",
            "purpose": "Optional sign-in",
            "data": "The account you choose to sign in with",
            "configured": true
        }));
    }
    if cloud {
        subprocessors.push(json!({
            "name": "Payment provider",
            "purpose": "Cloud subscription, invoices, and tax",
            "data": "Billing identity. Handled outside this binary.",
            "configured": true
        }));
    }

    Json(json!({
        "product": "Epure",
        "deployment": if cloud { "cloud" } else { "self_host" },
        "phone_home": false,
        "analytics": false,
        "session_replay": false,
        "stores_client_ip": false,
        "identifiers_default": "off",
        "default_retention_days": 30,
        "operator_name": env_optional("EPURE_OPERATOR_NAME"),
        "privacy_contact": env_optional("EPURE_PRIVACY_CONTACT"),
        "data_region": env_optional("EPURE_DATA_REGION"),
        "privacy_policy_url": env_optional("EPURE_PRIVACY_POLICY_URL"),
        "dpa_url": env_optional("EPURE_DPA_URL"),
        "cookies": [{
            "name": "epure.sid",
            "host_prefix_when_https": "__Host-epure.sid",
            "purpose": "Keep you signed in",
            "necessary": true,
            "duration": "14 days of inactivity",
            "flags": ["HttpOnly", "SameSite=Lax", "Secure on HTTPS"]
        }],
        "subprocessors": subprocessors,
        "rights": ["access", "erasure", "rectification", "export"]
    }))
}

#[derive(Deserialize)]
struct SubjectQuery {
    user_id: Option<String>,
    email: Option<String>,
}

fn subject_keys(user_id: Option<String>, email: Option<String>) -> Result<Vec<String>, StatusCode> {
    let user_id = user_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let email = email
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty());
    if user_id.is_none() && email.is_none() {
        return Err(StatusCode::BAD_REQUEST);
    }
    for value in user_id.iter().chain(email.iter()) {
        if value.len() > 320 {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    let mut keys = Vec::new();
    if let Some(user_id) = user_id {
        if looks_like_email(&user_id) {
            keys.push(pseudonym_for(&user_id));
            keys.push(user_id.to_ascii_lowercase());
        }
        keys.push(user_id);
    }
    if let Some(email) = email {
        keys.push(pseudonym_for(&email));
        keys.push(email);
    }
    keys.sort();
    keys.dedup();
    Ok(keys)
}

async fn export_subject(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
    Query(query): Query<SubjectQuery>,
) -> Result<Json<Value>, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;
    let keys = subject_keys(query.user_id, query.email)?;
    let project = projects::get_project(&state.pools.app, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let (total, rows) =
        privacy::export_subject(&state.pools.app, dashboard.org_id, project.id, &keys)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({
        "project_id": project.id,
        "total": total,
        "truncated": total > rows.len() as i64,
        "events": rows,
    })))
}

async fn erase_subject(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
    Json(body): Json<SubjectQuery>,
) -> Result<Json<Value>, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;
    let keys = subject_keys(body.user_id, body.email)?;
    let project = projects::get_project(&state.pools.app, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let outcome = privacy::erase_subject(&state.pools.app, dashboard.org_id, project.id, &keys)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({
        "project_id": project.id,
        "events_deleted": outcome.events_deleted,
        "feedback_deleted": outcome.feedback_deleted,
    })))
}

async fn strip_identifiers(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;
    let outcome = privacy::strip_stored_identifiers(&state.pools.app, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(json!({
        "project_id": id,
        "events_updated": outcome.events_updated,
        "feedback_cleared": outcome.feedback_cleared,
    })))
}
