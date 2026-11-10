use axum::{
    body::Bytes,
    extract::{
        multipart::{Field, MultipartError},
        ConnectInfo, DefaultBodyLimit, Multipart, Path, Query, State,
    },
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{options, post},
    Json, Router,
};
use epure_auth::{DsnAuthError, DsnRecord};
use epure_core::entitlement::InactiveReason;
use epure_envelope::{
    client_event_id, match_noise, outcome_reason, parse_auth, parse_envelope, parse_store_payload,
    preview_multi_fingerprint, scrub_string, AuthError, EnvelopeError, StoreError,
};
use epure_storage::{alerts, projects, releases, user_feedback};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tower_http::limit::RequestBodyLimitLayer;
use uuid::Uuid;

use crate::pipeline::ingest_cap::IngestAllowance;
use crate::pipeline::ingest_plan_limit::QuotaDecision;
use crate::pipeline::mpsc::IngestJob;
use crate::pipeline::spike::{GroupedSpikeInput, SpikeDecision};
use crate::state::AppState;

const BODY_LIMIT: usize = 2 * 1024 * 1024;
const MAX_RELEASE_FILE_BYTES: usize = 32 * 1024 * 1024;
const RELEASE_FILE_BODY_LIMIT: usize = MAX_RELEASE_FILE_BYTES + 64 * 1024;
const MAX_ARTIFACT_NAME_BYTES: usize = 4096;
const RELEASE_FILE_CONCURRENCY: usize = 2;

pub fn router(state: Arc<AppState>) -> Router {
    let event_routes = Router::new()
        .route("/api/{project_id}/envelope/", options(cors_preflight))
        .route("/api/{project_id}/envelope/", post(post_envelope))
        .route("/api/{project_id}/envelope", options(cors_preflight))
        .route("/api/{project_id}/envelope", post(post_envelope))
        .route("/api/{project_id}/store/", options(cors_preflight))
        .route("/api/{project_id}/store/", post(post_store))
        .route("/api/{project_id}/user-feedback/", options(cors_preflight))
        .route("/api/{project_id}/user-feedback/", post(post_user_feedback))
        .layer(RequestBodyLimitLayer::new(BODY_LIMIT))
        .layer(tower::limit::ConcurrencyLimitLayer::new(16));

    // Public DSN auth. Stream to disk and keep this off the ingest limiter so a
    // 32 MiB map cannot pin error ingest or hold 16 copies in memory.
    let release_file_routes = Router::new()
        .route(
            "/api/{project_id}/releases/{version}/files/",
            options(cors_preflight),
        )
        .route(
            "/api/{project_id}/releases/{version}/files/",
            post(post_release_files).layer(DefaultBodyLimit::max(RELEASE_FILE_BODY_LIMIT)),
        )
        .layer(RequestBodyLimitLayer::new(RELEASE_FILE_BODY_LIMIT))
        .layer(tower::limit::ConcurrencyLimitLayer::new(
            RELEASE_FILE_CONCURRENCY,
        ));

    event_routes.merge(release_file_routes).with_state(state)
}

#[derive(Debug, Deserialize)]
struct IngestQuery {
    sentry_key: Option<String>,
    sentry_secret: Option<String>,
}

#[derive(Debug, Serialize)]
struct IngestAccepted {
    id: Uuid,
}

#[derive(Debug, Serialize)]
struct ReleaseFileAccepted {
    id: Uuid,
    name: String,
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: &'static str,
    message: &'static str,
}

#[derive(Debug, Deserialize)]
struct UserFeedbackBody {
    event_id: Uuid,
    name: Option<String>,
    email: Option<String>,
    comments: Option<String>,
}

#[derive(Debug, Serialize)]
struct UserFeedbackAccepted {
    id: Uuid,
}

async fn cors_preflight(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    cors_response(&state, &headers, StatusCode::NO_CONTENT)
}

