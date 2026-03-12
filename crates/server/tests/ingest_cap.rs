mod support;

use epure_storage::{connect, connect_pools, run_migrations};
use std::fs;
use support::{auth_header, fixture_path, project_id, spawn_test_server};

#[tokio::test]
async fn ingest_cap_exceeded_returns_403() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url).await.expect("connect migrate pool");
    run_migrations(&migrate_pool).await.expect("run migrations");

    let _pools = connect_pools(&database_url).await.expect("connect pools");
    support::seed_dev_pool(&migrate_pool)
        .await
        .expect("seed dev org");

    sqlx::query(
        r#"
        UPDATE dsn_keys
        SET revoked_at = NULL
        WHERE project_id = $1 AND public_key = $2
        "#,
    )
    .bind(project_id())
    .bind(support::PUBLIC_KEY)
    .execute(&migrate_pool)
    .await
    .expect("ensure dev dsn active");

    let (base_url, _pool, handle) = spawn_test_server().await;

    sqlx::query("UPDATE projects SET ingest_cap_per_hour = 1 WHERE id = $1")
        .bind(project_id())
        .execute(&migrate_pool)
        .await
        .expect("set ingest cap");

    let client = reqwest::Client::new();
    let body = fs::read(fixture_path("browser", "envelope.txt")).expect("browser fixture");

    let first = client
        .post(format!("{base_url}/api/{}/envelope/", project_id()))
        .header("X-Sentry-Auth", auth_header())
        .header("Content-Type", "application/x-sentry-envelope")
        .body(body.clone())
        .send()
        .await
        .expect("first ingest");
    assert_eq!(first.status(), reqwest::StatusCode::ACCEPTED);

    let second = client
        .post(format!("{base_url}/api/{}/envelope/", project_id()))
        .header("X-Sentry-Auth", auth_header())
        .header("Content-Type", "application/x-sentry-envelope")
        .body(body)
        .send()
        .await
        .expect("second ingest");

    assert_eq!(second.status(), reqwest::StatusCode::FORBIDDEN);
    let error: serde_json::Value = second.json().await.expect("error json");
    assert_eq!(
        error.get("error").and_then(|v| v.as_str()),
        Some("ingest_cap_exceeded")
    );

    sqlx::query("UPDATE projects SET ingest_cap_per_hour = 5000 WHERE id = $1")
        .bind(project_id())
        .execute(&migrate_pool)
        .await
        .expect("restore ingest cap");

    handle.abort();
}
