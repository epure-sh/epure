use chrono::{DateTime, Timelike, Utc};
use epure_demangle::demangle_stack_frames;
use epure_envelope::{
    breadcrumbs_to_json, compute_fingerprint, decompress_store_payload, extract_breadcrumbs,
    normalize_metadata, scrub_event,
};
use epure_storage::PgPool;
use epure_storage::{counters, events, issues, persist, releases, unique_users};
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc::Receiver;
use tracing::{error, warn};
use uuid::Uuid;

use crate::lifecycle::{process, velocity::VelocityTracker};

use super::mpsc::IngestJob;

const BATCH_FLUSH_INTERVAL: Duration = Duration::from_millis(500);

static LOST_EVENTS: AtomicU64 = AtomicU64::new(0);

pub fn lost_event_count() -> u64 {
    LOST_EVENTS.load(Ordering::Relaxed)
}

fn record_lost_event(reason: &str) {
    let total = LOST_EVENTS.fetch_add(1, Ordering::Relaxed) + 1;
    error!(total, reason, "ingest dropped event after accept");
}

fn sanitize_error(err: &dyn std::error::Error) -> String {
    let text = err.to_string();
    if text.contains("timed out") || text.contains("timeout") {
        return "pool timeout".into();
    }
    if text.contains("error returned from database") || text.contains("database") {
        return "database error".into();
    }
    if text.contains("malformed") || text.contains("invalid") || text.contains("decompress") {
        return "validation error".into();
    }
    "worker error".into()
}

fn is_transient(err: &dyn std::error::Error) -> bool {
    let text = err.to_string();
    text.contains("timed out")
        || text.contains("timeout")
        || text.contains("connection reset")
        || text.contains("40001")
        || text.contains("40P01")
}

pub async fn run_worker(
    pool: PgPool,
    artifacts_dir: PathBuf,
    velocity_tracker: Arc<VelocityTracker>,
    mut rx: Receiver<IngestJob>,
) {
    let mut flush_interval = tokio::time::interval(BATCH_FLUSH_INTERVAL);
    flush_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    loop {
        tokio::select! {
            job = rx.recv() => {
                match job {
                    Some(job) => {
                        if let Err(err) = process_job_with_retry(
                            &pool,
                            &artifacts_dir,
                            &velocity_tracker,
                            job,
                        ).await {
                            record_lost_event(&sanitize_error(err.as_ref()));
                        }
                    }
                    None => {
                        warn!("ingest worker channel closed");
                        break;
                    }
                }
            }
            _ = flush_interval.tick() => {}
        }
    }
}

async fn process_job_with_retry(
    pool: &PgPool,
    artifacts_dir: &Path,
    velocity_tracker: &Arc<VelocityTracker>,
    job: IngestJob,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    match process_job(pool, artifacts_dir, velocity_tracker, job.clone()).await {
        Ok(()) => Ok(()),
        Err(err) if is_transient(err.as_ref()) => {
            warn!("ingest worker retrying transient error");
            process_job(pool, artifacts_dir, velocity_tracker, job).await
        }
        Err(err) => Err(err),
    }
}

async fn process_job(
    pool: &PgPool,
    artifacts_dir: &Path,
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
            let (prior, issue_id) = persist::persist_counter_only(
                pool,
                persist::PersistCounterOnly {
                    org_id,
                    project_id,
                    fingerprint,
                    occurred_at: now,
                    window_start: window_hour_start(now),
                },
            )
            .await?;

            if let Err(err) =
                process::after_issue_event(pool, velocity_tracker, prior, org_id, issue_id, None)
                    .await
            {
                warn!(
                    issue_id = %issue_id,
                    error = sanitize_error(err.as_ref()),
                    "lifecycle after counter-only failed"
                );
            }
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

            let stack_frames =
                demangle_event_frames(pool, artifacts_dir, org_id, project_id, &payload_json)
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
            let user_key =
                unique_users::user_key(metadata.user_id.as_deref(), metadata.user_email.as_deref());

            let outcome = persist::persist_store_event(
                pool,
                persist::PersistStoreEvent {
                    upsert: issues::UpsertIssueParams {
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
                    event: events::InsertEventParams {
                        id: event_id,
                        org_id,
                        project_id,
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
                        stack_frames: Some(stack_frames),
                        breadcrumbs: Some(breadcrumbs_json),
                    },
                    user_key,
                    counter: counters::SyncCounterParams {
                        project_id,
                        fingerprint,
                        window_start: window_hour_start(now),
                        count_delta: 1,
                        bodies_stored_delta: 1,
                    },
                },
            )
            .await?;

            if let Err(err) = process::after_issue_event(
                pool,
                velocity_tracker,
                outcome.prior,
                org_id,
                outcome.issue_id,
                release.clone(),
            )
            .await
            {
                warn!(
                    issue_id = %outcome.issue_id,
                    error = sanitize_error(err.as_ref()),
                    "lifecycle after store failed"
                );
            }

            if outcome.new_unique_user {
                if let Err(err) = process::after_unique_user_recorded(
                    pool,
                    org_id,
                    outcome.issue_id,
                    outcome.prior_user_count,
                )
                .await
                {
                    warn!(
                        issue_id = %outcome.issue_id,
                        error = sanitize_error(err.as_ref()),
                        "lifecycle after unique user failed"
                    );
                }
            }
        }
    }

    Ok(())
}

async fn demangle_event_frames(
    pool: &PgPool,
    artifacts_dir: &Path,
    org_id: Uuid,
    project_id: Uuid,
    event: &Value,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let platform = event.get("platform").and_then(Value::as_str).unwrap_or("");
    if platform != "javascript" && platform != "typescript" && platform != "node" {
        return Ok(raw_stack_frames(event));
    }

    let Some(release) = event.get("release").and_then(Value::as_str) else {
        return Ok(raw_stack_frames(event));
    };

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
            releases::find_artifact_for_map(pool, org_id, project_id, release, &map_name).await
        {
            artifact_paths.insert(map_name, PathBuf::from(artifact.storage_path));
        }
    }

    let artifacts_dir = artifacts_dir.to_path_buf();
    let release = release.to_string();
    let demangled = tokio::task::spawn_blocking(move || {
        demangle_stack_frames(
            &raw_frames,
            &artifacts_dir,
            &project_id_str,
            &release,
            &|map_name| artifact_paths.get(map_name).cloned(),
        )
    })
    .await?;

    Ok(serde_json::to_value(demangled)?)
}

fn raw_stack_frames(event: &Value) -> Value {
    Value::Array(exception_frames(event))
}

fn exception_frames(event: &Value) -> Vec<Value> {
    if let Some(values) = event.pointer("/exception/values").and_then(Value::as_array) {
        if let Some(first) = values.first() {
            if let Some(frames) = first
                .pointer("/stacktrace/frames")
                .and_then(Value::as_array)
            {
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