async fn post_envelope(
    State(state): State<Arc<AppState>>,
    ConnectInfo(_addr): ConnectInfo<SocketAddr>,
    Path(raw_project_id): Path<String>,
    Query(query): Query<IngestQuery>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let project_id = match resolve_ingest_project_id(&state, &raw_project_id).await {
        Ok(id) => id,
        Err(response) => return response,
    };

    let auth = match extract_auth(&headers, &query) {
        Ok(auth) => auth,
        Err(_) => {
            return error_response(
                StatusCode::UNAUTHORIZED,
                "invalid_dsn",
                "DSN authentication failed",
            )
        }
    };

    let record = match validate_dsn(&state, &auth, project_id).await {
        Ok(record) => record,
        Err(response) => return response,
    };

    let parsed = match parse_envelope(&body) {
        Ok(parsed) => parsed,
        Err(EnvelopeError::NonErrorAbsorbed) => {
            return cors_response(&state, &headers, StatusCode::ACCEPTED);
        }
        Err(EnvelopeError::NoEvent) => {
            return error_response(
                StatusCode::BAD_REQUEST,
                "invalid_envelope",
                "No event item found in envelope",
            )
        }
        Err(EnvelopeError::DecompressFailed) => {
            return error_response(
                StatusCode::BAD_REQUEST,
                "invalid_envelope",
                "Envelope decompression failed",
            )
        }
        Err(_) => {
            return error_response(
                StatusCode::BAD_REQUEST,
                "invalid_envelope",
                "Malformed envelope payload",
            )
        }
    };

    record_client_discards(&state, record.org_id, project_id, &parsed.client_discards);

    if !parsed.sessions.is_empty() {
        let local = crate::pipeline::spike::SpikeValve::default();
        for item in &parsed.sessions {
            local.record_session_agg(record.org_id, project_id, item);
        }
        if epure_storage::persist::flush_all_telemetry_deltas(
            &state.pools.ingest,
            &local.take_telemetry_deltas(),
        )
        .await
        .is_err()
        {
            return error_response(
                StatusCode::SERVICE_UNAVAILABLE,
                "session_storage_unavailable",
                "Session data could not be committed; retry",
            );
        }
    }

    if !parsed.check_ins.is_empty() {
        if let Err(response) = check_ingest_plan_limit(&state, record.org_id).await {
            state.outcomes.record(
                record.org_id,
                project_id,
                "plan_rejected",
                parsed.check_ins.len() as u64,
            );
            return response;
        }
        let mut first_check_in_id = None;
        for ci in &parsed.check_ins {
            match state
                .ingest_plan_limit
                .monitor_allowed(
                    &state.pools.ingest,
                    record.org_id,
                    project_id,
                    &ci.monitor_slug,
                )
                .await
            {
                Ok(true) => {}
                Ok(false) => {
                    tracing::info!(org_id = %record.org_id, slug = %ci.monitor_slug, "check-in skipped: plan monitor limit reached");
                    state
                        .outcomes
                        .record(record.org_id, project_id, "monitor_limit", 1);
                    continue;
                }
                Err(_) => {
                    return error_response(
                        StatusCode::SERVICE_UNAVAILABLE,
                        "plan_lookup_unavailable",
                        "Retry this check-in; plan lookup is unavailable",
                    )
                }
            }
            let duration_ms = ci
                .duration
                .filter(|d| d.is_finite() && *d >= 0.0 && *d < 31_536_000.0)
                .map(|d| d * 1000.0);
            let check_in_id = ci
                .check_in_id
                .clone()
                .unwrap_or_else(|| Uuid::new_v4().to_string());
            if first_check_in_id.is_none() {
                first_check_in_id = Some(check_in_id.clone());
            }

            if let Err(err) = epure_storage::monitors::record_check_in(
                &state.pools.ingest,
                record.org_id,
                project_id,
                epure_storage::monitors::RecordCheckInParams {
                    slug: ci.monitor_slug.clone(),
                    check_in_id: Some(check_in_id),
                    status: ci.status.clone(),
                    duration_ms,
                    schedule: ci.schedule.clone(),
                    schedule_type: ci.schedule_type.clone(),
                    timezone: ci.timezone.clone(),
                    environment: ci.environment.clone(),
                    checkin_margin_mins: ci.checkin_margin_mins,
                    max_runtime_mins: ci.max_runtime_mins,
                    failure_issue_threshold: ci.failure_issue_threshold,
                    ..Default::default()
                },
            )
            .await
            {
                tracing::warn!("Failed to record monitor check-in: {err}");
                return error_response(
                    StatusCode::SERVICE_UNAVAILABLE,
                    "monitor_storage_unavailable",
                    "Monitor check-in could not be saved; retry the request",
                );
            }
        }

        if parsed.event_payload.is_empty() {
            let returned_id = first_check_in_id.unwrap_or_else(|| Uuid::new_v4().to_string());
            let json_body =
                serde_json::to_vec(&serde_json::json!({ "id": returned_id })).unwrap_or_default();
            let mut response = Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "application/json")
                .body(axum::body::Body::from(json_body))
                .unwrap();
            apply_cors_headers(&state, &headers, response.headers_mut());
            return response;
        }
    }

    for feedback in &parsed.user_feedback {
        let event_id = feedback
            .event_id
            .or_else(|| parsed.envelope_event_id())
            .unwrap_or_else(Uuid::new_v4);
        let email = feedback.email.as_ref().map(|value| scrub_string(value));
        if let Err(err) = epure_storage::user_feedback::insert_feedback(
            &state.pools.ingest,
            record.org_id,
            epure_storage::user_feedback::InsertFeedbackParams {
                event_id,
                project_id,
                name: feedback.name.clone(),
                email,
                comments: feedback.comments.clone(),
            },
        )
        .await
        {
            tracing::warn!("Failed to store envelope user feedback: {err}");
        }
    }

    if parsed.event_payload.is_empty() {
        return cors_response(&state, &headers, StatusCode::ACCEPTED);
    }

    let envelope_sdk = parsed.envelope_sdk().cloned();
    let mut event_payload = parsed.event_payload;
    if let Some(sdk) = envelope_sdk {
        if let Ok(mut val) = serde_json::from_slice::<serde_json::Value>(&event_payload) {
            if val.get("sdk").is_none() {
                val["sdk"] = sdk;
                if let Ok(re_encoded) = serde_json::to_vec(&val) {
                    event_payload = re_encoded;
                }
            }
        }
    }

    accept_payload(&state, &headers, project_id, record.org_id, event_payload).await
}

