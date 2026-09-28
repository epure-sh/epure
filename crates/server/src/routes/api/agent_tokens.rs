use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Extension, Json, Router,
};
use epure_auth::{hash_password, DashboardSession};
use epure_storage::agent_tokens::{
    self, scopes_valid, CreatedAgentToken, SCOPE_READ_AGENT, TOKEN_PREFIX,
    TOKEN_PREFIX_DISPLAY_LEN,
};
use rand::Rng;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::rbac::{require_min_role, Role};
use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/agent-tokens", get(list_tokens).post(create_token))
        .route("/agent-tokens/{id}/revoke", post(revoke_token))
        .with_state(state)
}

#[derive(Serialize)]
struct TokensResponse {
    tokens: Vec<epure_storage::agent_tokens::AgentTokenRow>,
}

#[derive(Deserialize)]
struct CreateBody {
    label: Option<String>,
    scopes: Option<Vec<String>>,
}

#[derive(Serialize)]
struct CreateResponse {
    token: CreatedAgentToken,
}

async fn list_tokens(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;
    let rows = agent_tokens::list_for_org(&state.pools.app, dashboard.org_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(TokensResponse { tokens: rows }))
}

fn generate_secret() -> String {
    const CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut rng = rand::rng();
    (0..40)
        .map(|_| {
            let idx = rng.random_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

async fn create_token(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Json(body): Json<CreateBody>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;

    let mut scopes = body.scopes.unwrap_or_else(|| vec![SCOPE_READ_AGENT.to_string()]);
    if scopes.is_empty() {
        scopes.push(SCOPE_READ_AGENT.to_string());
    }
    if !scopes_valid(&scopes) {
        return Err(StatusCode::BAD_REQUEST);
    }

    let secret = generate_secret();
    let full_token = format!("{TOKEN_PREFIX}{secret}");
    let prefix = secret[..TOKEN_PREFIX_DISPLAY_LEN].to_string();
    let hash = hash_password(&full_token).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let label = body.label.unwrap_or_else(|| "agent".into());

    let row = agent_tokens::insert_token(
        &state.pools.app,
        dashboard.org_id,
        dashboard.user_id,
        &label,
        &prefix,
        &hash,
        &scopes,
    )
    .await
    .map_err(|err| {
        if err
            .as_database_error()
            .and_then(|db| db.code())
            .is_some_and(|code| code == "23505")
        {
            StatusCode::CONFLICT
        } else {
            StatusCode::INTERNAL_SERVER_ERROR
        }
    })?;

    Ok((
        StatusCode::CREATED,
        Json(CreateResponse {
            token: CreatedAgentToken {
                id: row.id,
                label: row.label,
                token: full_token,
                token_prefix: row.token_prefix,
                scopes: row.scopes,
                created_at: row.created_at,
            },
        }),
    ))
}

async fn revoke_token(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;
    let revoked = agent_tokens::revoke_token(&state.pools.app, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if revoked {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}
