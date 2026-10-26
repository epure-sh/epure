mod support;

use epure_core::PlanTier;
use epure_storage::{connect, connect_pools, run_migrations};
use std::fs;
use support::{auth_header, fixture_path, project_id, spawn_test_server};
use uuid::Uuid;

fn dev_org() -> Uuid {
    Uuid::parse_str("11111111-1111-1111-1111-111111111111").expect("dev org")
}

async fn seed_monthly_stored_events(pool: &sqlx::PgPool, count: i64) {
    let issue_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO issues (id, org_id, project_id, fingerprint, title, status, first_seen_at, last_seen_at)
        VALUES ($1, $2, $3, $4, 'plan limit test', 'unresolved', now(), now())
        "#,
    )
    .bind(issue_id)
    .bind(dev_org())
    .bind(project_id())
    .bind(format!("plan-limit-test-{}", issue_id))
    .execute(pool)
    .await
    .expect("insert issue");

    sqlx::query(
        r#"
        INSERT INTO events (id, org_id, project_id, issue_id, occurred_at, payload_json, created_at)
        SELECT gen_random_uuid(), $1, $2, $3, now(), '{}'::jsonb, now()
        FROM generate_series(1, $4)
        "#,
    )
    .bind(dev_org())
    .bind(project_id())
    .bind(issue_id)
    .bind(count)
    .execute(pool)
    .await
    .expect("bulk insert events");
}

#[tokio::test]
async fn ingest_plan_limit_exceeded_returns_403() {
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

    let limit = PlanTier::Pro.monthly_events() as i64;
    sqlx::query("UPDATE organizations SET plan_tier = 'pro' WHERE id = $1")
        .bind(dev_org())
        .execute(&migrate_pool)
        .await
        .expect("set pro plan");

    seed_monthly_stored_events(&migrate_pool, limit).await;

    let (base_url, pool, handle) = spawn_test_server().await;

    let client = reqwest::Client::new();
    let body = fs::read(fixture_path("browser", "envelope.txt")).expect("browser fixture");

    let response = client
        .post(format!("{base_url}/api/{}/envelope/", project_id()))
        .header("X-Sentry-Auth", auth_header())
        .header("Content-Type", "application/x-sentry-envelope")
        .body(body)
        .send()
        .await
        .expect("ingest at plan limit");

    assert_eq!(response.status(), reqwest::StatusCode::FORBIDDEN);
    let error: serde_json::Value = response.json().await.expect("error json");
    assert_eq!(
        error.get("error").and_then(|v| v.as_str()),
        Some("ingest_plan_limit_exceeded")
    );

    sqlx::query("DELETE FROM events WHERE org_id = $1")
        .bind(dev_org())
        .execute(&pool)
        .await
        .expect("cleanup events");
    sqlx::query("DELETE FROM issues WHERE org_id = $1 AND fingerprint LIKE 'plan-limit-test-%'")
        .bind(dev_org())
        .execute(&pool)
        .await
        .expect("cleanup issues");
    sqlx::query("UPDATE organizations SET plan_tier = 'oss' WHERE id = $1")
        .bind(dev_org())
        .execute(&pool)
        .await
        .expect("restore plan tier");

    handle.abort();
}