async fn post_release_files(
    State(state): State<Arc<AppState>>,
    Path((raw_project_id, version)): Path<(String, String)>,
    Query(query): Query<IngestQuery>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Response {
    let project_id = match resolve_ingest_project_id(&state, &raw_project_id).await {
        Ok(id) => id,
        Err(response) => return response,
    };

    let auth = match extract_auth(&headers, &query) {
        Ok(auth) => auth,
        Err(_) => {
            return error_response(
                StatusCode::UNAUTHORIZED,
                "invalid_dsn",
                "DSN authentication failed",
            )
        }
    };

    let record = match validate_dsn(&state, &auth, project_id).await {
        Ok(record) => record,
        Err(response) => return response,
    };

    if !validate_release_version(&version) {
        return error_response(
            StatusCode::BAD_REQUEST,
            "invalid_release_version",
            "Release version contains invalid path characters",
        );
    }

    let staging_dir = state
        .artifacts_dir
        .join(project_id.to_string())
        .join(&version);
    if tokio::fs::create_dir_all(&staging_dir).await.is_err() {
        return error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "storage_error",
            "Failed to create artifact directory",
        );
    }

    let mut file_name = None;
    let mut staged: Option<StagedReleaseFile> = None;

    loop {
        match multipart.next_field().await {
            Ok(Some(field)) => {
                let field_name = field.name().unwrap_or_default().to_string();
                match field_name.as_str() {
                    "name" => match read_artifact_name(field).await {
                        Ok(text) if !text.is_empty() => file_name = Some(text),
                        Ok(_) => {}
                        Err(ArtifactNameError::TooLong) => {
                            discard_staged(&mut staged).await;
                            return error_response(
                                StatusCode::BAD_REQUEST,
                                "invalid_release_file",
                                "Artifact name must be 4096 bytes or smaller",
                            );
                        }
                        Err(ArtifactNameError::TooLarge) => {
                            discard_staged(&mut staged).await;
                            return release_file_too_large();
                        }
                        Err(ArtifactNameError::Malformed) => {
                            discard_staged(&mut staged).await;
                            return malformed_release_file();
                        }
                    },
                    "file" => {
                        discard_staged(&mut staged).await;
                        let temp_path =
                            staging_dir.join(format!(".epure-upload-{}.tmp", Uuid::new_v4()));
                        match stream_release_file(field, &temp_path).await {
                            Ok(file) => staged = Some(file),
                            Err(StagedFileError::TooLarge) => return release_file_too_large(),
                            Err(StagedFileError::Empty) => {
                                return error_response(
                                    StatusCode::BAD_REQUEST,
                                    "invalid_release_file",
                                    "Release upload requires a file field",
                                )
                            }
                            Err(StagedFileError::Malformed) => return malformed_release_file(),
                            Err(StagedFileError::Storage) => {
                                return error_response(
                                    StatusCode::INTERNAL_SERVER_ERROR,
                                    "storage_error",
                                    "Failed to write artifact file",
                                )
                            }
                        }
                    }
                    _ => {
                        if let Err(err) = drain_multipart_field(field).await {
                            discard_staged(&mut staged).await;
                            return multipart_failure(err);
                        }
                    }
                }
            }
            Ok(None) => break,
            Err(err) => {
                discard_staged(&mut staged).await;
                return multipart_failure(err);
            }
        }
    }

    let Some(staged) = staged else {
        return error_response(
            StatusCode::BAD_REQUEST,
            "invalid_release_file",
            "Release upload requires a file field",
        );
    };
    let file_name = file_name.unwrap_or_else(|| "artifact.map".to_string());

    let storage_path =
        match resolve_artifact_path(&state.artifacts_dir, project_id, &version, &file_name) {
            Ok(path) => path,
            Err(()) => {
                let _ = tokio::fs::remove_file(&staged.path).await;
                return error_response(
                    StatusCode::BAD_REQUEST,
                    "invalid_release_file",
                    "Artifact path escapes release storage directory",
                );
            }
        };

    let storage_path = match canonical_artifact_path(&storage_path).await {
        Ok(path) => path,
        Err(()) => {
            let _ = tokio::fs::remove_file(&staged.path).await;
            return error_response(
                StatusCode::BAD_REQUEST,
                "invalid_release_file",
                "Artifact path escapes release storage directory",
            );
        }
    };

    if tokio::fs::rename(&staged.path, &storage_path)
        .await
        .is_err()
    {
        let _ = tokio::fs::remove_file(&staged.path).await;
        return error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "storage_error",
            "Failed to write artifact file",
        );
    }

    let release_id =
        match releases::ensure_release(&state.pools.ingest, record.org_id, project_id, &version)
            .await
        {
            Ok(id) => id,
            Err(_) => {
                let _ = tokio::fs::remove_file(&storage_path).await;
                return error_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "storage_error",
                    "Failed to persist release metadata",
                );
            }
        };

    let artifact_id = match releases::upsert_artifact_with_debug_id(
        &state.pools.ingest,
        record.org_id,
        release_id,
        &file_name,
        storage_path.to_string_lossy().as_ref(),
        Some(&staged.checksum),
        None,
    )
    .await
    {
        Ok(id) => id,
        Err(_) => {
            let _ = tokio::fs::remove_file(&storage_path).await;
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "storage_error",
                "Failed to persist artifact metadata",
            );
        }
    };

    with_cors(
        &state,
        &headers,
        (
            StatusCode::CREATED,
            Json(ReleaseFileAccepted {
                id: artifact_id,
                name: file_name,
            }),
        )
            .into_response(),
    )
}

