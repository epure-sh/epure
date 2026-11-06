use super::rbac::{require_min_role, Role};
use axum::{
    extract::{DefaultBodyLimit, Multipart, Path, State},
    handler::Handler,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Extension, Json, Router,
};
use epure_auth::DashboardSession;
use epure_storage::releases;
use serde::Deserialize;
use serde_json::json;
use sha1::Digest;
use std::sync::Arc;
use uuid::Uuid;

use crate::state::AppState;

mod bundle;

const MAX_ARTIFACT_BYTES: usize = 32 * 1024 * 1024;
const CHUNK_BODY_LIMIT: usize = MAX_ARTIFACT_BYTES + 64 * 1024;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/0/organizations/{org_slug}/chunk-upload/",
            get(get_chunk_upload)
                .post(post_chunk_upload.layer(DefaultBodyLimit::max(CHUNK_BODY_LIMIT))),
        )
        .route(
            "/api/0/organizations/{org_slug}/chunk-upload",
            get(get_chunk_upload)
                .post(post_chunk_upload.layer(DefaultBodyLimit::max(CHUNK_BODY_LIMIT))),
        )
        .route(
            "/api/0/organizations/{org_slug}/artifactbundle/assemble/",
            post(post_artifact_bundle),
        )
        .route(
            "/api/0/organizations/{org_slug}/artifactbundle/assemble",
            post(post_artifact_bundle),
        )
        .route(
            "/api/0/organizations/{org_slug}/releases/{version}/assemble/",
            post(post_release_assemble),
        )
        .route(
            "/api/0/organizations/{org_slug}/releases/{version}/assemble",
            post(post_release_assemble),
        )
        .route(
            "/api/0/projects/{org_slug}/{project_slug}/files/difs/assemble/",
            post(post_difs_assemble),
        )
        .route(
            "/api/0/projects/{org_slug}/{project_slug}/files/difs/assemble",
            post(post_difs_assemble),
        )
        .route_layer(axum::middleware::from_fn_with_state(
            state.clone(),
            super::require_api_auth,
        ))
        .layer(tower::limit::ConcurrencyLimitLayer::new(8))
        .with_state(state)
}

async fn get_chunk_upload(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(org_slug): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    authorize_workspace(&state, &dashboard, &org_slug).await?;
    Ok(Json(json!({
        "url": format!("/api/0/organizations/{org_slug}/chunk-upload/"),
        "chunkSize": 8388608,
        "chunksPerRequest": 64,
        "maxFileSize": MAX_ARTIFACT_BYTES,
        "maxRequestSize": MAX_ARTIFACT_BYTES,
        "concurrency": 8,
        "hashAlgorithm": "sha1",
        "accept": ["release_files", "assembly", "artifact_bundles", "artifact_bundles_v2"]
    })))
}

async fn post_chunk_upload(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(org_slug): Path<String>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let org_id = authorize_workspace(&state, &dashboard, &org_slug).await?;

    let database_error = |_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":"could not save chunks"})),
        )
    };
    let mut tx = epure_storage::rls::begin_ingest_transaction(&state.pools.ingest, org_id)
        .await
        .map_err(database_error)?;
    loop {
        let field = multipart.next_field().await.map_err(|error| {
            (
                error.status(),
                Json(json!({"error":"invalid chunk upload"})),
            )
        })?;
        let Some(field) = field else { break };
        let declared = [field.name(), field.file_name()]
            .into_iter()
            .flatten()
            .find(|name| name.len() == 40 && name.chars().all(|c| c.is_ascii_hexdigit()))
            .map(str::to_ascii_lowercase);
        let data = field
            .bytes()
            .await
            .map_err(|error| (error.status(), Json(json!({"error":"invalid chunk data"}))))?;
        let sha1 = hex::encode(sha1::Sha1::digest(&data));
        if declared.is_some_and(|checksum| checksum != sha1) {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({"error":"chunk checksum mismatch"})),
            ));
        }
        sqlx::query(
            "INSERT INTO artifact_upload_chunks (org_id, sha1, data, created_at)
             VALUES ($1, $2, $3, NOW()) ON CONFLICT (org_id, sha1) DO NOTHING",
        )
        .bind(org_id)
        .bind(&sha1)
        .bind(&data[..])
        .execute(&mut *tx)
        .await
        .map_err(database_error)?;
    }
    tx.commit().await.map_err(database_error)?;
    Ok(Json(json!([])))
}

