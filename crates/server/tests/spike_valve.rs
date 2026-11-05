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
    let count_before =
        counters::total_event_count_for_fingerprint(&pool, project_id(), &fingerprint)
            .await
            .expect("count before");

    // A real flood carries a distinct SDK event ID per event; reusing one ID
    // would be an SDK retry, which durable ingest correctly counts once.
    let original_id = serde_json::from_slice::<serde_json::Value>(
        body.split(|b| *b == b'\n').next().expect("envelope header"),
    )
    .expect("header json")["event_id"]
        .as_str()
        .expect("event id")
        .to_string();
    let text = String::from_utf8(body.clone()).expect("utf8 envelope");

    let client = reqwest::Client::new();
    let flood_started = std::time::Instant::now();
    for _ in 0..150 {
        let unique = text.replace(&original_id, &uuid::Uuid::new_v4().to_string());
        let response = client
            .post(format!("{}/api/{}/envelope/", base_url, project_id()))
            .header("X-Sentry-Auth", auth_header())
            .header("Content-Type", "application/x-sentry-envelope")
            .body(unique)
            .send()
            .await
            .expect("post envelope");
        assert_eq!(response.status(), reqwest::StatusCode::ACCEPTED);
    }

    let deadline = tokio::time::Instant::now() + Duration::from_secs(30);
    let mut event_count = count_before;
    while tokio::time::Instant::now() < deadline {
        event_count =
            counters::total_event_count_for_fingerprint(&pool, project_id(), &fingerprint)
                .await
                .expect("issue count");
        if event_count - count_before >= 150 {
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    assert!(
        event_count - count_before >= 150,
        "expected 150 counter increments, got {}",
        event_count - count_before
    );

    let stored_events = events::count_events_for_project(&pool, project_id())
        .await
        .expect("events count");
    let stored_delta = stored_events - events_before;
    assert!(stored_delta < 150);
    // The exact-repeat bucket holds 100 and refills at 100/min while we post,
    // so a slow runner legitimately stores a few more than 100.
    let refill = (flood_started.elapsed().as_secs_f64() * 100.0 / 60.0).ceil() as i64;
    assert!(
        stored_delta <= 100 + refill + 1,
        "stored {stored_delta} bodies, allowed {} (refill {refill})",
        100 + refill + 1
    );

    server.abort();
}