struct StagedReleaseFile {
    path: std::path::PathBuf,
    checksum: String,
}

enum ArtifactNameError {
    TooLong,
    TooLarge,
    Malformed,
}

enum StagedFileError {
    TooLarge,
    Malformed,
    Empty,
    Storage,
}

fn release_file_too_large() -> Response {
    error_response(
        StatusCode::PAYLOAD_TOO_LARGE,
        "release_file_too_large",
        "Release files must be 32 MiB or smaller",
    )
}

fn malformed_release_file() -> Response {
    error_response(
        StatusCode::BAD_REQUEST,
        "invalid_release_file",
        "Malformed multipart payload",
    )
}

fn multipart_failure(err: MultipartError) -> Response {
    if err.status() == StatusCode::PAYLOAD_TOO_LARGE {
        release_file_too_large()
    } else {
        malformed_release_file()
    }
}

async fn discard_staged(staged: &mut Option<StagedReleaseFile>) {
    if let Some(staged) = staged.take() {
        let _ = tokio::fs::remove_file(staged.path).await;
    }
}

async fn drain_multipart_field(mut field: Field<'_>) -> Result<(), MultipartError> {
    while field.chunk().await?.is_some() {}
    Ok(())
}

async fn read_artifact_name(mut field: Field<'_>) -> Result<String, ArtifactNameError> {
    let mut buf = Vec::new();
    loop {
        match field.chunk().await {
            Ok(Some(chunk)) => {
                if buf.len().saturating_add(chunk.len()) > MAX_ARTIFACT_NAME_BYTES {
                    return Err(ArtifactNameError::TooLong);
                }
                buf.extend_from_slice(&chunk);
            }
            Ok(None) => break,
            Err(err) if err.status() == StatusCode::PAYLOAD_TOO_LARGE => {
                return Err(ArtifactNameError::TooLarge);
            }
            Err(_) => return Err(ArtifactNameError::Malformed),
        }
    }
    String::from_utf8(buf).map_err(|_| ArtifactNameError::Malformed)
}

async fn stream_release_file(
    mut field: Field<'_>,
    temp_path: &std::path::Path,
) -> Result<StagedReleaseFile, StagedFileError> {
    let mut file = match tokio::fs::File::create(temp_path).await {
        Ok(file) => file,
        Err(_) => return Err(StagedFileError::Storage),
    };
    let mut hasher = Sha256::new();
    let mut written = 0usize;

    loop {
        let chunk = match field.chunk().await {
            Ok(Some(chunk)) => chunk,
            Ok(None) => break,
            Err(err) => {
                drop(file);
                let _ = tokio::fs::remove_file(temp_path).await;
                return Err(if err.status() == StatusCode::PAYLOAD_TOO_LARGE {
                    StagedFileError::TooLarge
                } else {
                    StagedFileError::Malformed
                });
            }
        };
        let next = written.saturating_add(chunk.len());
        if next > MAX_RELEASE_FILE_BYTES {
            drop(file);
            let _ = tokio::fs::remove_file(temp_path).await;
            return Err(StagedFileError::TooLarge);
        }
        if file.write_all(&chunk).await.is_err() {
            drop(file);
            let _ = tokio::fs::remove_file(temp_path).await;
            return Err(StagedFileError::Storage);
        }
        hasher.update(&chunk);
        written = next;
    }

    if file.flush().await.is_err() {
        drop(file);
        let _ = tokio::fs::remove_file(temp_path).await;
        return Err(StagedFileError::Storage);
    }
    drop(file);

    if written == 0 {
        let _ = tokio::fs::remove_file(temp_path).await;
        return Err(StagedFileError::Empty);
    }

    Ok(StagedReleaseFile {
        path: temp_path.to_path_buf(),
        checksum: hex::encode(hasher.finalize()),
    })
}

async fn post_store(
    State(state): State<Arc<AppState>>,
    ConnectInfo(_addr): ConnectInfo<SocketAddr>,
    Path(raw_project_id): Path<String>,
    Query(query): Query<IngestQuery>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let project_id = match resolve_ingest_project_id(&state, &raw_project_id).await {
        Ok(id) => id,
        Err(response) => return response,
    };

    let auth = match extract_auth(&headers, &query) {
        Ok(auth) => auth,
        Err(_) => {
            return error_response(
                StatusCode::UNAUTHORIZED,
                "invalid_dsn",
                "DSN authentication failed",
            )
        }
    };

    let record = match validate_dsn(&state, &auth, project_id).await {
        Ok(record) => record,
        Err(response) => return response,
    };

    let payload = match parse_store_payload(&body) {
        Ok(payload) => payload,
        Err(StoreError::Empty)
        | Err(StoreError::InvalidJson)
        | Err(StoreError::DecompressFailed) => {
            return error_response(
                StatusCode::BAD_REQUEST,
                "invalid_store",
                "Malformed store payload",
            )
        }
    };

    accept_payload(&state, &headers, project_id, record.org_id, payload).await
}

