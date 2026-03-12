mod support;

use reqwest::Client;
use support::{project_id, spawn_test_server};
use uuid::Uuid;

async fn login_dev(client: &Client, base_url: &str) {
    let login = client
        .post(format!("{base_url}/api/v1/auth/login"))
        .json(&serde_json::json!({
            "email": "dev@epure.local",
            "password": "devpassword"
        }))
        .send()
        .await
        .expect("login");
    assert_eq!(login.status(), 204);
}

#[tokio::test]
async fn merge_then_split_restores_child_visibility() {
    let (base_url, pool, handle) = spawn_test_server().await;
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    login_dev(&client, &base_url).await;

    let canonical_id = Uuid::new_v4();
    let child_id = Uuid::new_v4();
    let org_id = Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap();
    let project = project_id();
    let run_id = Uuid::new_v4().simple().to_string();

    for (id, fingerprint, title) in [
        (
            canonical_id,
            format!("fp-canonical-{run_id}"),
            "Canonical issue",
        ),
        (child_id, format!("fp-child-{run_id}"), "Child issue"),
    ] {
        sqlx::query(
            r#"
            INSERT INTO issues (
                id, org_id, project_id, fingerprint, title, status,
                first_seen_at, last_seen_at, event_count
            )
            VALUES ($1, $2, $3, $4, $5, 'unresolved', now(), now(), 1)
            "#,
        )
        .bind(id)
        .bind(org_id)
        .bind(project)
        .bind(fingerprint)
        .bind(title)
        .execute(&pool)
        .await
        .expect("insert issue");
    }

    let merge = client
        .post(format!("{base_url}/api/v1/issues/merge"))
        .json(&serde_json::json!({
            "canonical_id": canonical_id,
            "merge_ids": [child_id]
        }))
        .send()
        .await
        .expect("merge");
    assert_eq!(merge.status(), 200);
    let merged_body = merge.json::<serde_json::Value>().await.expect("merge body");
    assert_eq!(merged_body["updated"], 1);

    let list_after_merge = client
        .get(format!("{base_url}/api/v1/issues"))
        .send()
        .await
        .expect("list issues");
    let issues_after_merge = list_after_merge
        .json::<serde_json::Value>()
        .await
        .expect("issues json");
    let visible_ids = issues_after_merge["issues"]
        .as_array()
        .expect("issues array")
        .iter()
        .filter_map(|row| row["id"].as_str())
        .collect::<Vec<_>>();
    assert!(visible_ids.contains(&canonical_id.to_string().as_str()));
    assert!(!visible_ids.contains(&child_id.to_string().as_str()));

    let merged_children = client
        .get(format!("{base_url}/api/v1/issues/{canonical_id}/merged"))
        .send()
        .await
        .expect("merged children");
    assert_eq!(merged_children.status(), 200);
    let children_body = merged_children
        .json::<serde_json::Value>()
        .await
        .expect("children json");
    assert_eq!(
        children_body["issues"].as_array().map(|rows| rows.len()),
        Some(1)
    );

    let split = client
        .post(format!("{base_url}/api/v1/issues/split"))
        .json(&serde_json::json!({
            "canonical_id": canonical_id,
            "split_ids": [child_id]
        }))
        .send()
        .await
        .expect("split");
    assert_eq!(split.status(), 200);
    let split_body = split.json::<serde_json::Value>().await.expect("split body");
    assert_eq!(split_body["updated"], 1);

    let list_after_split = client
        .get(format!("{base_url}/api/v1/issues"))
        .send()
        .await
        .expect("list issues after split");
    let issues_after_split = list_after_split
        .json::<serde_json::Value>()
        .await
        .expect("issues json");
    let restored_ids = issues_after_split["issues"]
        .as_array()
        .expect("issues array")
        .iter()
        .filter_map(|row| row["id"].as_str())
        .collect::<Vec<_>>();
    assert!(restored_ids.contains(&canonical_id.to_string().as_str()));
    assert!(restored_ids.contains(&child_id.to_string().as_str()));

    handle.abort();
}
