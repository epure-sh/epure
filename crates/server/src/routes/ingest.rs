use axum::{
    body::Bytes,
    extract::{Multipart, Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{options, post},
    Json, Router,
};
use epure_auth::{DsnAuthError, DsnRecord};
use epure_envelope::{
    parse_auth, parse_envelope, parse_store_payload, preview_fingerprint, scrub_string, AuthError,
    EnvelopeError, StoreError,
};
use epure_storage::{alerts, projects, releases, user_feedback};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tower_http::limit::RequestBodyLimitLayer;
use uuid::Uuid;

use crate::pipeline::ingest_cap::IngestAllowance;
use crate::pipeline::mpsc::IngestJob;
use crate::pipeline::spike::SpikeDecision;
use crate::state::AppState;

const BODY_LIMIT: usize = 2 * 1024 * 1024;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/api/{project_id}/envelope/", options(cors_preflight))
        .route("/api/{project_id}/envelope/", post(post_envelope))
        .route("/api/{project_id}/store/", options(cors_preflight))
        .route("/api/{project_id}/store/", post(post_store))
        .route(
            "/api/{project_id}/releases/{version}/files/",
            options(cors_preflight),
        )
        .route(
            "/api/{project_id}/releases/{version}/files/",
            post(post_release_files),
        )
        .route("/api/{project_id}/user-feedback/", options(cors_preflight))
        .route("/api/{project_id}/user-feedback/", post(post_user_feedback))
        .layer(RequestBodyLimitLayer::new(BODY_LIMIT))
        .with_state(state)
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
    Path(project_id): Path<Uuid>,
    Query(query): Query<IngestQuery>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
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

    if let Err(response) = check_ingest_cap(&state, project_id).await {
        return response;
    }

    let parsed = match parse_envelope(&body) {
        Ok(parsed) => parsed,
        Err(EnvelopeError::NoEvent) => {
            return error_response(
                StatusCode::BAD_REQUEST,
                "invalid_envelope",
                "No event item found in envelope",
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

    accept_payload(
        &state,
        &headers,
        project_id,
        record.org_id,
        parsed.event_payload,
    )
    .await
}

async fn post_release_files(
    State(state): State<Arc<AppState>>,
    Path((project_id, version)): Path<(Uuid, String)>,
    Query(query): Query<IngestQuery>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Response {
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

    let mut file_name = None;
    let mut file_bytes = None;

    loop {
        match multipart.next_field().await {
            Ok(Some(field)) => {
                let field_name = field.name().unwrap_or_default().to_string();
                match field_name.as_str() {
                    "name" => {
                        if let Ok(text) = field.text().await {
                            if !text.is_empty() {
                                file_name = Some(text);
                            }
                        }
                    }
                    "file" => {
                        if let Ok(bytes) = field.bytes().await {
                            if !bytes.is_empty() {
                                file_bytes = Some(bytes.to_vec());
                            }
                        }
                    }
                    _ => {}
                }
            }
            Ok(None) => break,
            Err(_) => {
                return error_response(
                    StatusCode::BAD_REQUEST,
                    "invalid_release_file",
                    "Malformed multipart payload",
                )
            }
        }
    }

    let file_name = file_name.unwrap_or_else(|| "artifact.map".to_string());
    let file_bytes = match file_bytes {
        Some(bytes) => bytes,
        None => {
            return error_response(
                StatusCode::BAD_REQUEST,
                "invalid_release_file",
                "Release upload requires a file field",
            )
        }
    };

    let release_id =
        match releases::ensure_release(&state.pools.ingest, record.org_id, project_id, &version)
            .await
        {
            Ok(id) => id,
            Err(_) => {
                return error_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "storage_error",
                    "Failed to persist release metadata",
                )
            }
        };

    let storage_path =
        match resolve_artifact_path(&state.artifacts_dir, project_id, &version, &file_name) {
            Ok(path) => path,
            Err(_) => {
                return error_response(
                    StatusCode::BAD_REQUEST,
                    "invalid_release_file",
                    "Artifact path escapes release storage directory",
                )
            }
        };

    if let Some(parent) = storage_path.parent() {
        if tokio::fs::create_dir_all(parent).await.is_err() {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "storage_error",
                "Failed to create artifact directory",
            );
        }
    }

    let storage_path = match canonical_artifact_path(&storage_path).await {
        Ok(path) => path,
        Err(_) => {
            return error_response(
                StatusCode::BAD_REQUEST,
                "invalid_release_file",
                "Artifact path escapes release storage directory",
            )
        }
    };

    if tokio::fs::write(&storage_path, &file_bytes).await.is_err() {
        return error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "storage_error",
            "Failed to write artifact file",
        );
    }

    let artifact_id = match releases::upsert_artifact(
        &state.pools.ingest,
        record.org_id,
        release_id,
        &file_name,
        storage_path.to_string_lossy().as_ref(),
        &file_bytes,
    )
    .await
    {
        Ok(id) => id,
        Err(_) => {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "storage_error",
                "Failed to persist artifact metadata",
            )
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

async fn post_store(
    State(state): State<Arc<AppState>>,
    Path(project_id): Path<Uuid>,
    Query(query): Query<IngestQuery>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
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

    if let Err(response) = check_ingest_cap(&state, project_id).await {
        return response;
    }

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
    Path(project_id): Path<Uuid>,
    Query(query): Query<IngestQuery>,
    headers: HeaderMap,
    Json(body): Json<UserFeedbackBody>,
) -> Response {
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
    let fingerprint = preview_fingerprint(&payload);
    let event_id = Uuid::new_v4();
    let user_agent = headers
        .get("user-agent")
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let client_ip = client_ip_from_headers(headers);
    let country_code_hint = country_code_from_headers(headers);

    let job = match state.spike_valve.check(&fingerprint) {
        SpikeDecision::AllowStore => IngestJob::StoreEvent {
            event_id,
            project_id,
            org_id,
            fingerprint,
            payload,
            user_agent,
            client_ip,
            country_code_hint,
        },
        SpikeDecision::CounterOnly => IngestJob::CounterOnly {
            project_id,
            org_id,
            fingerprint,
        },
    };

    if state.ingest_tx.send(job).await.is_err() {
        return error_response(
            StatusCode::SERVICE_UNAVAILABLE,
            "queue_unavailable",
            "Ingest queue is unavailable",
        );
    }

    with_cors(
        state,
        headers,
        (StatusCode::ACCEPTED, Json(IngestAccepted { id: event_id })).into_response(),
    )
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
async fn validate_dsn(
    state: &AppState,
    auth: &epure_envelope::AuthCredentials,
    project_id: Uuid,
) -> Result<DsnRecord, Response> {
    match state
        .dsn_validator
        .validate(&auth.public_key, &auth.secret_key, project_id)
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

    let sanitized = sanitize_artifact_name(file_name);
    if sanitized.is_empty() || sanitized.contains("..") {
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

fn client_ip_from_headers(headers: &HeaderMap) -> Option<String> {
    headers
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|value| value.to_str().ok())
                .map(str::to_string)
        })
}

fn apply_cors_headers(
    state: &AppState,
    request_headers: &HeaderMap,
    response_headers: &mut HeaderMap,
) {
    let origin = request_headers
        .get("origin")
        .and_then(|value| value.to_str().ok());

    let allow_origin = state
        .cors_origins
        .iter()
        .find(|allowed| *allowed == "*" || origin.is_some_and(|o| allowed.as_str() == o))
        .cloned()
        .or_else(|| {
            if state.cors_origins.iter().any(|allowed| allowed == "*") {
                Some("*".to_string())
            } else {
                origin.map(str::to_string)
            }
        });

    if let Some(allow_origin) = allow_origin {
        response_headers.insert(
            "access-control-allow-origin",
            allow_origin.parse().expect("valid origin header"),
        );
    }

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