async fn post_user_feedback(
    State(state): State<Arc<AppState>>,
    Path(raw_project_id): Path<String>,
    Query(query): Query<IngestQuery>,
    headers: HeaderMap,
    Json(body): Json<UserFeedbackBody>,
) -> Response {
    let project_id = match resolve_ingest_project_id(&state, &raw_project_id).await {
        Ok(id) => id,
        Err(response) => return response,
    };

    let auth = match extract_auth(&headers, &query) {
        Ok(auth) => auth,
        Err(_) => {
            return error_response(
                StatusCode::UNAUTHORIZED,
                "invalid_dsn",
                "DSN authentication failed",
            )
        }
    };

    let record = match validate_dsn(&state, &auth, project_id).await {
        Ok(record) => record,
        Err(response) => return response,
    };

    let exists = match user_feedback::event_exists(
        &state.pools.ingest,
        record.org_id,
        project_id,
        body.event_id,
    )
    .await
    {
        Ok(value) => value,
        Err(_) => {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "storage_error",
                "Failed to validate event",
            )
        }
    };

    if !exists {
        return error_response(
            StatusCode::NOT_FOUND,
            "event_not_found",
            "Event not found for project",
        );
    }

    let email = body.email.map(|value| scrub_string(&value));

    let feedback_id = match user_feedback::insert_feedback(
        &state.pools.ingest,
        record.org_id,
        user_feedback::InsertFeedbackParams {
            event_id: body.event_id,
            project_id,
            name: body.name,
            email,
            comments: body.comments,
        },
    )
    .await
    {
        Ok(id) => id,
        Err(_) => {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "storage_error",
                "Failed to store user feedback",
            )
        }
    };

    with_cors(
        &state,
        &headers,
        (
            StatusCode::CREATED,
            Json(UserFeedbackAccepted { id: feedback_id }),
        )
            .into_response(),
    )
}

async fn accept_payload(
    state: &AppState,
    headers: &HeaderMap,
    project_id: Uuid,
    org_id: Uuid,
    payload: Vec<u8>,
) -> Response {
    let payload = match epure_envelope::storage_safe_json(&payload) {
        Ok(payload) => payload,
        Err(message) => {
            return error_response(StatusCode::BAD_REQUEST, "invalid_event_json", message)
        }
    };
    if let Some(id) = client_event_id(&payload) {
        match epure_storage::ingest_queue::received(&state.pools.ingest, org_id, project_id, id)
            .await
        {
            Ok(true) => {
                return with_cors(
                    state,
                    headers,
                    (StatusCode::ACCEPTED, Json(IngestAccepted { id })).into_response(),
                )
            }
            Ok(false) => {}
            Err(_) => {
                return error_response(
                    StatusCode::SERVICE_UNAVAILABLE,
                    "receipt_unavailable",
                    "Retry; durable receipts are unavailable",
                )
            }
        }
    }
    let quota = match check_ingest_plan_limit(state, org_id).await {
        Ok(quota) => quota,
        Err(response) => {
            state
                .outcomes
                .record(org_id, project_id, "plan_rejected", 1);
            return response;
        }
    };

    if let Some(noise) = suppressed_noise(state, org_id, project_id, headers, &payload).await {
        note_noise(state, org_id, project_id, &noise).await;
        let event_id = client_event_id(&payload).unwrap_or_else(Uuid::new_v4);
        return with_cors(
            state,
            headers,
            (StatusCode::ACCEPTED, Json(IngestAccepted { id: event_id })).into_response(),
        );
    }

    let multi = preview_multi_fingerprint(&payload);
    let fingerprint = if multi.custom {
        multi.fingerprint.clone()
    } else {
        let release = serde_json::from_slice::<serde_json::Value>(&payload)
            .ok()
            .and_then(|v| v.get("release").and_then(|r| r.as_str()).map(str::to_owned))
            .unwrap_or_default();
        format!(
            "v2:{}:{:016x}",
            multi.fingerprint,
            epure_envelope::grouping::xxh64(release.as_bytes(), 91)
        )
    };
    let client_supplied_id = client_event_id(&payload);
    let supplied = client_supplied_id.is_some();
    let event_id = client_supplied_id.unwrap_or_else(Uuid::new_v4);
    if let QuotaDecision::OverQuota { grace_remaining } = quota {
        match epure_storage::persist::issue_status_by_fingerprint(
            &state.pools.ingest,
            org_id,
            project_id,
            &fingerprint,
        )
        .await
        {
            // Existing open issue: keep counting, never store the payload.
            Ok(Some(status)) if status != "resolved" => {
                return admit_counter(
                    state,
                    headers,
                    org_id,
                    project_id,
                    event_id,
                    fingerprint,
                    "quota_counted",
                )
                .await;
            }
            // New or regressed issue: keep its first event while grace remains.
            Ok(_) if grace_remaining => {
                state
                    .outcomes
                    .record(org_id, project_id, "quota_first_event", 1);
            }
            Ok(_) => {
                if let Some(event_id) = client_supplied_id {
                    state.outcomes.release_event_id(project_id, event_id);
                }
                state
                    .outcomes
                    .record(org_id, project_id, "plan_rejected", 1);
                return error_response(
                    StatusCode::FORBIDDEN,
                    "ingest_plan_limit_exceeded",
                    "Monthly event quota and new-issue grace are used up; existing issues are still counted",
                );
            }
            Err(_) => {
                return error_response(
                    StatusCode::SERVICE_UNAVAILABLE,
                    "quota_lookup_unavailable",
                    "Retry this event; quota lookup is unavailable",
                )
            }
        }
    }

    let user_agent = headers
        .get("user-agent")
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let country_code_hint = country_code_from_headers(headers);
    let project_cap = match state
        .ingest_cap
        .cap_for_project(&state.pools.ingest, project_id)
        .await
    {
        Ok(cap) => cap,
        Err(_) => {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "storage_error",
                "Failed to check ingest cap",
            )
        }
    };

    let job = match state.spike_valve.classify_grouped(
        project_id,
        org_id,
        GroupedSpikeInput {
            fingerprint: &fingerprint,
            h_exact: multi.h_exact,
            h_locus: multi.h_locus,
            project_cap_per_hour: project_cap,
            variant_label: &multi.variant_label,
        },
    ) {
        Ok(SpikeDecision::AllowStore) => {
            // Coalesced duplicates never reach this branch, so they cannot
            // exhaust the hourly project cap.
            if let Err(response) = check_ingest_cap(state, project_id).await {
                if let Some(event_id) = client_supplied_id {
                    state.outcomes.release_event_id(project_id, event_id);
                }
                state.outcomes.record(org_id, project_id, "cap_rejected", 1);
                return response;
            }
            state.outcomes.record(org_id, project_id, "queued", 1);
            IngestJob::StoreEvent {
                event_id,
                project_id,
                org_id,
                fingerprint,
                payload,
                user_agent,
                country_code_hint,
                accepted_at: std::time::Instant::now(),
                client_supplied_id: supplied,
            }
        }
        Ok(SpikeDecision::CounterOnly) => {
            return admit_counter(
                state,
                headers,
                org_id,
                project_id,
                event_id,
                fingerprint,
                "spike_coalesced",
            )
            .await;
        }
        Err(_) => {
            return error_response(
                StatusCode::SERVICE_UNAVAILABLE,
                "grouping_capacity",
                "Retry later; grouping capacity is busy",
            )
        }
    };

    if let Err(err) = crate::pipeline::durable::enqueue(&state.pools.ingest, job).await {
        tracing::warn!(error=%err,"durable event admission failed");
        if err.to_string().contains("project ingest cap") {
            return error_response(
                StatusCode::FORBIDDEN,
                "ingest_cap_exceeded",
                "Project ingest cap exceeded",
            );
        }
        return error_response(
            StatusCode::SERVICE_UNAVAILABLE,
            "backlog_unavailable",
            "Retry this event; durable admission failed",
        );
    }
    let _ = state.ingest_tx.try_send(());

    with_cors(
        state,
        headers,
        (StatusCode::ACCEPTED, Json(IngestAccepted { id: event_id })).into_response(),
    )
}

