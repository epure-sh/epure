use chrono::{DateTime, Timelike, Utc};
use epure_demangle::sourcemap::{
    demangle_resolved_stack_frames, legacy_artifact_path, sourcemap_name,
};
use epure_envelope::{
    apply_privacy_policy, breadcrumbs_to_json, compute_canonical_grouping, culprit_from_event,
    decompress_store_payload, event_occurred_at, extract_breadcrumbs, hash_to_i64, is_unhandled,
    normalize_metadata, project_event, PrivacyPolicy,
};
use epure_storage::projects;
use epure_storage::PgPool;
use epure_storage::{events, issues, persist, releases, unique_users};
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
use crate::pipeline::spike::SpikeValve;

use super::grouping_cache::GroupingCache;
use super::mpsc::IngestJob;
use super::outcomes::OutcomeLedger;

static LOST_EVENTS: AtomicU64 = AtomicU64::new(0);

fn event_timestamp(event: &Value) -> Option<chrono::DateTime<Utc>> {
    let raw = event_occurred_at(event)?;
    chrono::DateTime::parse_from_rfc3339(&raw)
        .ok()
        .map(|time| time.with_timezone(&Utc))
}

pub fn lost_event_count() -> u64 {
    LOST_EVENTS.load(Ordering::Relaxed)
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

pub async fn run_worker(
    pool: PgPool,
    artifacts_dir: PathBuf,
    velocity_tracker: Arc<VelocityTracker>,
    grouping: Arc<GroupingCache>,
    outcomes: Arc<OutcomeLedger>,
    spike_valve: Arc<SpikeValve>,
    mut rx: Receiver<()>,
) {
    let mut interval = tokio::time::interval(Duration::from_millis(50));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    let mut closing = false;
    loop {
        tokio::select! {_ = interval.tick()=>{}, hint=rx.recv(),if !closing=>{if hint.is_none(){closing=true;}}}
        let rows = match epure_storage::ingest_queue::claim(&pool).await {
            Ok(rows) => rows,
            Err(err) => {
                error!(error=%err,"durable queue claim failed");
                if closing {
                    break;
                }
                continue;
            }
        };
        if rows.is_empty() {
            if closing {
                break;
            }
            continue;
        }
        let mut stores = Vec::new();
        let mut counters = Vec::new();
        for row in rows {
            match row
                .job
                .clone()
                .and_then(|v| serde_json::from_value::<IngestJob>(v).ok())
            {
                Some(IngestJob::CounterOnly { .. }) => counters.push(row),
                Some(job) => stores.push((row, job)),
                None => {
                    let _ = epure_storage::ingest_queue::retry(&pool, &row, "invalid durable job")
                        .await;
                }
            }
        }
        if !stores.is_empty() {
            let jobs = stores.iter().map(|(_, j)| j.clone()).collect();
            let batch = process_batch(
                &pool,
                &artifacts_dir,
                &velocity_tracker,
                &grouping,
                &outcomes,
                &spike_valve,
                jobs,
            )
            .await;
            for (row, job) in stores {
                let result = if batch.is_ok() {
                    Ok(())
                } else {
                    process_batch(
                        &pool,
                        &artifacts_dir,
                        &velocity_tracker,
                        &grouping,
                        &outcomes,
                        &spike_valve,
                        vec![job],
                    )
                    .await
                    .map_err(|e| sanitize_error(e.as_ref()))
                };
                match result {
                    Ok(()) => {
                        if let Err(err) = epure_storage::ingest_queue::finish(&pool, &row).await {
                            warn!(error=%err,"receipt finish will recover after lease expiry");
                        }
                    }
                    Err(err) => {
                        let _ = epure_storage::ingest_queue::retry(&pool, &row, &err).await;
                    }
                }
            }
        }
        if !counters.is_empty() {
            match epure_storage::ingest_queue::apply_counter_batch(&pool, &counters).await {
                Ok(done) => {
                    let done: std::collections::HashSet<_> = done.into_iter().collect();
                    for row in counters {
                        if !done.contains(&row.event_id) {
                            let _ = epure_storage::ingest_queue::retry(
                                &pool,
                                &row,
                                "waiting for canonical issue",
                            )
                            .await;
                        }
                    }
                }
                Err(err) => {
                    error!(error=%err,"durable counter batch retained");
                    for row in counters {
                        let _ = epure_storage::ingest_queue::retry(
                            &pool,
                            &row,
                            "counter batch database error",
                        )
                        .await;
                    }
                }
            }
        }
    }
}

async fn process_batch(
    pool: &PgPool,
    artifacts_dir: &Path,
    velocity_tracker: &Arc<VelocityTracker>,
    _grouping: &Arc<GroupingCache>,
    outcomes: &Arc<OutcomeLedger>,
    _spike_valve: &Arc<SpikeValve>,
    jobs: Vec<IngestJob>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut events_to_persist = Vec::with_capacity(jobs.len());
    let mut configs = HashMap::<Uuid, Vec<String>>::new();
    let mut post_ops = Vec::with_capacity(jobs.len());

    for job in jobs {
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

                if let Err(err) = process::after_issue_event(
                    pool,
                    velocity_tracker,
                    prior,
                    org_id,
                    issue_id,
                    None,
                )
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
                country_code_hint,
                accepted_at,
                client_supplied_id: _,
            } => {
                outcomes.note_lag_ms(
                    u64::try_from(accepted_at.elapsed().as_millis()).unwrap_or(u64::MAX),
                );

                let payload = decompress_store_payload(&payload)?;
                let mut payload_json: Value = serde_json::from_slice(&payload)?;

                let stack_frames =
                    demangle_event_frames(pool, artifacts_dir, org_id, project_id, &payload_json)
                        .await?;

                let store_identifiers = match projects::ingest_store_end_user_identifiers(
                    pool, project_id,
                )
                .await
                {
                    Ok(value) => value,
                    Err(err) => {
                        warn!(
                            error = %err,
                            "privacy flag lookup failed; storing event without end-user identifiers"
                        );
                        false
                    }
                };

                let now = event_timestamp(&payload_json).unwrap_or_else(Utc::now);

                let mut grouping_event = payload_json.clone();
                if let Some(frames) = stack_frames.as_array() {
                    if let Some(values) = grouping_event
                        .pointer_mut("/exception/values")
                        .and_then(Value::as_array_mut)
                    {
                        if let Some(first) = values.first_mut() {
                            first["stacktrace"]["frames"] = Value::Array(frames.clone());
                        }
                    } else {
                        grouping_event["stacktrace"] = serde_json::json!({"frames":frames});
                    }
                }
                // Stage 2 Canonical Grouping with Wrapper Elision & 4-Band LSH
                if let std::collections::hash_map::Entry::Vacant(entry) = configs.entry(project_id)
                {
                    let mut tx = epure_storage::rls::begin_ingest_transaction(pool, org_id).await?;
                    let config: Value =
                        sqlx::query_scalar("SELECT grouping_config FROM projects WHERE id=$1")
                            .bind(project_id)
                            .fetch_one(&mut *tx)
                            .await?;
                    tx.commit().await?;
                    let includes = config
                        .get("in_app_include")
                        .and_then(Value::as_array)
                        .into_iter()
                        .flatten()
                        .filter_map(Value::as_str)
                        .take(32)
                        .map(|s| s.chars().take(256).collect())
                        .collect();
                    entry.insert(includes);
                }
                let (multi, meta) = compute_canonical_grouping(
                    &grouping_event,
                    project_id,
                    configs.get(&project_id).map(Vec::as_slice),
                    None,
                    None,
                );

                let fingerprint = epure_storage::ingest_queue::resolve_grouping(
                    pool,
                    org_id,
                    project_id,
                    &_preview_fingerprint,
                    &multi,
                )
                .await?;
                let unhandled = is_unhandled(&payload_json);
                let platform = payload_json
                    .get("platform")
                    .and_then(Value::as_str)
                    .map(str::to_string);

                apply_privacy_policy(
                    &mut payload_json,
                    PrivacyPolicy {
                        store_end_user_identifiers: store_identifiers,
                    },
                );

                let title = issues::title_from_event(&payload_json);
                let stored_event = project_event(&payload_json, &now.to_rfc3339());
                let culprit = culprit_from_event(&stored_event);
                payload_json = stored_event;
                let breadcrumbs = extract_breadcrumbs(&payload_json);
                let breadcrumbs_json = breadcrumbs_to_json(&breadcrumbs);
                let metadata = normalize_metadata(
                    &payload_json,
                    user_agent.as_deref(),
                    country_code_hint.as_deref(),
                );

                let release = payload_json
                    .get("release")
                    .and_then(Value::as_str)
                    .map(str::to_string);
                let username = payload_json
                    .pointer("/user/username")
                    .and_then(Value::as_str)
                    .map(str::to_string);
                let user_key = unique_users::user_key(
                    metadata.user_id.as_deref(),
                    metadata.user_email.as_deref(),
                )
                .or(username);

                let prior =
                    issues::get_issue_by_fingerprint(pool, org_id, project_id, &fingerprint)
                        .await?;
                // Zero Sequence Burn on Issue Conflict
                let issue_id = {
                    let mut grouping_anchor = multi.anchor_json();
                    if let Ok(meta_json) = serde_json::to_value(&meta) {
                        grouping_anchor["meta"] = meta_json;
                    }

                    let upsert_params = issues::UpsertIssueParams {
                        org_id,
                        project_id,
                        fingerprint: fingerprint.clone(),
                        title: title.or_else(|| issues::title_from_event(&payload_json)),
                        level: payload_json
                            .get("level")
                            .and_then(Value::as_str)
                            .map(str::to_string),
                        environment: metadata.environment.clone(),
                        release: release.clone(),
                        occurred_at: now,
                        increment_by: 1,
                        rollup: issues::IssueRollup {
                            culprit: culprit.clone(),
                            platform: platform.clone(),
                            is_unhandled: unhandled,
                            latest_event_id: Some(event_id),
                        },
                        grouping: Some(issues::IssueGrouping::hashes(
                            hash_to_i64(multi.h_exact),
                            hash_to_i64(multi.h_locus),
                            hash_to_i64(multi.h_sim),
                            multi.exception_type.clone(),
                            multi.merge_reason.to_string(),
                            grouping_anchor,
                            if multi.custom
                                || multi.variant_label.is_empty()
                                || (multi.call_path_count <= 1 && !multi.cycle_folded)
                            {
                                None
                            } else {
                                Some(multi.variant_label.clone())
                            },
                        )),
                    };

                    let (id, _is_new) = persist::resolve_or_create_issue(
                        pool,
                        org_id,
                        project_id,
                        &fingerprint,
                        &upsert_params,
                    )
                    .await?;
                    id
                };

                // Add to batch insert
                events_to_persist.push(events::InsertEventParams {
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
                });

                post_ops.push((event_id, org_id, issue_id, release, user_key, prior));
            }
        }
    }

    // Persist all batch events in a single UNNEST query
    let inserted_ids: std::collections::HashSet<Uuid> =
        persist::persist_event_batch(pool, &events_to_persist)
            .await?
            .into_iter()
            .collect();
    for event in &events_to_persist {
        if inserted_ids.contains(&event.id) {
            outcomes.record(event.org_id, event.project_id, "stored", 1);
        }
    }

    // Post-persistence lifecycle and unique user updates
    for (event_id, org_id, issue_id, release, user_key, prior) in post_ops {
        if !inserted_ids.contains(&event_id) {
            continue;
        }
        velocity_tracker.record(issue_id);
        let mut prior_user_count = 0;
        let mut new_unique_user = false;

        if let Some(uk) = user_key.as_deref() {
            prior_user_count = prior.as_ref().map(|p| p.unique_user_count).unwrap_or(0);
            match unique_users::record_unique_user(pool, org_id, issue_id, uk).await {
                Ok(value) => new_unique_user = value,
                Err(err) => {
                    warn!(issue_id = %issue_id, error = %err, "unique user update failed after commit")
                }
            }
        }

        if let Err(err) = process::after_issue_event(
            pool,
            velocity_tracker,
            prior,
            org_id,
            issue_id,
            release.clone(),
        )
        .await
        {
            warn!(
                issue_id = %issue_id,
                error = sanitize_error(err.as_ref()),
                "lifecycle after store failed"
            );
        }

        if new_unique_user {
            if let Err(err) =
                process::after_unique_user_recorded(pool, org_id, issue_id, prior_user_count).await
            {
                warn!(
                    issue_id = %issue_id,
                    error = sanitize_error(err.as_ref()),
                    "lifecycle after unique user failed"
                );
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

    let release = event
        .get("release")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty());
    let debug_images: HashMap<_, _> = event
        .pointer("/debug_meta/images")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|image| {
            if image.get("type").and_then(Value::as_str) != Some("sourcemap") {
                return None;
            }
            let code_file = image.get("code_file")?.as_str()?;
            let debug_id = Uuid::parse_str(image.get("debug_id")?.as_str()?).ok()?;
            Some((code_file, debug_id.to_string()))
        })
        .collect();
    if release.is_none() && debug_images.is_empty() {
        return Ok(raw_stack_frames(event));
    }

    let raw_frames = exception_frames(event);
    if raw_frames.is_empty() {
        return Ok(Value::Array(Vec::new()));
    }

    let project_id_str = project_id.to_string();
    let mut resolved = HashMap::<_, Option<PathBuf>>::new();
    let mut artifact_paths = Vec::with_capacity(raw_frames.len());
    for frame in &raw_frames {
        let abs_path = frame.get("abs_path").and_then(Value::as_str);
        let filename = frame.get("filename").and_then(Value::as_str).or(abs_path);
        let Some(filename) = filename else {
            artifact_paths.push(None);
            continue;
        };
        let code_file = abs_path.unwrap_or(filename);
        if let Some(path) = resolved.get(&(code_file, filename)) {
            artifact_paths.push(path.clone());
            continue;
        }
        let debug_id = debug_images
            .get(code_file)
            .or_else(|| debug_images.get(filename));
        let path = if let Some(debug_id) = debug_id {
            releases::find_artifact_by_debug_id(pool, org_id, project_id, debug_id)
                .await
                .ok()
                .flatten()
                .map(|artifact| PathBuf::from(artifact.storage_path))
        } else if let (Some(release), Some(name)) = (release, sourcemap_name(filename)) {
            releases::find_artifact_for_map(pool, org_id, project_id, release, &name)
                .await
                .ok()
                .flatten()
                .map(|artifact| PathBuf::from(artifact.storage_path))
                .or_else(|| legacy_artifact_path(artifacts_dir, &project_id_str, release, &name))
        } else {
            None
        };
        resolved.insert((code_file, filename), path.clone());
        artifact_paths.push(path);
    }

    let release = release.unwrap_or_default().to_string();
    let mut demangled = tokio::task::spawn_blocking(move || {
        demangle_resolved_stack_frames(&raw_frames, &project_id_str, &release, &artifact_paths)
    })
    .await?;

    for frame in &mut demangled {
        if let Some(file) = &frame.filename {
            frame.filename = Some(epure_envelope::clean_frame_filename(file));
        }
    }

    Ok(serde_json::to_value(demangled)?)
}

fn raw_stack_frames(event: &Value) -> Value {
    Value::Array(epure_envelope::normalize_stack_frames(event))
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
