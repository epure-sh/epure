mod support;

use std::time::Duration;

use support::{auth_header, project_id, spawn_test_server};
use uuid::Uuid;

#[tokio::test]
async fn user_feedback_links_to_event_and_scrubs_email() {
    let (base_url, pool, server) = spawn_test_server().await;
    let client = reqwest::Client::new();

    let payload = serde_json::json!({
        "fingerprint": ["feedback-proof"],
        "platform": "python",
        "level": "error",
        "exception": {
            "values": [{
                "type": "FeedbackProofError",
                "value": "crash"
            }]
        },
        "environment": "production"
    });

    let ingest = client
        .post(format!("{base_url}/api/{}/store/", project_id()))
        .header("X-Sentry-Auth", auth_header())
        .header("Content-Type", "application/json")
        .body(payload.to_string())
        .send()
        .await
        .expect("store ingest");
    assert_eq!(ingest.status(), 202);

    let body: serde_json::Value = ingest.json().await.expect("ingest json");
    let event_id = Uuid::parse_str(
        body.get("id")
            .and_then(|value| value.as_str())
            .expect("event id"),
    )
    .expect("uuid");

    tokio::time::sleep(Duration::from_millis(700)).await;

    let feedback = client
        .post(format!("{base_url}/api/{}/user-feedback/", project_id()))
        .header("X-Sentry-Auth", auth_header())
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "event_id": event_id,
            "name": "Test User",
            "email": "Bearer secret-token-abc",
            "comments": "Happened after deploy"
        }))
        .send()
        .await
        .expect("user feedback");
    assert_eq!(feedback.status(), 201);

    let row: (Uuid, Option<String>) = sqlx::query_as(
        r#"
        SELECT event_id, email
        FROM user_feedback
        WHERE event_id = $1
        "#,
    )
    .bind(event_id)
    .fetch_one(&pool)
    .await
    .expect("feedback row");

    assert_eq!(row.0, event_id);
    assert_eq!(
        row.1.as_deref(),
        Some("Bearer [REDACTED]"),
        "feedback email should be scrubbed"
    );

    server.abort();
}
