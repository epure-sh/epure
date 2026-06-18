mod support;

use epure_storage::{connect, run_migrations};
use reqwest::Client;
use support::spawn_test_server;

const DEV_PASSWORD: &str = "devpassword";

async fn login_owner(client: &Client, base_url: &str) {
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
}

async fn create_project(client: &Client, base_url: &str, name: &str) -> String {
    let create = client
        .post(format!("{base_url}/api/v1/projects"))
        .json(&serde_json::json!({ "name": name }))
        .send()
        .await
        .expect("create project");
    assert!(create.status().is_success(), "status {}", create.status());
    let project: serde_json::Value = create.json().await.expect("json");
    project["id"].as_str().expect("project id").to_string()
}

#[tokio::test]
async fn setup_progress_defaults_incomplete() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url)
        .await
        .expect("connect migrate pool");
    run_migrations(&migrate_pool)
        .await
        .expect("run migrations");

    let (base_url, _pool, _handle) = spawn_test_server().await;
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    login_owner(&client, &base_url).await;

    let pid = create_project(&client, &base_url, "Setup Default Test").await;
    let response = client
        .get(format!("{base_url}/api/v1/setup?project_id={pid}"))
        .send()
        .await
        .expect("get setup");
    assert_eq!(response.status(), 200);
    let body: serde_json::Value = response.json().await.expect("json");
    assert_eq!(body["project_named"], false);
    assert_eq!(body["complete"], false);
}

#[tokio::test]
async fn setup_progress_patch_advances_steps() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url)
        .await
        .expect("connect migrate pool");
    run_migrations(&migrate_pool)
        .await
        .expect("run migrations");

    let (base_url, _pool, _handle) = spawn_test_server().await;
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    login_owner(&client, &base_url).await;

    let pid = create_project(&client, &base_url, "Setup Patch Test").await;
    let create_key = client
        .post(format!("{base_url}/api/v1/projects/{pid}/dsn-keys"))
        .json(&serde_json::json!({ "label": "default" }))
        .send()
        .await
        .expect("create dsn");
    assert!(create_key.status().is_success(), "status {}", create_key.status());

    let patch = client
        .patch(format!("{base_url}/api/v1/setup"))
        .json(&serde_json::json!({
            "project_id": pid,
            "project_named": true,
            "dsn_copied": true
        }))
        .send()
        .await
        .expect("patch setup");
    assert_eq!(patch.status(), 200);
    let body: serde_json::Value = patch.json().await.expect("json");
    assert_eq!(body["project_named"], true);
    assert_eq!(body["has_active_key"], true);
    assert!(body["dsn_copied_at"].is_string());
    assert_eq!(body["complete"], false);

    let test = client
        .post(format!("{base_url}/api/v1/setup/test-event?project_id={pid}"))
        .send()
        .await
        .expect("test event");
    assert_eq!(test.status(), 202);

    for _ in 0..20 {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        let setup = client
            .get(format!("{base_url}/api/v1/setup?project_id={pid}"))
            .send()
            .await
            .expect("get setup");
        let done: serde_json::Value = setup.json().await.expect("json");
        if done["complete"].as_bool() == Some(true) {
            return;
        }
    }
    panic!("expected setup to complete after test event");
}

#[tokio::test]
async fn headline_stats_returns_counts_for_fresh_project() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url)
        .await
        .expect("connect migrate pool");
    run_migrations(&migrate_pool)
        .await
        .expect("run migrations");

    let (base_url, _pool, _handle) = spawn_test_server().await;
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    login_owner(&client, &base_url).await;

    let pid = create_project(&client, &base_url, "Stats UX Test").await;
    let response = client
        .get(format!(
            "{base_url}/api/v1/stats?project_id={pid}&environment=production"
        ))
        .send()
        .await
        .expect("get stats");
    assert_eq!(response.status(), 200);
    let body: serde_json::Value = response.json().await.expect("json");
    assert_eq!(body["unresolved"], 0);
    assert_eq!(body["events_7d"], 0);
    assert_eq!(body["regressions"], 0);
    assert_eq!(body["snoozed"], 0);
}

#[tokio::test]
async fn setup_test_event_creates_issue() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url)
        .await
        .expect("connect migrate pool");
    run_migrations(&migrate_pool)
        .await
        .expect("run migrations");

    let (base_url, _pool, _handle) = spawn_test_server().await;
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    login_owner(&client, &base_url).await;

    let pid = create_project(&client, &base_url, "Setup Test Event").await;
    let create_key = client
        .post(format!("{base_url}/api/v1/projects/{pid}/dsn-keys"))
        .json(&serde_json::json!({ "label": "default" }))
        .send()
        .await
        .expect("create dsn");
    assert!(create_key.status().is_success(), "status {}", create_key.status());

    let test = client
        .post(format!("{base_url}/api/v1/setup/test-event?project_id={pid}"))
        .send()
        .await
        .expect("test event");
    assert_eq!(test.status(), 202);
    let body: serde_json::Value = test.json().await.expect("json");
    assert_eq!(body["accepted"], true);

    for _ in 0..20 {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        let issues = client
            .get(format!("{base_url}/api/v1/issues?project_id={pid}&q=is:unresolved"))
            .send()
            .await
            .expect("issues");
        if issues.status().is_success() {
            let body: serde_json::Value = issues.json().await.expect("json");
            if body["issues"]
                .as_array()
                .map(|a| !a.is_empty())
                .unwrap_or(false)
            {
                return;
            }
        }
    }
    panic!("expected issue after setup test event");
}

#[tokio::test]
async fn dashboard_ux_requires_session() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url)
        .await
        .expect("connect migrate pool");
    run_migrations(&migrate_pool)
        .await
        .expect("run migrations");

    let (base_url, _pool, _handle) = spawn_test_server().await;
    let client = Client::new();
    let pid = uuid::Uuid::new_v4();

    let setup = client
        .get(format!("{base_url}/api/v1/setup?project_id={pid}"))
        .send()
        .await
        .expect("setup");
    assert_eq!(setup.status(), 401);

    let stats = client
        .get(format!("{base_url}/api/v1/stats?project_id={pid}"))
        .send()
        .await
        .expect("stats");
    assert_eq!(stats.status(), 401);
}
