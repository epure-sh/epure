mod api;
mod health;
mod ingest;
mod spa;

use axum::Router;
use std::sync::Arc;

use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    let session_layer = state.session_layer.clone();
    Router::new()
        .merge(health::router())
        .merge(ingest::router(state.clone()))
        .merge(api::router(state))
        .layer(session_layer)
        .fallback(spa::spa_fallback)
}
