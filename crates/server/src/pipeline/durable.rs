use super::mpsc::IngestJob;
use epure_storage::{ingest_queue, PgPool};

/// PostgreSQL commit is the acknowledgement boundary. MPSC is just a wake-up hint.
pub async fn enqueue(pool: &PgPool, mut job: IngestJob) -> Result<bool, sqlx::Error> {
    let (org, project, event) = match &mut job {
        IngestJob::StoreEvent {
            org_id,
            project_id,
            event_id,
            payload,
            ..
        } => {
            let mut value: serde_json::Value = serde_json::from_slice(payload)
                .map_err(|e| sqlx::Error::Protocol(e.to_string()))?;
            let timestamp = epure_envelope::event_occurred_at(&value)
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok())
                .map(|t| t.with_timezone(&chrono::Utc))
                .unwrap_or_else(chrono::Utc::now);
            value["timestamp"] = timestamp.to_rfc3339().into();
            if let Some(values) = value
                .pointer_mut("/exception/values")
                .and_then(serde_json::Value::as_array_mut)
            {
                for exception in values.iter_mut() {
                    if let Some(frames) = exception
                        .pointer_mut("/stacktrace/frames")
                        .and_then(serde_json::Value::as_array_mut)
                    {
                        if frames.len() > 128 {
                            frames.drain(..frames.len() - 128);
                        }
                    }
                }
            }
            if let Some(frames) = value
                .pointer_mut("/stacktrace/frames")
                .and_then(serde_json::Value::as_array_mut)
            {
                if frames.len() > 128 {
                    frames.drain(..frames.len() - 128);
                }
            }
            let store =
                epure_storage::projects::ingest_store_end_user_identifiers(pool, *project_id)
                    .await
                    .unwrap_or(false);
            epure_envelope::apply_privacy_policy(
                &mut value,
                epure_envelope::PrivacyPolicy {
                    store_end_user_identifiers: store,
                },
            );
            *payload =
                serde_json::to_vec(&value).map_err(|e| sqlx::Error::Protocol(e.to_string()))?;
            (*org_id, *project_id, *event_id)
        }
        IngestJob::CounterOnly {
            org_id, project_id, ..
        } => {
            return Err(sqlx::Error::Protocol(format!(
                "counter requires its SDK receipt identity: {org_id}/{project_id}"
            )))
        }
    };
    let value = serde_json::to_value(job).map_err(|e| sqlx::Error::Protocol(e.to_string()))?;
    enqueue_value(pool, org, project, event, value).await
}
pub async fn enqueue_counter(
    pool: &PgPool,
    org: uuid::Uuid,
    project: uuid::Uuid,
    event: uuid::Uuid,
    fingerprint: String,
) -> Result<bool, sqlx::Error> {
    let value = serde_json::to_value(IngestJob::CounterOnly {
        org_id: org,
        project_id: project,
        fingerprint,
    })
    .map_err(|e| sqlx::Error::Protocol(e.to_string()))?;
    enqueue_value(pool, org, project, event, value).await
}
async fn enqueue_value(
    pool: &PgPool,
    org: uuid::Uuid,
    project: uuid::Uuid,
    event: uuid::Uuid,
    value: serde_json::Value,
) -> Result<bool, sqlx::Error> {
    match ingest_queue::enqueue(pool, org, project, event, value)
        .await?
        .as_str()
    {
        "accepted" => Ok(true),
        "duplicate" => Ok(false),
        "cap" => Err(sqlx::Error::Protocol("project ingest cap".into())),
        _ => Err(sqlx::Error::Protocol("durable ingest backlog full".into())),
    }
}
