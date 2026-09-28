mod parse;

use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Extension, Json, Router,
};
use epure_agent_context::{build_context, render_markdown, IssueSnapshot, RenderOptions};
use epure_auth::{ApiPatAuth, DashboardSession};
use epure_storage::agent_queue::{self, AgentQueueParams, AGENT_QUEUE_DEFAULT, AGENT_QUEUE_MAX};
use epure_storage::alerts::{self, AlertListFilter};
use epure_storage::events;
use epure_storage::issues::{self, IssueSummary, SnoozeMode, TimeWindow, UpdateIssueParams};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/queue", get(queue))
        .route(
            "/issues/{id}",
            get(get_issue).patch(patch_issue),
        )
        .route("/issues/{id}/context", get(issue_context))
        .route("/issues/{id}/snooze", post(snooze_issue))
        .route("/alerts", get(list_alerts))
        .route("/whoami", get(whoami))
        .with_state(state)
}

#[derive(Deserialize)]
struct QueueQuery {
    project_id: Option<Uuid>,
    environment: Option<String>,
    q: Option<String>,
    limit: Option<i64>,
    window: Option<String>,
}

#[derive(Serialize)]
struct QueueResponse {
    queue: Vec<agent_queue::QueuedIssue>,
}

async fn queue(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Query(query): Query<QueueQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let window = TimeWindow::parse(query.window.as_deref());
    let mut filter = parse::parse_issue_query(query.q.as_deref().unwrap_or_default());
    if filter.time_window.is_none() {
        filter.time_window = Some(window);
    }
    let limit = query.limit.unwrap_or(AGENT_QUEUE_DEFAULT).clamp(1, AGENT_QUEUE_MAX);

    let rows = agent_queue::build_agent_queue(
        &state.pools.app,
        dashboard.org_id,
        AgentQueueParams {
            project_id: query.project_id,
            environment: query.environment,
            query_filter: filter,
            limit,
            user_id: dashboard.user_id,
        },
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(QueueResponse { queue: rows }))
}