#[derive(Deserialize)]
struct AssembleBundle {
    checksum: String,
    chunks: Vec<String>,
    projects: Vec<String>,
    version: Option<String>,
    dist: Option<String>,
}

async fn post_artifact_bundle(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path(org_slug): Path<String>,
    Json(body): Json<AssembleBundle>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let org_id = authorize_workspace(&state, &dashboard, &org_slug).await?;
    if body.projects.is_empty()
        || body.projects.len() > 32
        || body.projects.iter().any(String::is_empty)
    {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error":"Specify between 1 and 32 projects"})),
        ));
    }
    let mut project_ids = Vec::new();
    for project in &body.projects {
        let id = resolve_project_id(&state.pools.ingest, org_id, project)
            .await
            .ok_or_else(|| {
                (
                    StatusCode::NOT_FOUND,
                    Json(json!({"error":"project not found"})),
                )
            })?;
        if !project_ids.contains(&id) {
            project_ids.push(id);
        }
    }
    Ok(Json(assembly_status(
        assemble_bundle(&state, org_id, &project_ids, body).await,
    )))
}

async fn assemble_bundle(
    state: &AppState,
    org_id: Uuid,
    project_ids: &[Uuid],
    body: AssembleBundle,
) -> Result<(), AssemblyError> {
    let (bytes, _) = assemble_chunks(state, org_id, Some(&body.checksum), &body.chunks).await?;
    let version = body.version.as_deref().filter(|value| !value.is_empty());
    let debug_only = version.is_none() || body.dist.as_ref().is_some_and(|dist| !dist.is_empty());
    let maps = tokio::task::spawn_blocking(move || bundle::read_source_maps(bytes, debug_only))
        .await
        .map_err(|_| AssemblyError::Invalid("Could not process source map bundle"))??;
    for map in maps {
        let digest = hex::encode(sha1::Sha1::digest(&map.bytes));
        let debug_id = map.debug_id.map(|id| id.to_string());
        let name = match debug_id.as_deref() {
            Some(id) if debug_only => format!("debug-id/{id}.map"),
            _ => map.name,
        };
        for &project_id in project_ids {
            let target = AssembleTarget {
                org_id,
                project_id,
                version: version.unwrap_or("difs"),
            };
            save_artifact(
                state,
                target,
                &name,
                &map.bytes,
                &digest,
                debug_id.as_deref(),
            )
            .await?;
        }
    }
    Ok(())
}