fn record_client_discards(
    state: &AppState,
    org_id: Uuid,
    project_id: Uuid,
    discards: &[epure_envelope::ClientDiscard],
) {
    for discard in discards {
        let reason = format!("client:{}", discard.reason);
        state
            .outcomes
            .record(org_id, project_id, &reason, discard.quantity);
    }
}

async fn suppressed_noise(
    state: &AppState,
    org_id: Uuid,
    project_id: Uuid,
    headers: &HeaderMap,
    payload: &[u8],
) -> Option<epure_envelope::NoiseMatch> {
    let Ok(event) = serde_json::from_slice::<serde_json::Value>(payload) else {
        return None;
    };
    let policy = state
        .noise_policies
        .get(&state.pools.ingest, org_id, project_id)
        .await;
    if policy == epure_envelope::NoisePolicy::default() {
        return None;
    }
    let user_agent = headers
        .get("user-agent")
        .and_then(|value| value.to_str().ok());
    match_noise(&event, user_agent, &policy)
}

async fn note_noise(
    state: &AppState,
    org_id: Uuid,
    project_id: Uuid,
    noise: &epure_envelope::NoiseMatch,
) {
    let reason = outcome_reason(noise);
    let spike = state.outcomes.record(org_id, project_id, &reason, 1);
    let Some(spike) = spike else {
        return;
    };
    if alerts::insert_alert_unless_suppressed(
        &state.pools.ingest,
        alerts::InsertAlertParams {
            org_id,
            project_id,
            issue_id: None,
            kind: "noise_spike".to_string(),
            payload_json: json!({
                "rule": spike.rule,
                "detail": noise.detail,
                "count_this_minute": spike.count_this_minute,
                "previous_minute": spike.previous_minute,
                "message": format!(
                    "Suppressed {} errors jumped to {} this minute (previous minute {})",
                    spike.rule, spike.count_this_minute, spike.previous_minute
                ),
            }),
        },
    )
    .await
    .is_err()
    {
        tracing::warn!("failed to persist noise spike alert");
    }
}

fn extract_auth(
    headers: &HeaderMap,
    query: &IngestQuery,
) -> Result<epure_envelope::AuthCredentials, AuthError> {
    let header = headers
        .get("X-Sentry-Auth")
        .and_then(|value| value.to_str().ok());
    parse_auth(
        header,
        query.sentry_key.as_deref(),
        query.sentry_secret.as_deref(),
    )
}