async fn get_issue(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let row = issues::get_issue_summary_by_id(&state.pools.app, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    Ok(Json(row))
}

#[derive(Deserialize)]
struct ContextQuery {
    format: Option<String>,
    event: Option<String>,
    include_payload: Option<bool>,
    include_user: Option<bool>,
}

async fn issue_context(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
    Query(query): Query<ContextQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let issue = issues::get_issue_summary_by_id(&state.pools.app, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let event = resolve_event(&state, dashboard.org_id, id, query.event.as_deref()).await?;

    let options = RenderOptions {
        include_payload: query.include_payload.unwrap_or(false),
        include_user: query.include_user.unwrap_or(false),
    };

    let ctx = build_context_from_rows(issue, event, options);

    if query.format.as_deref() == Some("markdown") {
        return Ok((
            [(axum::http::header::CONTENT_TYPE, "text/markdown; charset=utf-8")],
            render_markdown(&ctx),
        )
            .into_response());
    }

    Ok(Json(ctx).into_response())
}

async fn resolve_event(
    state: &AppState,
    org_id: Uuid,
    issue_id: Uuid,
    event: Option<&str>,
) -> Result<Option<events::EventDetail>, StatusCode> {
    match event {
        Some("latest") | None => events::latest_event_for_issue(&state.pools.app, org_id, issue_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR),
        Some(raw) => {
            let event_id = Uuid::parse_str(raw).map_err(|_| StatusCode::BAD_REQUEST)?;
            let row = events::get_event_by_id(&state.pools.app, org_id, event_id)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            match row {
                Some(detail) if detail.issue_id == issue_id => Ok(Some(detail)),
                Some(_) => Err(StatusCode::BAD_REQUEST),
                None => Err(StatusCode::NOT_FOUND),
            }
        }
    }
}

fn build_context_from_rows(
    issue: IssueSummary,
    event: Option<events::EventDetail>,
    options: RenderOptions,
) -> epure_agent_context::AgentContextJson {
    let snap = issue_snapshot(&issue);
    let event_tuple = event.map(|ev| {
        let payload = ev.payload_json.clone();
        let stack = ev.stack_frames.clone();
        let crumbs = ev.breadcrumbs.clone();
        let event_snap = epure_agent_context::EventSnapshot {
            id: ev.id,
            occurred_at: ev.occurred_at,
            environment: ev.environment,
            release: ev.release,
            platform: ev.platform,
            runtime_name: ev.runtime_name,
            runtime_version: ev.runtime_version,
            browser_name: ev.browser_name,
            os_name: ev.os_name,
            user_id: ev.user_id,
            user_email: ev.user_email,
        };
        (event_snap, payload, stack, crumbs)
    });
    build_context(snap, event_tuple, options)
}

fn issue_snapshot(issue: &IssueSummary) -> IssueSnapshot {
    IssueSnapshot {
        id: issue.id,
        title: issue.title.clone(),
        status: issue.status.clone(),
        level: issue.level.clone(),
        event_count: issue.event_count,
        unique_user_count: issue.unique_user_count,
        environment: issue.environment.clone(),
        release: issue.release.clone(),
        first_seen_at: issue.first_seen_at,
        last_seen_at: issue.last_seen_at,
        resolved_in_release: issue.resolved_in_release.clone(),
        snoozed: issue.snoozed,
        snooze_until: issue.snooze_until,
        snooze_until_count: issue.snooze_until_count,
        snooze_until_users: issue.snooze_until_users,
    }
}

#[derive(Deserialize)]
struct PatchIssueBody {
    status: Option<String>,
    resolved_in_release: Option<String>,
}

async fn patch_issue(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
    Json(body): Json<PatchIssueBody>,
) -> Result<impl IntoResponse, StatusCode> {

    if let Some(status) = &body.status {
        if !matches!(
            status.as_str(),
            "unresolved" | "resolved" | "ignored" | "regression"
        ) {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    if body.status.is_none() && body.resolved_in_release.is_none() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let row = issues::update_issue(
        &state.pools.app,
        dashboard.org_id,
        id,
        UpdateIssueParams {
            status: body.status,
            resolved_in_release: body.resolved_in_release,
        },
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(row))
}

#[derive(Deserialize)]
struct SnoozeBody {
    mode: String,
}

async fn snooze_issue(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
    Json(body): Json<SnoozeBody>,
) -> Result<impl IntoResponse, StatusCode> {

    let mode = match body.mode.as_str() {
        "hours" | "4h" => SnoozeMode::Hours4,
        "occurrences" | "100" => SnoozeMode::Occurrences100,
        "users" | "10" => SnoozeMode::Users10,
        _ => return Err(StatusCode::BAD_REQUEST),
    };

    let row = issues::apply_snooze(&state.pools.app, dashboard.org_id, id, mode)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(row))
}

#[derive(Deserialize)]
struct AlertsQuery {
    limit: Option<i64>,
    project_id: Option<Uuid>,
    environment: Option<String>,
    view: Option<String>,
}

#[derive(Serialize)]
struct AlertsResponse {
    alerts: Vec<alerts::AlertRow>,
}

async fn list_alerts(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Query(query): Query<AlertsQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let rows = alerts::list_alerts(
        &state.pools.app,
        dashboard.org_id,
        dashboard.user_id,
        limit,
        query.project_id,
        query.environment.as_deref(),
        AlertListFilter::parse(query.view.as_deref()),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(AlertsResponse { alerts: rows }))
}

#[derive(Serialize)]
struct WhoamiResponse {
    org_id: String,
    user_id: String,
    role: String,
    scopes: Vec<String>,
}

async fn whoami(
    Extension(dashboard): Extension<DashboardSession>,
    pat: Option<Extension<ApiPatAuth>>,
) -> impl IntoResponse {
    let scopes = pat
        .map(|p| p.scopes.clone())
        .unwrap_or_else(|| vec!["session".into()]);
    Json(WhoamiResponse {
        org_id: dashboard.org_id.to_string(),
        user_id: dashboard.user_id.to_string(),
        role: dashboard.role,
        scopes,
    })
}
