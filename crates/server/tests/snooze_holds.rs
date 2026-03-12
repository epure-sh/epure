mod support;

use std::time::Duration;

use epure_storage::issues;
use reqwest::Client;
use support::{auth_header, project_id, spawn_test_server, spawn_webhook_capture};
use uuid::Uuid;

const DEV_PASSWORD: &str = "devpassword";

#[tokio::test]
async fn snoozed_issue_regresses_without_webhook() {
    let (webhook_url, webhook_handle, webhook_events) = spawn_webhook_capture().await;
    let (base_url, pool, server) = spawn_test_server().await;
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("cookie client");

    let login = client
        .post(format!("{base_url}/api/v1/auth/login"))
        .json(&serde_json::json!({
            "email": "dev@epure.local",
            "password": DEV_PASSWORD
        }))
        .send()
        .await
        .expect("login");
    assert_eq!(login.status(), 204);

    let webhook = client
        .post(format!("{base_url}/api/v1/webhooks"))
        .json(&serde_json::json!({
            "project_id": project_id(),
            "url": webhook_url,
            "format": "generic",
            "events": ["regression"]
        }))
        .send()
        .await
        .expect("create webhook");
    assert_eq!(webhook.status(), 201);

    let first_payload = serde_json::json!({
        "fingerprint": ["snooze-proof"],
        "platform": "python",
        "level": "error",
        "release": "v1.0.0",
        "exception": {
            "values": [{
                "type": "SnoozeProofError",
                "value": "first occurrence"
            }]
        },
        "environment": "production"
    });

    let first = client
        .post(format!("{base_url}/api/{}/store/", project_id()))
        .header("X-Sentry-Auth", auth_header())
        .header("Content-Type", "application/json")
        .body(first_payload.to_string())
        .send()
        .await
        .expect("first ingest");
    assert_eq!(first.status(), 202);

    tokio::time::sleep(Duration::from_millis(700)).await;

    let fingerprint = epure_envelope::compute_fingerprint(&first_payload);
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

    let resolved = client
        .patch(format!("{base_url}/api/v1/issues/{issue_id}"))
        .json(&serde_json::json!({
            "status": "resolved",
            "resolved_in_release": "v1.0.0"
        }))
        .send()
        .await
        .expect("resolve issue");
    assert_eq!(resolved.status(), 200);

    let snoozed = client
        .post(format!("{base_url}/api/v1/issues/{issue_id}/snooze"))
        .json(&serde_json::json!({ "mode": "hours" }))
        .send()
        .await
        .expect("snooze issue");
    assert_eq!(snoozed.status(), 200);

    let second_payload = serde_json::json!({
        "fingerprint": ["snooze-proof"],
        "platform": "python",
        "level": "error",
        "release": "v1.1.0",
        "exception": {
            "values": [{
                "type": "SnoozeProofError",
                "value": "recurrence"
            }]
        },
        "environment": "production"
    });

    let second = client
        .post(format!("{base_url}/api/{}/store/", project_id()))
        .header("X-Sentry-Auth", auth_header())
        .header("Content-Type", "application/json")
        .body(second_payload.to_string())
        .send()
        .await
        .expect("second ingest");
    assert_eq!(second.status(), 202);

    tokio::time::sleep(Duration::from_millis(900)).await;

    let issue = issues::get_issue_by_id(
        &pool,
        Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap(),
        issue_id,
    )
    .await
    .expect("load issue")
    .expect("issue exists");
    assert_eq!(issue.status, "regression");

    {
        let captured = webhook_events.lock().expect("webhook lock");
        assert!(
            captured.is_empty(),
            "snoozed issue should not dispatch regression webhook, got: {captured:?}"
        );
    }

    let alert_count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint
        FROM alerts
        WHERE issue_id = $1 AND kind = 'regression'
        "#,
    )
    .bind(issue_id)
    .fetch_one(&pool)
    .await
    .expect("regression alert count");
    assert_eq!(
        alert_count, 0,
        "snoozed issue should not insert regression alert"
    );

    server.abort();
    webhook_handle.abort();
}

#[tokio::test]
async fn expired_snooze_restores_unresolved_on_list() {
    let (base_url, pool, server) = spawn_test_server().await;
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("cookie client");

    let login = client
        .post(format!("{base_url}/api/v1/auth/login"))
        .json(&serde_json::json!({
            "email": "dev@epure.local",
            "password": DEV_PASSWORD
        }))
        .send()
        .await
        .expect("login");
    assert_eq!(login.status(), 204);

    let payload = serde_json::json!({
        "fingerprint": ["snooze-wake"],
        "platform": "python",
        "level": "error",
        "exception": {
            "values": [{
                "type": "SnoozeWakeError",
                "value": "first"
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
        .expect("ingest");
    assert_eq!(ingest.status(), 202);
    tokio::time::sleep(Duration::from_millis(700)).await;

    let fingerprint = epure_envelope::compute_fingerprint(&payload);
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

    let snoozed = client
        .post(format!("{base_url}/api/v1/issues/{issue_id}/snooze"))
        .json(&serde_json::json!({ "mode": "hours" }))
        .send()
        .await
        .expect("snooze issue");
    assert_eq!(snoozed.status(), 200);

    let hidden = client
        .get(format!(
            "{base_url}/api/v1/issues?project_id={}&q=is:unresolved",
            project_id()
        ))
        .send()
        .await
        .expect("list while snoozed");
    assert_eq!(hidden.status(), 200);
    let hidden_body: serde_json::Value = hidden.json().await.expect("json");
    let hidden_ids: Vec<&str> = hidden_body["issues"]
        .as_array()
        .expect("issues")
        .iter()
        .filter_map(|row| row["id"].as_str())
        .collect();
    assert!(
        !hidden_ids.contains(&issue_id.to_string().as_str()),
        "snoozed issue should leave unresolved until it wakes"
    );

    sqlx::query(
        r#"
        UPDATE issues
        SET snooze_until = now() - interval '1 minute'
        WHERE id = $1
        "#,
    )
    .bind(issue_id)
    .execute(&pool)
    .await
    .expect("expire snooze");

    let woken = client
        .get(format!(
            "{base_url}/api/v1/issues?project_id={}&q=is:unresolved",
            project_id()
        ))
        .send()
        .await
        .expect("list after expiry");
    assert_eq!(woken.status(), 200);
    let body: serde_json::Value = woken.json().await.expect("json");
    let match_row = body["issues"]
        .as_array()
        .expect("issues")
        .iter()
        .find(|row| row["id"].as_str() == Some(&issue_id.to_string()))
        .expect("woken issue in unresolved");
    assert_eq!(match_row["status"], "unresolved");
    assert_eq!(match_row["snoozed"], false);

    server.abort();
}
