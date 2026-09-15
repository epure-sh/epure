mod support;

use epure_envelope::preview_fingerprint;
use epure_storage::{counters, events};
use std::fs;
use std::time::Duration;
use support::{auth_header, fixture_path, project_id, spawn_test_server};

#[tokio::test]
async fn store_ingest_persists_issue_row() {
    let (base_url, pool, server) = spawn_test_server().await;
    let body = fs::read(fixture_path("python", "store.json")).expect("python store fixture");
    let fingerprint = preview_fingerprint(&body);

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/api/{}/store/", base_url, project_id()))
        .header("X-Sentry-Auth", auth_header())
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .await
        .expect("post store");

    assert_eq!(response.status(), reqwest::StatusCode::ACCEPTED);

    tokio::time::sleep(Duration::from_millis(500)).await;

    let event_count = counters::total_event_count_for_fingerprint(&pool, project_id(), &fingerprint)
        .await
        .expect("issue count");
    assert!(event_count >= 1);

    let stored_events = events::count_events_for_project(&pool, project_id())
        .await
        .expect("events count");
    assert!(stored_events >= 1);

    server.abort();
}