#[allow(clippy::result_large_err)]
async fn check_ingest_plan_limit(
    state: &AppState,
    org_id: Uuid,
) -> Result<QuotaDecision, Response> {
    match state
        .ingest_plan_limit
        .decide(&state.pools.ingest, org_id)
        .await
    {
        Ok(QuotaDecision::Inactive(reason)) => Err(error_response(
            StatusCode::FORBIDDEN,
            "subscription_inactive",
            match reason {
                InactiveReason::TrialEnded => "Trial ended; choose a plan to resume ingestion",
                InactiveReason::Canceled => {
                    "Subscription canceled; choose a plan to resume ingestion"
                }
                InactiveReason::Paused => "Subscription paused; resume it to continue ingestion",
                InactiveReason::NoPlan => "No active plan; choose a plan to start ingestion",
            },
        )),
        Ok(decision) => Ok(decision),
        Err(_) => Err(error_response(
            StatusCode::SERVICE_UNAVAILABLE,
            "plan_lookup_unavailable",
            "Retry this event; plan lookup is unavailable",
        )),
    }
}

/// Count an occurrence without storing its payload (spike valve and over-quota).
async fn admit_counter(
    state: &AppState,
    headers: &HeaderMap,
    org_id: Uuid,
    project_id: Uuid,
    event_id: Uuid,
    fingerprint: String,
    outcome: &str,
) -> Response {
    if let Err(err) = crate::pipeline::durable::enqueue_counter(
        &state.pools.ingest,
        org_id,
        project_id,
        event_id,
        fingerprint,
    )
    .await
    {
        tracing::warn!(error=%err,"durable counter admission failed");
        return error_response(
            StatusCode::SERVICE_UNAVAILABLE,
            "backlog_unavailable",
            "Retry this event; durable admission failed",
        );
    }
    state.outcomes.record(org_id, project_id, outcome, 1);
    with_cors(
        state,
        headers,
        (StatusCode::ACCEPTED, Json(IngestAccepted { id: event_id })).into_response(),
    )
}

#[allow(clippy::result_large_err)]
async fn check_ingest_cap(state: &AppState, project_id: Uuid) -> Result<(), Response> {
    match state
        .ingest_cap
        .allow_ingest(&state.pools.ingest, project_id)
        .await
    {
        Ok(IngestAllowance::Allowed) => Ok(()),
        Ok(IngestAllowance::Denied) => {
            if state.ingest_cap.take_cap_alert_slot(project_id) {
                if let Ok(Some(meta)) =
                    projects::project_ingest_meta(&state.pools.ingest, project_id).await
                {
                    if alerts::insert_alert_unless_suppressed(
                        &state.pools.ingest,
                        alerts::InsertAlertParams {
                            org_id: meta.org_id,
                            project_id,
                            issue_id: None,
                            kind: "ingest_cap_hit".to_string(),
                            payload_json: serde_json::json!({
                                "project_name": meta.name,
                                "cap_per_hour": meta.ingest_cap_per_hour,
                                "message": format!(
                                    "Hourly ingest cap ({}) reached — new events are rejected until the next hour",
                                    meta.ingest_cap_per_hour
                                ),
                            }),
                        },
                    )
                    .await
                    .is_err()
                    {
                        tracing::warn!("failed to persist ingest cap alert");
                    }
                }
            }
            Err(error_response(
                StatusCode::FORBIDDEN,
                "ingest_cap_exceeded",
                "Project ingest cap exceeded",
            ))
        }
        Err(_) => Err(error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "storage_error",
            "Failed to check ingest cap",
        )),
    }
}

#[allow(clippy::result_large_err)]
async fn resolve_ingest_project_id(state: &AppState, raw: &str) -> Result<Uuid, Response> {
    if let Ok(id) = Uuid::parse_str(raw) {
        return Ok(id);
    }
    if !raw.is_empty() && raw.chars().all(|c| c.is_ascii_digit()) {
        let dsn_id = raw.parse::<i64>().map_err(|_| {
            error_response(
                StatusCode::BAD_REQUEST,
                "invalid_project",
                "Invalid project id",
            )
        })?;
        return match projects::project_id_for_dsn_segment(&state.pools.ingest, dsn_id).await {
            Ok(Some(id)) => Ok(id),
            Ok(None) => Err(error_response(
                StatusCode::NOT_FOUND,
                "project_not_found",
                "Project not found",
            )),
            Err(_) => Err(error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "storage_error",
                "Failed to resolve project",
            )),
        };
    }
    Err(error_response(
        StatusCode::BAD_REQUEST,
        "invalid_project",
        "Invalid project id",
    ))
}

#[allow(clippy::result_large_err)]
async fn validate_dsn(
    state: &AppState,
    auth: &epure_envelope::AuthCredentials,
    project_id: Uuid,
) -> Result<DsnRecord, Response> {
    match state
        .dsn_validator
        .validate(&auth.public_key, auth.secret_key.as_deref(), project_id)
        .await
    {
        Ok(record) => Ok(record),
        Err(DsnAuthError::Revoked) => Err(error_response(
            StatusCode::FORBIDDEN,
            "dsn_revoked",
            "DSN key has been revoked",
        )),
        Err(DsnAuthError::ProjectMismatch) => Err(error_response(
            StatusCode::FORBIDDEN,
            "project_mismatch",
            "DSN does not match project",
        )),
        Err(DsnAuthError::Invalid) | Err(DsnAuthError::Missing) => Err(error_response(
            StatusCode::UNAUTHORIZED,
            "invalid_dsn",
            "DSN authentication failed",
        )),
        Err(DsnAuthError::Storage(_)) => Err(error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "storage_error",
            "Failed to validate DSN",
        )),
    }
}

fn error_response(status: StatusCode, error: &'static str, message: &'static str) -> Response {
    (status, Json(ErrorResponse { error, message })).into_response()
}