async fn post_release_assemble(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path((org_slug, version)): Path<(String, String)>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let org_id = authorize_workspace(&state, &dashboard, &org_slug).await?;

    let project_id = resolve_first_project_id(&state.pools.ingest, org_id)
        .await
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "project not found for organization"})),
            )
        })?;

    let is_dict_format = body
        .as_object()
        .is_some_and(|map| map.values().any(|v| v.get("chunks").is_some()));

    if is_dict_format {
        let mut response_map = serde_json::Map::new();
        let map = body.as_object().unwrap();

        for (checksum, file_spec) in map {
            let chunks: Vec<String> = file_spec
                .get("chunks")
                .and_then(serde_json::Value::as_array)
                .map(|arr| {
                    arr.iter()
                        .filter_map(serde_json::Value::as_str)
                        .map(str::to_string)
                        .collect()
                })
                .unwrap_or_default();

            let name = file_spec
                .get("name")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("artifact.map");

            let res = assemble_single_file(
                &state,
                AssembleTarget {
                    org_id,
                    project_id,
                    version: &version,
                },
                name,
                Some(checksum),
                &chunks,
                None,
            )
            .await;

            response_map.insert(checksum.clone(), assembly_status(res));
        }

        return Ok(Json(serde_json::Value::Object(response_map)));
    }

    let chunks: Vec<String> = body
        .get("chunks")
        .and_then(serde_json::Value::as_array)
        .map(|arr| {
            arr.iter()
                .filter_map(serde_json::Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();

    let name = body
        .get("name")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("artifact.map");

    let checksum = body.get("checksum").and_then(serde_json::Value::as_str);

    let result = assemble_single_file(
        &state,
        AssembleTarget {
            org_id,
            project_id,
            version: &version,
        },
        name,
        checksum,
        &chunks,
        None,
    )
    .await;
    Ok(Json(assembly_status(result)))
}

async fn post_difs_assemble(
    State(state): State<Arc<AppState>>,
    Extension(dashboard): Extension<DashboardSession>,
    Path((org_slug, project_slug)): Path<(String, String)>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let org_id = authorize_workspace(&state, &dashboard, &org_slug).await?;

    let project_id = resolve_project_id(&state.pools.ingest, org_id, &project_slug)
        .await
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "project not found"})),
            )
        })?;

    let mut response_map = serde_json::Map::new();

    if let Some(map) = body.as_object() {
        for (checksum, file_spec) in map {
            let chunks: Vec<String> = file_spec
                .get("chunks")
                .and_then(serde_json::Value::as_array)
                .map(|arr| {
                    arr.iter()
                        .filter_map(serde_json::Value::as_str)
                        .map(str::to_string)
                        .collect()
                })
                .unwrap_or_default();

            let name = file_spec
                .get("name")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("debug.dif");

            let debug_id = file_spec
                .get("debug_id")
                .or_else(|| file_spec.get("debugId"))
                .and_then(serde_json::Value::as_str);

            let res = assemble_single_file(
                &state,
                AssembleTarget {
                    org_id,
                    project_id,
                    version: "difs",
                },
                name,
                Some(checksum),
                &chunks,
                debug_id,
            )
            .await;

            response_map.insert(checksum.clone(), assembly_status(res));
        }
    }

    Ok(Json(serde_json::Value::Object(response_map)))
}

/// Where an assembled artifact is stored.
#[derive(Clone, Copy)]
struct AssembleTarget<'a> {
    org_id: Uuid,
    project_id: Uuid,
    version: &'a str,
}

enum AssemblyError {
    Missing(Vec<String>),
    Invalid(&'static str),
}

fn assembly_status(result: Result<(), AssemblyError>) -> serde_json::Value {
    match result {
        Ok(()) => json!({"state":"ok","missingChunks":[]}),
        Err(AssemblyError::Missing(chunks)) => json!({"state":"not_found","missingChunks":chunks}),
        Err(AssemblyError::Invalid(detail)) => {
            json!({"state":"error","detail":detail,"missingChunks":[]})
        }
    }
}

async fn assemble_single_file(
    state: &AppState,
    target: AssembleTarget<'_>,
    name: &str,
    checksum: Option<&str>,
    chunks: &[String],
    debug_id: Option<&str>,
) -> Result<(), AssemblyError> {
    let (bytes, digest) = assemble_chunks(state, target.org_id, checksum, chunks).await?;
    save_artifact(state, target, name, &bytes, &digest, debug_id).await
}

async fn assemble_chunks(
    state: &AppState,
    org_id: Uuid,
    checksum: Option<&str>,
    chunks: &[String],
) -> Result<(Vec<u8>, String), AssemblyError> {
    if chunks.is_empty() {
        return Err(AssemblyError::Invalid("No chunks were supplied"));
    }
    if chunks.len() > 64 {
        return Err(AssemblyError::Invalid("Too many chunks"));
    }
    let mut missing_chunks = Vec::new();
    let mut assembled_bytes = Vec::new();

    let mut tx = epure_storage::rls::begin_ingest_transaction(&state.pools.ingest, org_id)
        .await
        .map_err(|_| AssemblyError::Invalid("Could not read upload chunks"))?;

    for chunk_sha1 in chunks {
        let chunk_data: Option<Vec<u8>> = sqlx::query_scalar(
            "SELECT data FROM artifact_upload_chunks WHERE org_id = $1 AND sha1 = $2",
        )
        .bind(org_id)
        .bind(chunk_sha1)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|_| AssemblyError::Invalid("Could not read upload chunks"))?;

        match chunk_data {
            Some(data) => {
                if assembled_bytes.len().saturating_add(data.len()) > MAX_ARTIFACT_BYTES {
                    return Err(AssemblyError::Invalid(
                        "Source maps must be 32 MiB or smaller",
                    ));
                }
                assembled_bytes.extend_from_slice(&data);
            }
            None => missing_chunks.push(chunk_sha1.clone()),
        }
    }
    tx.commit()
        .await
        .map_err(|_| AssemblyError::Invalid("Could not read upload chunks"))?;

