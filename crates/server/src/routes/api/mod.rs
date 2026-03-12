use std::sync::Arc;

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    Json, Router,
};
use epure_auth::{load_dashboard_session, DashboardSession};
use epure_storage::members as member_store;
use serde_json::json;
use tower_sessions::Session;

use crate::state::AppState;

mod alert_rules;
mod alerts;
mod auth;
mod dsn_keys;
mod events;
mod issues;
mod members;
mod projects;
mod rbac;
mod releases;
mod setup;
mod stats;
mod webhooks;

pub fn router(state: Arc<AppState>) -> Router {
    let public = Router::new().nest("/auth", auth::router(state.clone()));

    let protected = Router::new()
        .merge(issues::router(state.clone()))
        .merge(events::router(state.clone()))
        .merge(releases::router(state.clone()))
        .merge(alerts::router(state.clone()))
        .merge(alert_rules::router(state.clone()))
        .merge(webhooks::router(state.clone()))
        .merge(projects::router(state.clone()))
        .merge(dsn_keys::router(state.clone()))
        .merge(members::router(state.clone()))
        .merge(setup::router(state.clone()))
        .merge(stats::router(state.clone()))
        .route_layer(axum::middleware::from_fn_with_state(
            state.clone(),
            require_dashboard_session,
        ));

    Router::new().nest("/api/v1", public.merge(protected))
}

async fn require_dashboard_session(
    State(state): State<Arc<AppState>>,
    session: Session,
    mut request: Request,
    next: Next,
) -> Response {
    match load_dashboard_session(&session).await {
        Ok(dashboard) => {
            epure_storage::rls::with_request_user(dashboard.user_id, async move {
                let refreshed = match refresh_dashboard_session(&state, &dashboard).await {
                    Ok(session) => session,
                    Err(status) => {
                        return (status, Json(json!({ "error": "unauthenticated" })))
                            .into_response();
                    }
                };
                request.extensions_mut().insert(refreshed);
                next.run(request).await
            })
            .await
        }
        Err(_) => (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "unauthenticated" })),
        )
            .into_response(),
    }
}

async fn refresh_dashboard_session(
    state: &AppState,
    dashboard: &DashboardSession,
) -> Result<DashboardSession, StatusCode> {
    let role = member_store::get_member_role(&state.pools.app, dashboard.org_id, dashboard.user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

    Ok(DashboardSession {
        user_id: dashboard.user_id,
        org_id: dashboard.org_id,
        email: dashboard.email.clone(),
        role,
    })
}
