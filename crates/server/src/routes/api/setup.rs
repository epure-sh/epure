use std::sync::Arc;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Extension, Json, Router,
};
use chrono::{DateTime, Utc};
use epure_auth::DashboardSession;
use epure_envelope::{parse_envelope, preview_fingerprint, EnvelopeError};
use epure_storage::setup::{PatchSetupProgress, SetupProgressRow};
use epure_storage::{dsn_keys, projects, setup};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::pipeline::mpsc::IngestJob;
use crate::pipeline::spike::SpikeDecision;
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
) -> Result<(), StatusCode> {
    let project = projects::get_project(&state.pools.app, org_id, project_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if project.is_none() {
        return Err(StatusCode::NOT_FOUND);
    }
    Ok(())
}

async fn get_setup(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Query(query): Query<SetupQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    ensure_project(&state, dashboard.org_id, query.project_id).await?;

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
    ensure_project(&state, dashboard.org_id, query.project_id).await?;

    let public_key =
        dsn_keys::first_active_public_key(&state.pools.app, dashboard.org_id, query.project_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(SetupDsnResponse {
        project_id: query.project_id,
        has_active_key: public_key.is_some(),
        public_key,
    }))
}

async fn post_test_event(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Query(query): Query<SetupQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    ensure_project(&state, dashboard.org_id, query.project_id).await?;

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

    let fingerprint = preview_fingerprint(&parsed.event_payload);
    let event_id = Uuid::new_v4();

    let job = match state.spike_valve.check(&fingerprint) {
        SpikeDecision::AllowStore => IngestJob::StoreEvent {
            event_id,
            project_id: query.project_id,
            org_id: dashboard.org_id,
            fingerprint,
            payload: parsed.event_payload,
            user_agent: Some("epure-setup-test".to_string()),
            client_ip: None,
            country_code_hint: None,
        },
        SpikeDecision::CounterOnly => IngestJob::CounterOnly {
            project_id: query.project_id,
            org_id: dashboard.org_id,
            fingerprint,
        },
    };

    if state.ingest_tx.send(job).await.is_err() {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }

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
    ensure_project(&state, dashboard.org_id, body.project_id).await?;

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
