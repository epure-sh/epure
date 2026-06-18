use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, patch},
    Extension, Json, Router,
};
use chrono::{Duration, Utc};
use epure_auth::DashboardSession;
use epure_storage::members::{self, hash_invite_token, InvitationRow, MemberRow};
use rand::Rng;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::rbac::{require_min_role, validate_member_role, Role};
use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/members", get(list_members))
        .route(
            "/members/{user_id}",
            patch(update_member).delete(remove_member),
        )
        .route("/invitations", get(list_invitations).post(create_invitation))
        .route("/invitations/{id}", delete(cancel_invitation))
        .with_state(state)
}

#[derive(Serialize)]
struct MembersResponse {
    members: Vec<MemberRow>,
}

#[derive(Serialize)]
struct InvitationsResponse {
    invitations: Vec<InvitationRow>,
}

#[derive(Deserialize)]
struct InviteBody {
    email: String,
    role: String,
}

#[derive(Deserialize)]
struct UpdateMemberBody {
    role: String,
}

#[derive(Serialize)]
struct InviteResponse {
    invitation: InvitationRow,
    invite_token: String,
    message: String,
}

async fn list_members(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
) -> Result<impl IntoResponse, StatusCode> {
    let rows = members::list_members(&state.pools.app, dashboard.org_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(MembersResponse { members: rows }))
}

async fn list_invitations(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;

    let rows = members::list_invitations(&state.pools.ingest, dashboard.org_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(InvitationsResponse { invitations: rows }))
}

async fn create_invitation(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Json(body): Json<InviteBody>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;

    let email = body.email.trim().to_lowercase();
    if !email.contains('@') {
        return Err(StatusCode::BAD_REQUEST);
    }

    if !validate_member_role(&body.role) {
        return Err(StatusCode::BAD_REQUEST);
    }

    if body.role == "owner" && dashboard.role != "owner" {
        return Err(StatusCode::FORBIDDEN);
    }

    let token = generate_invite_token();
    let token_hash = hash_invite_token(&token);
    let expires_at = Utc::now() + Duration::days(7);

    let invitation = members::create_invitation(
        &state.pools.ingest,
        dashboard.org_id,
        &email,
        &body.role,
        &token_hash,
        expires_at,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((
        StatusCode::CREATED,
        Json(InviteResponse {
            invitation,
            invite_token: token,
            message: format!(
                "Invitation sent to {email}. Share the invite token so they can join your workspace."
            ),
        }),
    ))
}

async fn update_member(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(user_id): Path<Uuid>,
    Json(body): Json<UpdateMemberBody>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;

    if !validate_member_role(&body.role) {
        return Err(StatusCode::BAD_REQUEST);
    }

    if body.role == "owner" && dashboard.role != "owner" {
        return Err(StatusCode::FORBIDDEN);
    }

    if user_id == dashboard.user_id {
        return Err(StatusCode::BAD_REQUEST);
    }

    let target_role = members::get_member_role(&state.pools.app, dashboard.org_id, user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if target_role == "owner" && dashboard.role != "owner" {
        return Err(StatusCode::FORBIDDEN);
    }

    if target_role == "admin" && dashboard.role != "owner" {
        return Err(StatusCode::FORBIDDEN);
    }

    if target_role == "owner" && body.role != "owner" {
        let owners = members::count_owners(&state.pools.app, dashboard.org_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        if owners <= 1 {
            return Err(StatusCode::CONFLICT);
        }
    }

    let updated = members::update_member_role(
        &state.pools.app,
        dashboard.org_id,
        user_id,
        &body.role,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !updated {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(serde_json::json!({ "updated": true })))
}

async fn remove_member(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(user_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;

    if user_id == dashboard.user_id {
        return Err(StatusCode::BAD_REQUEST);
    }

    let target_role = members::get_member_role(&state.pools.app, dashboard.org_id, user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if target_role == "owner" {
        let owners = members::count_owners(&state.pools.app, dashboard.org_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        if owners <= 1 {
            return Err(StatusCode::CONFLICT);
        }
        if dashboard.role != "owner" {
            return Err(StatusCode::FORBIDDEN);
        }
    }

    if target_role == "admin" && dashboard.role != "owner" {
        return Err(StatusCode::FORBIDDEN);
    }

    let deleted = members::remove_member(&state.pools.app, dashboard.org_id, user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !deleted {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(serde_json::json!({ "deleted": true })))
}

async fn cancel_invitation(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    require_min_role(&dashboard, Role::Admin)?;

    let deleted = members::delete_invitation(&state.pools.ingest, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !deleted {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(serde_json::json!({ "deleted": true })))
}

fn generate_invite_token() -> String {
    let mut rng = rand::rng();
    (0..32)
        .map(|_| {
            const CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyz0123456789";
            CHARSET[rng.random_range(0..CHARSET.len())] as char
        })
        .collect()
}

