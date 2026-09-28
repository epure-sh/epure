use std::sync::Arc;

use axum::{
    extract::{ConnectInfo, Request, State},
    http::{header, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json, Router,
};
use epure_auth::{
    authenticate_agent_token, load_dashboard_session, ApiPatAuth, DashboardSession,
};
use epure_storage::members as member_store;
use serde_json::json;
use tower_sessions::Session;

use crate::rate_limit;
use crate::state::AppState;

mod agent;
mod agent_tokens;
mod alert_rules;
mod alerts;
mod auth;
mod dsn_keys;
mod events;
mod issues;
mod members;
mod pat_scopes;
mod projects;
mod rbac;
mod releases;
mod setup;
mod stats;
mod webhooks;

pub fn router(state: Arc<AppState>) -> Router {
    let public = Router::new().nest("/auth", auth::router(state.clone()));

    let protected = Router::new()
        .merge(Router::new().nest("/agent", agent::router(state.clone())))
        .merge(agent_tokens::router(state.clone()))
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
        .route_layer(axum::middleware::from_fn(rate_limit::agent_rate_limit))
        .route_layer(axum::middleware::from_fn_with_state(
            state.clone(),
            require_api_auth,
        ));

    Router::new().nest("/api/v1", public.merge(protected))
}

fn bearer_token(request: &Request) -> Option<&str> {
    request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(str::trim)
        .filter(|token| !token.is_empty())
}

async fn require_api_auth(
    State(state): State<Arc<AppState>>,
    session: Session,
    ConnectInfo(addr): ConnectInfo<std::net::SocketAddr>,
    mut request: Request,
    next: Next,
) -> Response {
    if let Some(token) = bearer_token(&request).map(str::to_string) {
        if epure_storage::agent_tokens::parse_token_prefix(&token).is_some() {
            return authenticate_pat(&state, &token, addr, request, next).await;
        }
    }

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

async fn authenticate_pat(
    state: &AppState,
    token: &str,
    _addr: std::net::SocketAddr,
    mut request: Request,
    next: Next,
) -> Response {
    let agent = match authenticate_agent_token(&state.pools.app, token).await {
        Ok(agent) => agent,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "unauthenticated" })),
            )
                .into_response();
        }
    };

    let path = request.uri().path().to_string();
    if let Some(status) =
        pat_scopes::pat_missing_scopes(request.method(), &path, &agent.scopes)
    {
        return (
            status,
            Json(json!({ "error": "forbidden" })),
        )
            .into_response();
    }

    let dashboard = pat_scopes::session_from_pat(&agent, String::new());
    let pat = ApiPatAuth {
        token_id: agent.token_id,
        scopes: agent.scopes,
    };

    epure_storage::rls::with_request_user(agent.user_id, async move {
        request.extensions_mut().insert(dashboard);
        request.extensions_mut().insert(pat);
        next.run(request).await
    })
    .await
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
