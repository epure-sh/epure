mod support;

use epure_envelope::preview_fingerprint;
use epure_storage::{counters, events};
use std::fs;
use std::time::Duration;
use support::{auth_header, fixture_path, project_id, spawn_test_server};

#[tokio::test]
async fn spike_valve_drops_bodies_under_load() {
    let (base_url, pool, server) = spawn_test_server().await;
    let body = fs::read(fixture_path("browser", "envelope.txt")).expect("browser fixture");
    let fingerprint = preview_fingerprint(
        &epure_envelope::parse_envelope(&body)
            .expect("parse envelope")
            .event_payload,
    );

    let events_before = events::count_events_for_project(&pool, project_id())
        .await
        .expect("events before");
    let count_before = counters::total_event_count_for_fingerprint(&pool, project_id(), &fingerprint)
        .await
        .expect("count before");

    let client = reqwest::Client::new();
    for _ in 0..150 {
        let response = client
            .post(format!("{}/api/{}/envelope/", base_url, project_id()))
            .header("X-Sentry-Auth", auth_header())
            .header("Content-Type", "application/x-sentry-envelope")
            .body(body.clone())
            .send()
            .await
            .expect("post envelope");
        assert_eq!(response.status(), reqwest::StatusCode::ACCEPTED);
    }

    tokio::time::sleep(Duration::from_secs(2)).await;

    let event_count = counters::total_event_count_for_fingerprint(&pool, project_id(), &fingerprint)
        .await
        .expect("issue count");
    assert!(event_count - count_before >= 150);

    let stored_events = events::count_events_for_project(&pool, project_id())
        .await
        .expect("events count");
    let stored_delta = stored_events - events_before;
    assert!(stored_delta < 150);
    assert!(stored_delta <= 100);

    server.abort();
}
