use chrono::{DateTime, Timelike, Utc};
use epure_demangle::demangle_stack_frames;
use epure_envelope::{
    breadcrumbs_to_json, compute_fingerprint, decompress_store_payload, extract_breadcrumbs,
    normalize_metadata, scrub_event,
};
use epure_storage::{batch::EventBatchWriter, counters, events, issues, releases, unique_users};
use serde_json::Value;
use epure_storage::PgPool;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc::Receiver;
use tracing::{error, warn};
use uuid::Uuid;

use crate::lifecycle::{process, velocity::VelocityTracker};

use super::mpsc::IngestJob;

const BATCH_FLUSH_INTERVAL: Duration = Duration::from_millis(500);

pub async fn run_worker(
    pool: PgPool,
    artifacts_dir: PathBuf,
    velocity_tracker: Arc<VelocityTracker>,
    mut rx: Receiver<IngestJob>,
) {
    let mut batch_writer = EventBatchWriter::new(pool.clone());
    let mut flush_interval = tokio::time::interval(BATCH_FLUSH_INTERVAL);
    flush_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    loop {
        tokio::select! {
            job = rx.recv() => {
                match job {
                    Some(job) => {
                        if let Err(err) = process_job(
                            &pool,
                            &mut batch_writer,
                            &artifacts_dir,
                            &velocity_tracker,
                            job,
                        ).await {
                            error!("ingest worker failed: {err}");
                        }
                    }
                    None => {
                        if let Err(err) = batch_writer.flush().await {
                            error!("ingest worker final flush failed: {err}");
                        }
                        warn!("ingest worker channel closed");
                        break;
                    }
                }
            }
            _ = flush_interval.tick() => {
                if let Err(err) = batch_writer.flush().await {
                    error!("ingest worker periodic flush failed: {err}");
                }
            }
        }
    }
}

async fn process_job(
    pool: &PgPool,
    batch_writer: &mut EventBatchWriter,
    artifacts_dir: &PathBuf,
    velocity_tracker: &Arc<VelocityTracker>,
    job: IngestJob,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    match job {
        IngestJob::CounterOnly {
            project_id,
            org_id,
            fingerprint,
        } => {
            let now = Utc::now();
            let prior =
                issues::get_issue_by_fingerprint(pool, project_id, &fingerprint).await?;
            let issue_id = issues::upsert_issue(
                pool,
                issues::UpsertIssueParams {
                    org_id,
                    project_id,
                    fingerprint: fingerprint.clone(),
                    title: None,
                    level: None,
                    environment: None,
                    release: None,
                    occurred_at: now,
                    increment_by: 1,
                },
            )
            .await?;

            process::after_issue_event(
                pool,
                velocity_tracker,
                prior,
                issue_id,
                None,
            )
            .await?;

            counters::sync_counter(
                pool,
                counters::SyncCounterParams {
                    project_id,
                    fingerprint,
                    window_start: window_hour_start(now),
                    count_delta: 1,
                    bodies_stored_delta: 0,
                },
            )
            .await?;
        }
        IngestJob::StoreEvent {
            event_id,
            project_id,
            org_id,
            fingerprint: _preview_fingerprint,
            payload,
            user_agent,
            client_ip,
            country_code_hint,
        } => {
            let payload = decompress_store_payload(&payload)?;
            let mut payload_json: Value = serde_json::from_slice(&payload)?;
            let now = Utc::now();

            let stack_frames = demangle_event_frames(
                pool,
                artifacts_dir,
                project_id,
                &payload_json,
            )
            .await?;

            let fingerprint = compute_fingerprint(&payload_json);
            scrub_event(&mut payload_json);
            let breadcrumbs = extract_breadcrumbs(&payload_json);
            let breadcrumbs_json = breadcrumbs_to_json(&breadcrumbs);
            let metadata = normalize_metadata(
                &payload_json,
                user_agent.as_deref(),
                client_ip.as_deref(),
                country_code_hint.as_deref(),
            );

            let release = payload_json
                .get("release")
                .and_then(Value::as_str)
                .map(str::to_string);
            let prior =
                issues::get_issue_by_fingerprint(pool, project_id, &fingerprint).await?;
            let issue_id = issues::upsert_issue(
                pool,
                issues::UpsertIssueParams {
                    org_id,
                    project_id,
                    fingerprint: fingerprint.clone(),
                    title: issues::title_from_event(&payload_json),
                    level: payload_json
                        .get("level")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                    environment: metadata.environment.clone(),
                    release: release.clone(),
                    occurred_at: now,
                    increment_by: 1,
                },
            )
            .await?;

            process::after_issue_event(
                pool,
                velocity_tracker,
                prior,
                issue_id,
                release.clone(),
            )
            .await?;

            if let Some(user_key) = unique_users::user_key(
                metadata.user_id.as_deref(),
                metadata.user_email.as_deref(),
            ) {
                let prior_user_count = issues::get_issue_by_id(pool, issue_id)
                    .await?
                    .map(|issue| issue.unique_user_count)
                    .unwrap_or(0);
                if unique_users::record_unique_user(pool, issue_id, &user_key).await? {
                    process::after_unique_user_recorded(pool, issue_id, prior_user_count).await?;
                }
            }

            batch_writer
                .push(events::InsertEventParams {
                    id: event_id,
                    org_id,
                    project_id,
                    issue_id,
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
                    stack_frames: Some(stack_frames),
                    breadcrumbs: Some(breadcrumbs_json),
                })
                .await?;

            counters::sync_counter(
                pool,
                counters::SyncCounterParams {
                    project_id,
                    fingerprint,
                    window_start: window_hour_start(now),
                    count_delta: 1,
                    bodies_stored_delta: 1,
                },
            )
            .await?;
        }
    }

    Ok(())
}

