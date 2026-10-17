pub mod api;
mod health;
mod ingest;
mod spa;

use axum::Router;
use std::sync::Arc;

use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    router_with_extensions(state, Router::new())
}

pub fn router_with_extensions(state: Arc<AppState>, extensions: Router) -> Router {
    let session_layer = state.session_layer.clone();
    Router::new()
        .merge(health::router())
        .merge(api::oauth::top_level_router(state.clone()))
        .merge(ingest::router(state.clone()))
        .merge(api::mcp::router(state.clone()))
        .merge(api::router(state))
        .merge(extensions)
        .layer(session_layer)
        .fallback(spa::spa_fallback)
}
