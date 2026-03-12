mod support;

use std::time::Duration;

use support::{auth_header, project_id, spawn_test_server};
use uuid::Uuid;

fn velocity_payload() -> serde_json::Value {
    serde_json::json!({
        "fingerprint": ["velocity-proof"],
        "platform": "python",
        "level": "error",
        "exception": {
            "values": [{
                "type": "VelocityProofError",
                "value": "burst"
            }]
        },
        "environment": "production"
    })
}

async fn ingest_store(client: &reqwest::Client, base_url: &str, count: usize) {
    let payload = velocity_payload();
    for _ in 0..count {
        let response = client
            .post(format!("{base_url}/api/{}/store/", project_id()))
            .header("X-Sentry-Auth", auth_header())
            .header("Content-Type", "application/json")
            .body(payload.to_string())
            .send()
            .await
            .expect("store ingest");
        assert_eq!(response.status(), reqwest::StatusCode::ACCEPTED);
    }
}

#[tokio::test]
async fn burst_ingest_persists_velocity_spike_alert() {
    std::env::set_var("EPURE_VELOCITY_WINDOW_SECS", "1");

    let (base_url, pool, server) = spawn_test_server().await;
    let client = reqwest::Client::new();

    ingest_store(&client, &base_url, 5).await;
    tokio::time::sleep(Duration::from_millis(1200)).await;
    ingest_store(&client, &base_url, 25).await;
    tokio::time::sleep(Duration::from_millis(900)).await;

    let fingerprint = epure_envelope::compute_fingerprint(&velocity_payload());
    let issue_id: Uuid = sqlx::query_scalar(
        r#"
        SELECT id FROM issues
        WHERE project_id = $1 AND fingerprint = $2
        "#,
    )
    .bind(project_id())
    .bind(fingerprint)
    .fetch_one(&pool)
    .await
    .expect("issue row");

    let alert_count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint
        FROM alerts
        WHERE issue_id = $1 AND kind = 'velocity_spike'
        "#,
    )
    .bind(issue_id)
    .fetch_one(&pool)
    .await
    .expect("velocity alert count");
    assert!(alert_count >= 1, "expected velocity_spike alert row");

    server.abort();
}