async fn demangle_event_frames(
    pool: &PgPool,
    artifacts_dir: &PathBuf,
    project_id: Uuid,
    event: &Value,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let platform = event.get("platform").and_then(Value::as_str).unwrap_or("");
    if platform != "javascript" && platform != "typescript" && platform != "node" {
        return Ok(raw_stack_frames(event));
    }

    let release = event.get("release").and_then(Value::as_str);
    if release.is_none() {
        return Ok(raw_stack_frames(event));
    }
    let release = release.expect("checked above");

    let raw_frames = exception_frames(event);
    if raw_frames.is_empty() {
        return Ok(Value::Array(Vec::new()));
    }

    let project_id_str = project_id.to_string();
    let mut artifact_paths = HashMap::new();
    for frame in &raw_frames {
        let Some(filename) = frame.get("filename").and_then(Value::as_str) else {
            continue;
        };
        let map_name = if filename.ends_with(".map") {
            filename.to_string()
        } else {
            format!("{filename}.map")
        };
        if artifact_paths.contains_key(&map_name) {
            continue;
        }
        if let Ok(Some(artifact)) =
            releases::find_artifact_for_map(pool, project_id, release, &map_name).await
        {
            artifact_paths.insert(map_name, PathBuf::from(artifact.storage_path));
        }
    }

    let demangled = demangle_stack_frames(
        &raw_frames,
        artifacts_dir,
        &project_id_str,
        release,
        &|map_name| artifact_paths.get(map_name).cloned(),
    );

    Ok(serde_json::to_value(demangled)?)
}

fn raw_stack_frames(event: &Value) -> Value {
    Value::Array(exception_frames(event))
}

fn exception_frames(event: &Value) -> Vec<Value> {
    if let Some(values) = event.pointer("/exception/values").and_then(Value::as_array) {
        if let Some(first) = values.first() {
            if let Some(frames) = first.pointer("/stacktrace/frames").and_then(Value::as_array) {
                return frames.clone();
            }
        }
    }

    event
        .pointer("/stacktrace/frames")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

fn window_hour_start(now: DateTime<Utc>) -> DateTime<Utc> {
    now.date_naive()
        .and_hms_opt(now.hour(), 0, 0)
        .unwrap()
        .and_utc()
}
