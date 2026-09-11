use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Extension, Json, Router,
};
use epure_auth::DashboardSession;
use epure_storage::dsn_keys::{self, CreatedDsnKey, DsnKeyRow};
use rand::Rng;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::rbac::{require_min_role, Role};
use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/projects/{project_id}/dsn-keys",
            get(list_dsn_keys).post(create_dsn_key),
        )
        .route("/dsn-keys/{id}/revoke", post(revoke_dsn_key))
        .route(
            "/projects/{project_id}/dsn-keys/rotate",
            post(rotate_dsn_keys),
        )
        .with_state(state)
}

#[derive(Deserialize)]
struct ProjectPath {
    project_id: Uuid,
}

#[derive(Serialize)]
struct DsnKeysResponse {
    keys: Vec<DsnKeyRow>,
}

#[derive(Deserialize)]
struct CreateBody {
    label: Option<String>,
    revoke_existing: Option<bool>,
}

fn generate_public_key() -> String {
    let mut rng = rand::rng();
    (0..20)
        .map(|_| {
            const CHARSET: &[u8] = b"0123456789abcdef";
            let idx = rng.random_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

fn generate_secret_key() -> Vec<u8> {
    let mut rng = rand::rng();
    let len = rng.random_range(24..40);
    (0..len)
        .map(|_| {
            const CHARSET: &[u8] =
                b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            CHARSET[rng.random_range(0..CHARSET.len())]
        })
        .collect()
}

async fn list_dsn_keys(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(path): Path<ProjectPath>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;

    let rows = dsn_keys::list_for_project(&state.pools.app, dashboard.org_id, path.project_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(DsnKeysResponse { keys: rows }))
}

async fn create_dsn_key(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(path): Path<ProjectPath>,
    Json(body): Json<CreateBody>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;

    if body.revoke_existing.unwrap_or(false) {
        let revoked = dsn_keys::revoke_active_for_project(
            &state.pools.app,
            dashboard.org_id,
            path.project_id,
        )
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        for public_key in revoked {
            state.dsn_validator.invalidate(&public_key);
        }
    }

    let public_key = generate_public_key();
    let secret = generate_secret_key();
    let created = dsn_keys::create_key(
        &state.pools.app,
        dashboard.org_id,
        path.project_id,
        &public_key,
        &secret,
        body.label.as_deref(),
    )
    .await
    .map_err(|error| {
        if error.to_string().contains("RowNotFound") {
            StatusCode::NOT_FOUND
        } else {
            StatusCode::INTERNAL_SERVER_ERROR
        }
    })?;

    Ok((StatusCode::CREATED, Json(created)))
}

async fn revoke_dsn_key(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;

    let public_key = dsn_keys::revoke_key(&state.pools.app, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    state.dsn_validator.invalidate(&public_key);

    Ok(Json(serde_json::json!({ "revoked": true })))
}

async fn rotate_dsn_keys(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(path): Path<ProjectPath>,
    Query(body): Query<CreateBody>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;

    let revoked =
        dsn_keys::revoke_active_for_project(&state.pools.app, dashboard.org_id, path.project_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    for public_key in revoked {
        state.dsn_validator.invalidate(&public_key);
    }

    let public_key = generate_public_key();
    let secret = generate_secret_key();
    let created: CreatedDsnKey = dsn_keys::create_key(
        &state.pools.app,
        dashboard.org_id,
        path.project_id,
        &public_key,
        &secret,
        body.label.as_deref(),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(created)))
}
