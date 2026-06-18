use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, patch, post},
    Extension, Json, Router,
};
use epure_auth::DashboardSession;
use epure_storage::events;
use epure_storage::issues::{self, IssueListFilter, IssueSummary, SnoozeMode, UpdateIssueParams};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/issues", get(list_issues))
        .route("/issues/trends", post(issue_trends))
        .route("/issues/bulk", patch(bulk_update).delete(bulk_delete))
        .route("/issues/merge", post(merge_issues_handler))
        .route("/issues/split", post(split_issues_handler))
        .route("/issues/{id}/merged", get(list_merged_children_handler))
        .route("/issues/{id}", patch(patch_issue))
        .route("/issues/{id}/snooze", post(snooze_issue))
        .with_state(state)
}

#[derive(Deserialize)]
struct ListQuery {
    q: Option<String>,
    project_id: Option<Uuid>,
    window: Option<String>,
    sort: Option<String>,
}

#[derive(Serialize)]
struct IssuesResponse {
    issues: Vec<IssueSummary>,
}

#[derive(Deserialize)]
struct IssueTrendsBody {
    issue_ids: Vec<Uuid>,
}

#[derive(Serialize)]
struct IssueTrendsResponse {
    trends: Vec<events::IssueListTrend>,
}

#[derive(Deserialize)]
struct PatchIssueBody {
    status: Option<String>,
    resolved_in_release: Option<String>,
}

#[derive(Deserialize)]
struct SnoozeBody {
    mode: String,
}

#[derive(Deserialize)]
struct BulkBody {
    ids: Vec<Uuid>,
    action: String,
}

#[derive(Serialize)]
struct BulkResponse {
    updated: u64,
}

#[derive(Deserialize)]
struct MergeBody {
    canonical_id: Uuid,
    merge_ids: Vec<Uuid>,
}

#[derive(Deserialize)]
struct SplitBody {
    canonical_id: Uuid,
    split_ids: Vec<Uuid>,
}

fn parse_issue_query(raw: &str) -> IssueListFilter {
    let mut filter = IssueListFilter::default();
    let mut free_text: Vec<String> = Vec::new();

    for token in raw.split_whitespace() {
        if let Some(value) = token.strip_prefix("is:") {
            if value == "snoozed" {
                filter.snoozed = Some(true);
            } else {
                filter.status = Some(normalize_status(value));
            }
        } else if let Some(value) = token.strip_prefix("env:") {
            filter.environment = Some(value.to_string());
        } else if let Some(value) = token.strip_prefix("release:") {
            filter.release = Some(value.to_string());
        } else if let Some(value) = token.strip_prefix("user.email:") {
            filter.user_email_pattern = Some(value.to_string());
        } else if let Some(value) = token.strip_prefix("level:") {
            filter.level = Some(value.to_string());
        } else {
            free_text.push(token.to_string());
        }
    }

    if !free_text.is_empty() {
        filter.free_text = Some(free_text.join(" "));
    }

    filter
}

fn normalize_status(value: &str) -> String {
    match value {
        "unresolved" | "open" => "unresolved".to_string(),
        "resolved" => "resolved".to_string(),
        "ignored" => "ignored".to_string(),
        "regression" => "regression".to_string(),
        other => other.to_string(),
    }
}

fn validate_status(status: &str) -> bool {
    matches!(
        status,
        "unresolved" | "resolved" | "ignored" | "regression"
    )
}

async fn issue_trends(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Json(body): Json<IssueTrendsBody>,
) -> Result<impl IntoResponse, StatusCode> {
    if body.issue_ids.is_empty() {
        return Ok(Json(IssueTrendsResponse { trends: Vec::new() }));
    }
    if body.issue_ids.len() > 200 {
        return Err(StatusCode::BAD_REQUEST);
    }

    let trends = events::list_issue_trends(
        &state.pools.app,
        dashboard.org_id,
        &body.issue_ids,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(IssueTrendsResponse { trends }))
}

async fn list_issues(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Query(query): Query<ListQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let mut filter = parse_issue_query(query.q.as_deref().unwrap_or_default());
    if let Some(project_id) = query.project_id {
        filter.project_id = Some(project_id);
    }
    filter.time_window = Some(issues::TimeWindow::parse(query.window.as_deref()));
    filter.sort = Some(issues::IssueSort::parse(query.sort.as_deref()));
    let rows = issues::list_issues_filtered(&state.pools.app, dashboard.org_id, filter)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(IssuesResponse { issues: rows }))
}

async fn patch_issue(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
    Json(body): Json<PatchIssueBody>,
) -> Result<impl IntoResponse, StatusCode> {
    if let Some(status) = &body.status {
        if !validate_status(status) {
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

async fn bulk_update(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Json(body): Json<BulkBody>,
) -> Result<impl IntoResponse, StatusCode> {
    let status = match body.action.as_str() {
        "resolve" => "resolved",
        "ignore" => "ignored",
        "reopen" => "unresolved",
        other if validate_status(other) => other,
        _ => return Err(StatusCode::BAD_REQUEST),
    };

    let updated = issues::bulk_update_status(
        &state.pools.app,
        dashboard.org_id,
        &body.ids,
        status,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(BulkResponse { updated }))
}

async fn bulk_delete(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Json(body): Json<BulkBody>,
) -> Result<impl IntoResponse, StatusCode> {
    if body.action != "delete" {
        return Err(StatusCode::BAD_REQUEST);
    }

    let updated = issues::bulk_delete_issues(&state.pools.app, dashboard.org_id, &body.ids)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(BulkResponse { updated }))
}

async fn merge_issues_handler(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Json(body): Json<MergeBody>,
) -> Result<impl IntoResponse, StatusCode> {
    if body.merge_ids.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let merged = issues::merge_issues(
        &state.pools.app,
        dashboard.org_id,
        body.canonical_id,
        &body.merge_ids,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(BulkResponse { updated: merged }))
}

async fn list_merged_children_handler(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let rows = issues::list_merged_children(&state.pools.app, dashboard.org_id, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(IssuesResponse { issues: rows }))
}

async fn split_issues_handler(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Json(body): Json<SplitBody>,
) -> Result<impl IntoResponse, StatusCode> {
    if body.split_ids.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let split = issues::split_issues(
        &state.pools.app,
        dashboard.org_id,
        body.canonical_id,
        &body.split_ids,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(BulkResponse { updated: split }))
}