fn cors_response(state: &AppState, headers: &HeaderMap, status: StatusCode) -> Response {
    let mut response = Response::builder()
        .status(status)
        .body(axum::body::Body::empty())
        .unwrap();
    apply_cors_headers(state, headers, response.headers_mut());
    response
}

fn with_cors(state: &AppState, headers: &HeaderMap, response: Response) -> Response {
    let (mut parts, body) = response.into_parts();
    apply_cors_headers(state, headers, &mut parts.headers);
    Response::from_parts(parts, body)
}

fn validate_release_version(version: &str) -> bool {
    !version.is_empty()
        && !version.contains("..")
        && !version.contains('/')
        && !version.contains('\\')
}

fn sanitize_artifact_name(name: &str) -> String {
    name.trim_start_matches("~/")
        .trim_start_matches('/')
        .replace(['/', '\\'], "_")
}

fn resolve_artifact_path(
    artifacts_dir: &std::path::Path,
    project_id: Uuid,
    version: &str,
    file_name: &str,
) -> Result<std::path::PathBuf, ()> {
    if !validate_release_version(version) {
        return Err(());
    }

    // Slashes are flattened to one path component, so `[[...path]]` is a name,
    // not traversal. Reject a real `..` segment before that flattening.
    let has_parent_segment = file_name.split(['/', '\\']).any(|segment| segment == "..");
    let sanitized = sanitize_artifact_name(file_name);
    if has_parent_segment || sanitized.is_empty() || sanitized == ".." || sanitized.contains('\0') {
        return Err(());
    }

    let base = artifacts_dir.join(project_id.to_string()).join(version);
    let candidate = base.join(&sanitized);
    if !candidate.starts_with(&base) {
        return Err(());
    }

    Ok(candidate)
}

async fn canonical_artifact_path(path: &std::path::Path) -> Result<std::path::PathBuf, ()> {
    let parent = path.parent().ok_or(())?;
    let canonical = tokio::fs::canonicalize(parent).await.map_err(|_| ())?;
    let file_name = path.file_name().ok_or(())?;
    let canonical_file = canonical.join(file_name);
    if !canonical_file.starts_with(&canonical) {
        return Err(());
    }
    Ok(canonical_file)
}

fn country_code_from_headers(headers: &HeaderMap) -> Option<String> {
    headers
        .get("cf-ipcountry")
        .or_else(|| headers.get("x-country-code"))
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|code| code.len() == 2)
        .map(|code| code.to_ascii_uppercase())
}

fn allowed_cors_origin(allowed: &[String], origin: Option<&str>) -> Option<String> {
    if allowed.iter().any(|value| value == "*") {
        return Some("*".to_string());
    }
    let origin = origin?;
    if allowed.iter().any(|value| value == origin) {
        Some(origin.to_string())
    } else {
        None
    }
}

fn apply_cors_headers(
    state: &AppState,
    request_headers: &HeaderMap,
    response_headers: &mut HeaderMap,
) {
    let origin = request_headers
        .get("origin")
        .and_then(|value| value.to_str().ok());

    let Some(allow_origin) = allowed_cors_origin(&state.cors_origins, origin) else {
        return;
    };
    response_headers.insert(
        "access-control-allow-origin",
        allow_origin.parse().expect("valid origin header"),
    );

    response_headers.insert(
        "access-control-allow-methods",
        "POST, OPTIONS".parse().expect("valid methods header"),
    );
    response_headers.insert(
        "access-control-allow-headers",
        "X-Sentry-Auth, Content-Type, Content-Encoding"
            .parse()
            .expect("valid headers header"),
    );
    response_headers.insert(
        "access-control-max-age",
        "600".parse().expect("valid max-age header"),
    );
}

#[cfg(test)]
mod artifact_path_tests {
    use super::resolve_artifact_path;

    fn resolve(file_name: &str) -> Result<std::path::PathBuf, ()> {
        resolve_artifact_path(
            std::path::Path::new("/artifacts"),
            uuid::Uuid::nil(),
            "1.0.0",
            file_name,
        )
    }

    #[test]
    fn artifact_names_allow_non_traversal_dot_sequences() {
        for name in [
            "~/_next/static/chunks/app/[[...path]]/page.js.map",
            "report..final.js.map",
        ] {
            assert!(resolve(name).is_ok(), "{name} should be accepted");
        }
    }

    #[test]
    fn artifact_names_reject_parent_directory_segments() {
        for name in [
            "..",
            "../outside.map",
            "nested/../../outside.map",
            r"..\outside.map",
            r"nested\..\outside.map",
            "~\u{0}hidden.map",
        ] {
            assert!(resolve(name).is_err(), "{name} should be rejected");
        }
    }
}

#[cfg(test)]
mod cors_tests {
    use super::allowed_cors_origin;

    #[test]
    fn unknown_origin_is_not_reflected() {
        let allowed = vec!["https://errors.example.com".to_string()];
        assert!(allowed_cors_origin(&allowed, Some("https://evil.example")).is_none());
        assert_eq!(
            allowed_cors_origin(&allowed, Some("https://errors.example.com")).as_deref(),
            Some("https://errors.example.com")
        );
        let any = vec!["*".to_string()];
        assert_eq!(
            allowed_cors_origin(&any, Some("https://evil.example")).as_deref(),
            Some("*")
        );
    }
}
