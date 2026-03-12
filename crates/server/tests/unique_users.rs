mod support;

use epure_envelope::compute_fingerprint;
use epure_storage::unique_users;
use serde_json::json;
use std::time::Duration;
use support::{auth_header, project_id, spawn_test_server};
use uuid::Uuid;

const FINGERPRINT_OVERRIDE: &str = "unique-users-integration-test";

fn event_with_user(user_id: &str) -> serde_json::Value {
    json!({
        "fingerprint": [FINGERPRINT_OVERRIDE],
        "platform": "python",
        "level": "error",
        "user": { "id": user_id },
        "exception": {
            "values": [{
                "type": "ValueError",
                "value": "unique user tracking test"
            }]
        }
    })
}

#[tokio::test]
async fn duplicate_user_ids_count_once_per_issue() {
    let (base_url, pool, server) = spawn_test_server().await;
    let client = reqwest::Client::new();
    let fingerprint = compute_fingerprint(&event_with_user("user-a"));

    for user_id in ["user-a", "user-a", "user-b"] {
        let payload = serde_json::to_vec(&event_with_user(user_id)).expect("serialize event");
        let response = client
            .post(format!("{}/api/{}/store/", base_url, project_id()))
            .header("X-Sentry-Auth", auth_header())
            .header("Content-Type", "application/json")
            .body(payload)
            .send()
            .await
            .expect("post store event");

        assert_eq!(response.status(), reqwest::StatusCode::ACCEPTED);
    }

    tokio::time::sleep(Duration::from_millis(750)).await;

    let issue_id = issue_id_for_fingerprint(&pool, project_id(), &fingerprint)
        .await
        .expect("issue id");
    let unique_user_count = issue_unique_user_count(&pool, issue_id)
        .await
        .expect("unique user count");
    let unique_user_rows = unique_users::count_unique_users(&pool, issue_id)
        .await
        .expect("unique user rows");

    assert_eq!(unique_user_count, 2);
    assert_eq!(unique_user_rows, 2);

    server.abort();
}

async fn issue_id_for_fingerprint(
    pool: &sqlx::PgPool,
    project_id: Uuid,
    fingerprint: &str,
) -> Result<Uuid, sqlx::Error> {
    sqlx::query_scalar(
        r#"
        SELECT id
        FROM issues
        WHERE project_id = $1 AND fingerprint = $2 AND merge_parent_id IS NULL
        "#,
    )
    .bind(project_id)
    .bind(fingerprint)
    .fetch_one(pool)
    .await
}

async fn issue_unique_user_count(pool: &sqlx::PgPool, issue_id: Uuid) -> Result<i32, sqlx::Error> {
    sqlx::query_scalar("SELECT unique_user_count FROM issues WHERE id = $1")
        .bind(issue_id)
        .fetch_one(pool)
        .await
}
