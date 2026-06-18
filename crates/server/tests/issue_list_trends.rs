mod support;

use epure_envelope::preview_fingerprint;
use epure_storage::events;
use std::fs;
use std::time::Duration;
use support::{auth_header, fixture_path, project_id, spawn_test_server};

#[tokio::test]
async fn issue_list_trends_returns_real_event_buckets() {
    let (base_url, pool, server) = spawn_test_server().await;
    let body = fs::read(fixture_path("browser", "envelope.txt")).expect("browser fixture");
    let fingerprint = preview_fingerprint(
        &epure_envelope::parse_envelope(&body)
            .expect("parse envelope")
            .event_payload,
    );

    let client = reqwest::Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    for _ in 0..3 {
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

    let issue_id = epure_storage::issues::get_issue_by_fingerprint(&pool, project_id(), &fingerprint)
        .await
        .expect("lookup issue")
        .expect("issue row")
        .id;

    let login = client
        .post(format!("{}/api/v1/auth/login", base_url))
        .json(&serde_json::json!({
            "email": "dev@epure.local",
            "password": "devpassword"
        }))
        .send()
        .await
        .expect("login");
    assert_eq!(login.status(), reqwest::StatusCode::NO_CONTENT);

    let trends = client
        .post(format!("{}/api/v1/issues/trends", base_url))
        .json(&serde_json::json!({ "issue_ids": [issue_id] }))
        .send()
        .await
        .expect("trends");
    assert!(trends.status().is_success(), "status {}", trends.status());
    let payload: serde_json::Value = trends.json().await.expect("json");
    let buckets = payload["trends"][0]["buckets"].as_array().expect("buckets");
    assert_eq!(buckets.len(), events::LIST_TREND_BUCKET_COUNT);
    let total = buckets
        .iter()
        .map(|bucket| bucket["count"].as_i64().unwrap_or(0))
        .sum::<i64>();
    assert!(total >= 3, "expected at least 3 stored events in trend buckets");

    server.abort();
}
