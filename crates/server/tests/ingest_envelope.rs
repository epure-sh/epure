mod support;

use epure_envelope::preview_fingerprint;
use epure_storage::{counters, events};
use std::fs;
use std::time::Duration;
use support::{auth_header, fixture_path, project_id, spawn_test_server};

#[tokio::test]
async fn envelope_ingest_persists_issue_row() {
    let (base_url, pool, server) = spawn_test_server().await;
    let body = fs::read(fixture_path("browser", "envelope.txt")).expect("browser fixture");
    let fingerprint = preview_fingerprint(
        &epure_envelope::parse_envelope(&body)
            .expect("parse envelope")
            .event_payload,
    );

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/api/{}/envelope/", base_url, project_id()))
        .header("X-Sentry-Auth", auth_header())
        .header("Content-Type", "application/x-sentry-envelope")
        .body(body)
        .send()
        .await
        .expect("post envelope");

    assert_eq!(response.status(), reqwest::StatusCode::ACCEPTED);

    tokio::time::sleep(Duration::from_millis(500)).await;

    let event_count = counters::total_event_count_for_fingerprint(&pool, project_id(), &fingerprint)
        .await
        .expect("issue count");
    assert!(event_count >= 1);

    let events = events::count_events_for_project(&pool, project_id())
        .await
        .expect("events count");
    assert!(events >= 1);

    server.abort();
}