    if !missing_chunks.is_empty() {
        return Err(AssemblyError::Missing(missing_chunks));
    }
    let digest = hex::encode(sha1::Sha1::digest(&assembled_bytes));
    if checksum.is_some_and(|value| !value.eq_ignore_ascii_case(&digest)) {
        return Err(AssemblyError::Invalid("Assembled checksum mismatch"));
    }
    Ok((assembled_bytes, digest))
}

async fn save_artifact(
    state: &AppState,
    target: AssembleTarget<'_>,
    name: &str,
    bytes: &[u8],
    digest: &str,
    debug_id: Option<&str>,
) -> Result<(), AssemblyError> {
    let AssembleTarget {
        org_id,
        project_id,
        version,
    } = target;
    let release_id = releases::ensure_release(&state.pools.ingest, org_id, project_id, version)
        .await
        .map_err(|_| AssemblyError::Invalid("Could not save source map"))?;

    let storage_dir = state
        .artifacts_dir
        .join(project_id.to_string())
        .join(release_id.to_string());
    tokio::fs::create_dir_all(&storage_dir)
        .await
        .map_err(|_| AssemblyError::Invalid("Could not create source map directory"))?;
    let storage_path = storage_dir.join(digest);
    if !tokio::fs::try_exists(&storage_path).await.unwrap_or(false) {
        let temporary = storage_dir.join(format!(".epure-upload-{}.tmp", Uuid::new_v4()));
        if tokio::fs::write(&temporary, bytes).await.is_err()
            || tokio::fs::rename(&temporary, &storage_path).await.is_err()
        {
            let _ = tokio::fs::remove_file(temporary).await;
            return Err(AssemblyError::Invalid("Could not write source map"));
        }
    }

    let path_str = storage_path.to_string_lossy().to_string();

    releases::upsert_artifact_with_debug_id(
        &state.pools.ingest,
        org_id,
        release_id,
        name,
        &path_str,
        Some(digest),
        debug_id,
    )
    .await
    .map_err(|_| AssemblyError::Invalid("Could not save source map"))?;

    Ok(())
}

async fn authorize_workspace(
    state: &AppState,
    dashboard: &DashboardSession,
    org_slug: &str,
) -> Result<Uuid, (StatusCode, Json<serde_json::Value>)> {
    require_min_role(dashboard, Role::Admin)
        .map_err(|status| (status, Json(json!({"error":"forbidden"}))))?;
    if resolve_org_id(&state.pools.ingest, org_slug).await != Some(dashboard.org_id) {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error":"workspace not found"})),
        ));
    }
    Ok(dashboard.org_id)
}

async fn resolve_org_id(pool: &epure_storage::PgPool, org_slug: &str) -> Option<Uuid> {
    sqlx::query_scalar("SELECT ingest_lookup_org_id($1)")
        .bind(org_slug)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
}

async fn resolve_first_project_id(pool: &epure_storage::PgPool, org_id: Uuid) -> Option<Uuid> {
    sqlx::query_scalar("SELECT ingest_lookup_project_by_slug($1, '')")
        .bind(org_id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
}

async fn resolve_project_id(
    pool: &epure_storage::PgPool,
    org_id: Uuid,
    project_slug: &str,
) -> Option<Uuid> {
    sqlx::query_scalar("SELECT ingest_lookup_project_by_slug($1, $2)")
        .bind(org_id)
        .bind(project_slug)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
}
