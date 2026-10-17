use std::sync::Arc;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Extension, Json, Router,
};
use chrono::{DateTime, Timelike, Utc};
use epure_auth::DashboardSession;
use epure_envelope::{parse_envelope, EnvelopeError};
use epure_storage::setup::{PatchSetupProgress, SetupProgressRow};
use epure_storage::{dsn_keys, projects, setup};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::state::AppState;

const TEST_ENVELOPE: &[u8] = include_bytes!("../../../../../fixtures/sentry/browser/envelope.txt");

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/setup", get(get_setup).patch(patch_setup))
        .route("/setup/dsn", get(get_setup_dsn))
        .route("/setup/test-event", post(post_test_event))
        .with_state(state)
}

#[derive(Deserialize)]
struct SetupQuery {
    project_id: Uuid,
}

#[derive(Serialize)]
struct SetupProgressResponse {
    user_id: Uuid,
    org_id: Uuid,
    project_id: Uuid,
    project_named: bool,
    has_active_key: bool,
    dsn_copied_at: Option<DateTime<Utc>>,
    first_issue_seen_at: Option<DateTime<Utc>>,
    completed_at: Option<DateTime<Utc>>,
    complete: bool,
    seeded: bool,
}

#[derive(Serialize)]
struct SetupDsnResponse {
    project_id: Uuid,
    dsn_project_id: i64,
    public_key: Option<String>,
    has_active_key: bool,
}

#[derive(Serialize)]
struct TestEventResponse {
    event_id: Uuid,
    accepted: bool,
}

#[derive(Deserialize)]
struct PatchSetupBody {
    project_id: Uuid,
    project_named: Option<bool>,
    dsn_copied: Option<bool>,
    first_issue_seen: Option<bool>,
}

async fn to_response(
    state: &AppState,
    org_id: Uuid,
    row: SetupProgressRow,
) -> Result<SetupProgressResponse, StatusCode> {
    let has_active_key =
        dsn_keys::first_active_public_key(&state.pools.app, org_id, row.project_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .is_some();

    Ok(SetupProgressResponse {
        user_id: row.user_id,
        org_id: row.org_id,
        project_id: row.project_id,
        project_named: row.project_named,
        has_active_key,
        dsn_copied_at: row.dsn_copied_at,
        first_issue_seen_at: row.first_issue_seen_at,
        completed_at: row.completed_at,
        complete: row.completed_at.is_some(),
        seeded: setup::project_is_demo(&state.pools.app, org_id, row.project_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
    })
}

async fn ensure_project(
    state: &AppState,
    org_id: Uuid,
    project_id: Uuid,
) -> Result<projects::ProjectRow, StatusCode> {
    projects::get_project(&state.pools.app, org_id, project_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)
}

async fn get_setup(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Query(query): Query<SetupQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let _project = ensure_project(&state, dashboard.org_id, query.project_id).await?;

    let row = setup::get_setup_progress(
        &state.pools.app,
        dashboard.org_id,
        dashboard.user_id,
        query.project_id,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(to_response(&state, dashboard.org_id, row).await?))
}

async fn get_setup_dsn(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Query(query): Query<SetupQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let project = ensure_project(&state, dashboard.org_id, query.project_id).await?;

    let public_key =
        dsn_keys::first_active_public_key(&state.pools.app, dashboard.org_id, query.project_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(SetupDsnResponse {
        project_id: query.project_id,
        dsn_project_id: project.dsn_project_id,
        has_active_key: public_key.is_some(),
        public_key,
    }))
}

async fn post_test_event(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Query(query): Query<SetupQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let _project = ensure_project(&state, dashboard.org_id, query.project_id).await?;

    let public_key =
        dsn_keys::first_active_public_key(&state.pools.app, dashboard.org_id, query.project_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if public_key.is_none() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let parsed = match parse_envelope(TEST_ENVELOPE) {
        Ok(parsed) => parsed,
        Err(EnvelopeError::NoEvent) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let payload = epure_envelope::decompress_store_payload(&parsed.event_payload)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut payload_json: Value =
        serde_json::from_slice(&payload).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let now = Utc::now();
    let fingerprint = epure_envelope::compute_fingerprint(&payload_json);
    epure_envelope::scrub_event(&mut payload_json);
    let breadcrumbs = epure_envelope::extract_breadcrumbs(&payload_json);
    let breadcrumbs_json = epure_envelope::breadcrumbs_to_json(&breadcrumbs);
    let metadata =
        epure_envelope::normalize_metadata(&payload_json, Some("epure-setup-test"), None, None);
    let release = payload_json
        .get("release")
        .and_then(Value::as_str)
        .map(str::to_string);
    let user_key = epure_storage::unique_users::user_key(
        metadata.user_id.as_deref(),
        metadata.user_email.as_deref(),
    );
    let event_id = Uuid::new_v4();

    let window_start = now
        .date_naive()
        .and_hms_opt(now.hour(), 0, 0)
        .map(|dt| DateTime::<Utc>::from_naive_utc_and_offset(dt, Utc))
        .unwrap_or(now);

    epure_storage::persist::persist_store_event(
        &state.pools.ingest,
        epure_storage::persist::PersistStoreEvent {
            upsert: epure_storage::issues::UpsertIssueParams {
                org_id: dashboard.org_id,
                project_id: query.project_id,
                fingerprint: fingerprint.clone(),
                title: epure_storage::issues::title_from_event(&payload_json),
                level: payload_json
                    .get("level")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                environment: metadata.environment.clone(),
                release: release.clone(),
                occurred_at: now,
                increment_by: 1,
            },
            event: epure_storage::events::InsertEventParams {
                id: event_id,
                org_id: dashboard.org_id,
                project_id: query.project_id,
                issue_id: Uuid::nil(),
                occurred_at: now,
                environment: metadata.environment.clone(),
                release: release.clone(),
                platform: payload_json
                    .get("platform")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                runtime_name: metadata.runtime_name.clone(),
                runtime_version: metadata.runtime_version.clone(),
                browser_name: metadata.browser_name.clone(),
                os_name: metadata.os_name.clone(),
                country_code: metadata.country_code.clone(),
                user_id: metadata.user_id.clone(),
                user_email: metadata.user_email.clone(),
                payload_json,
                stack_frames: Some(Value::Array(Vec::new())),
                breadcrumbs: Some(breadcrumbs_json),
            },
            user_key,
            counter: epure_storage::counters::SyncCounterParams {
                project_id: query.project_id,
                fingerprint,
                window_start,
                count_delta: 1,
                bodies_stored_delta: 1,
            },
        },
    )
    .await
    .map_err(|err| {
        tracing::error!("failed to persist setup test event: {err}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((
        StatusCode::ACCEPTED,
        Json(TestEventResponse {
            event_id,
            accepted: true,
        }),
    ))
}

async fn patch_setup(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Json(body): Json<PatchSetupBody>,
) -> Result<impl IntoResponse, StatusCode> {
    let _project = ensure_project(&state, dashboard.org_id, body.project_id).await?;

    if body.dsn_copied == Some(true) {
        let public_key =
            dsn_keys::first_active_public_key(&state.pools.app, dashboard.org_id, body.project_id)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        if public_key.is_none() {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    let row = setup::upsert_setup_progress(
        &state.pools.app,
        dashboard.org_id,
        dashboard.user_id,
        body.project_id,
        PatchSetupProgress {
            project_named: body.project_named,
            dsn_copied: body.dsn_copied,
            first_issue_seen: body.first_issue_seen,
        },
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(to_response(&state, dashboard.org_id, row).await?))
}
