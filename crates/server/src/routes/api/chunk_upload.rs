use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use epure_storage::releases;
use serde_json::json;
use sha1::Digest;
use std::sync::Arc;
use uuid::Uuid;

use crate::state::AppState;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/0/organizations/{org_slug}/chunk-upload/",
            get(get_chunk_upload).post(post_chunk_upload),
        )
        .route(
            "/api/0/organizations/{org_slug}/chunk-upload",
            get(get_chunk_upload).post(post_chunk_upload),
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
        .with_state(state)
}

async fn get_chunk_upload(Path(org_slug): Path<String>) -> impl IntoResponse {
    Json(json!({
        "url": format!("/api/0/organizations/{org_slug}/chunk-upload/"),
        "chunkSize": 8388608,
        "chunksPerRequest": 64,
        "maxRequestSize": 33554432,
        "concurrency": 8,
        "hashAlgorithm": "sha1",
        "accept": ["release_files", "assembly"]
    }))
}

async fn post_chunk_upload(
    State(state): State<Arc<AppState>>,
    Path(org_slug): Path<String>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let org_id = resolve_org_id(&state.pools.ingest, &org_slug)
        .await
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "organization not found"})),
            )
        })?;

    while let Ok(Some(field)) = multipart.next_field().await {
        let field_name = field.name().unwrap_or_default().to_string();
        let file_name = field.file_name().unwrap_or_default().to_string();
        let data = match field.bytes().await {
            Ok(b) => b,
            Err(_) => continue,
        };

        let mut hasher = sha1::Sha1::new();
        sha1::Digest::update(&mut hasher, &data);
        let calculated_sha1 = hex::encode(sha1::Digest::finalize(hasher));

        let sha1 = if field_name.len() == 40 && field_name.chars().all(|c| c.is_ascii_hexdigit()) {
            field_name.to_ascii_lowercase()
        } else if file_name.len() == 40 && file_name.chars().all(|c| c.is_ascii_hexdigit()) {
            file_name.to_ascii_lowercase()
        } else {
            calculated_sha1
        };

        let mut tx =
            match epure_storage::rls::begin_ingest_transaction(&state.pools.ingest, org_id).await {
                Ok(tx) => tx,
                Err(_) => continue,
            };

        let _ = sqlx::query(
            r#"
            INSERT INTO artifact_upload_chunks (org_id, sha1, data, created_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (org_id, sha1) DO NOTHING
            "#,
        )
        .bind(org_id)
        .bind(&sha1)
        .bind(&data[..])
        .execute(&mut *tx)
        .await;

        let _ = tx.commit().await;
    }

    Ok(Json(json!([])))
}

async fn post_release_assemble(
    State(state): State<Arc<AppState>>,
    Path((org_slug, version)): Path<(String, String)>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let org_id = resolve_org_id(&state.pools.ingest, &org_slug)
        .await
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "organization not found"})),
            )
        })?;

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

            match res {
                Ok(_) => {
                    response_map.insert(
                        checksum.clone(),
                        json!({ "state": "ok", "missingChunks": [] }),
                    );
                }
                Err(missing) => {
                    response_map.insert(
                        checksum.clone(),
                        json!({ "state": "not_found", "missingChunks": missing }),
                    );
                }
            }
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

    match assemble_single_file(
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
    .await
    {
        Ok(_) => Ok(Json(json!({ "state": "ok", "missingChunks": [] }))),
        Err(missing) => Ok(Json(
            json!({ "state": "not_found", "missingChunks": missing }),
        )),
    }
}

async fn post_difs_assemble(
    State(state): State<Arc<AppState>>,
    Path((org_slug, project_slug)): Path<(String, String)>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let org_id = resolve_org_id(&state.pools.ingest, &org_slug)
        .await
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "organization not found"})),
            )
        })?;

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

            match res {
                Ok(_) => {
                    response_map.insert(
                        checksum.clone(),
                        json!({ "state": "ok", "missingChunks": [] }),
                    );
                }
                Err(missing) => {
                    response_map.insert(
                        checksum.clone(),
                        json!({ "state": "not_found", "missingChunks": missing }),
                    );
                }
            }
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

async fn assemble_single_file(
    state: &AppState,
    target: AssembleTarget<'_>,
    name: &str,
    checksum: Option<&str>,
    chunks: &[String],
    debug_id: Option<&str>,
) -> Result<(), Vec<String>> {
    let AssembleTarget {
        org_id,
        project_id,
        version,
    } = target;
    let mut missing_chunks = Vec::new();
    let mut assembled_bytes = Vec::new();

    let mut tx = epure_storage::rls::begin_ingest_transaction(&state.pools.ingest, org_id)
        .await
        .map_err(|_| chunks.to_vec())?;

    for chunk_sha1 in chunks {
        let chunk_data: Option<Vec<u8>> = sqlx::query_scalar(
            "SELECT data FROM artifact_upload_chunks WHERE org_id = $1 AND sha1 = $2",
        )
        .bind(org_id)
        .bind(chunk_sha1)
        .fetch_optional(&mut *tx)
        .await
        .ok()
        .flatten();

        match chunk_data {
            Some(data) => assembled_bytes.extend_from_slice(&data),
            None => missing_chunks.push(chunk_sha1.clone()),
        }
    }
    let _ = tx.commit().await;

    if !missing_chunks.is_empty() {
        return Err(missing_chunks);
    }

    let release_id = releases::ensure_release(&state.pools.ingest, org_id, project_id, version)
        .await
        .map_err(|_| Vec::new())?;

    let clean_name = name.trim_start_matches("~/").trim_start_matches('/');
    let storage_dir = state
        .artifacts_dir
        .join(project_id.to_string())
        .join(version);
    let _ = tokio::fs::create_dir_all(&storage_dir).await;
    let storage_path = storage_dir.join(clean_name.replace('/', "_"));

    let _ = tokio::fs::write(&storage_path, &assembled_bytes).await;

    let path_str = storage_path.to_string_lossy().to_string();

    releases::upsert_artifact_with_debug_id(
        &state.pools.ingest,
        org_id,
        release_id,
        name,
        &path_str,
        checksum,
        debug_id,
    )
    .await
    .map_err(|_| Vec::new())?;

    Ok(())
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
