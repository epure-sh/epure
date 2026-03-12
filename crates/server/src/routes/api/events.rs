use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Extension, Json, Router,
};
use epure_auth::DashboardSession;
use epure_storage::events::{self, EventDetail, TimelineBucketSize, TimelineWindow};
use epure_storage::user_feedback;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/issues/{issue_id}/events", get(list_events))
        .route("/issues/{issue_id}/releases", get(list_releases))
        .route("/issues/{issue_id}/timeline", get(issue_timeline))
        .route("/events/{event_id}/feedback", get(event_feedback))
        .with_state(state)
}

#[derive(Deserialize)]
struct EventsQuery {
    limit: Option<i64>,
    offset: Option<i64>,
    release: Option<String>,
}

#[derive(Serialize)]
struct EventsResponse {
    events: Vec<EventDetail>,
    total: i64,
    has_more: bool,
}

#[derive(Serialize)]
struct ReleasesResponse {
    releases: Vec<String>,
}

#[derive(Deserialize)]
struct TimelineQuery {
    window: Option<String>,
    #[allow(dead_code)]
    bucket: Option<String>,
}

async fn list_events(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(issue_id): Path<Uuid>,
    Query(query): Query<EventsQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let offset = query.offset.unwrap_or(0).max(0);
    let total = events::count_events_for_issue(
        &state.pools.app,
        dashboard.org_id,
        issue_id,
        query.release.as_deref(),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let rows = events::list_events_for_issue(
        &state.pools.app,
        dashboard.org_id,
        issue_id,
        limit,
        offset,
        query.release.as_deref(),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let has_more = offset + (rows.len() as i64) < total;

    Ok(Json(EventsResponse {
        events: rows,
        total,
        has_more,
    }))
}

async fn list_releases(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(issue_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let rows = events::list_releases_for_issue(&state.pools.app, dashboard.org_id, issue_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ReleasesResponse { releases: rows }))
}

async fn issue_timeline(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(issue_id): Path<Uuid>,
    Query(query): Query<TimelineQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let window = TimelineWindow::parse(query.window.as_deref());
    let bucket = match window {
        TimelineWindow::Days7 => TimelineBucketSize::Hour,
        TimelineWindow::Days14 | TimelineWindow::Days30 | TimelineWindow::All => {
            TimelineBucketSize::Day
        }
    };

    let timeline =
        events::issue_timeline(&state.pools.app, dashboard.org_id, issue_id, window, bucket)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(timeline))
}

async fn event_feedback(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(event_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let row = user_feedback::feedback_for_event(&state.pools.app, dashboard.org_id, event_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(row))
}
