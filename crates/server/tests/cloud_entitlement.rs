//! Cloud plans: trial on signup, inactive orgs, "never go blind" quota, plan ceilings.
//! Every test runs with EPURE_CLOUD=1 against the dev org and resets it afterwards.

mod support;

use epure_core::PlanTier;
use epure_server::pipeline::ingest_plan_limit::OVER_QUOTA_GRACE_DIVISOR;
use epure_storage::{connect, run_migrations};
use reqwest::{Client, StatusCode};
use sqlx::PgPool;
use std::fs;
use std::time::Duration;
use support::{auth_header, fixture_path, project_id, spawn_test_server};
use uuid::Uuid;

const DEV_PASSWORD: &str = "devpassword";
const SEED_FINGERPRINT: &str = "cloud-entitlement-seed";

fn dev_org() -> Uuid {
    Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap()
}

async fn admin_pool() -> PgPool {
    std::env::set_var("EPURE_CLOUD", "1");
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
    let pool = connect(&url).await.expect("connect");
    run_migrations(&pool).await.expect("migrate");
    support::seed_dev_pool(&pool).await.expect("seed");
    sqlx::query("UPDATE dsn_keys SET revoked_at = NULL WHERE project_id = $1")
        .bind(project_id())
        .execute(&pool)
        .await
        .unwrap();
    reset(&pool).await;
    pool
}

async fn reset(pool: &PgPool) {
    for sql in [
        // Receipts and aliases first: leaving them would make later tests treat
        // their fixed fixture event IDs as already-ingested duplicates.
        "DELETE FROM ingest_inbox WHERE org_id = $1",
        "DELETE FROM ingest_group_aliases WHERE org_id = $1",
        "DELETE FROM events WHERE org_id = $1",
        "DELETE FROM issue_counters WHERE project_id IN (SELECT id FROM projects WHERE org_id = $1)",
        "DELETE FROM issues WHERE org_id = $1",
        "DELETE FROM monitors WHERE org_id = $1",
        "UPDATE projects SET retention_days = 30 WHERE org_id = $1",
        "UPDATE organizations SET plan_tier = 'oss', subscription_status = 'active', trial_ends_at = NULL, canary_expires_at = NULL, subscription_id = NULL WHERE id = $1",
    ] {
        sqlx::query(sql).bind(dev_org()).execute(pool).await.unwrap();
    }
    // The quota tests insert and delete ~200k events. Reclaim the dead rows now
    // so later tests on this shared database are not slowed by table bloat.
    for table in ["events", "issues", "issue_counters", "ingest_inbox"] {
        sqlx::query(&format!("VACUUM (ANALYZE) {table}"))
            .execute(pool)
            .await
            .unwrap();
    }
}

async fn set_billing(pool: &PgPool, plan: &str, status: &str, trial_ends: Option<&str>) {
    sqlx::query(
        "UPDATE organizations SET plan_tier = $2, subscription_status = $3, \
         trial_ends_at = $4::timestamptz WHERE id = $1",
    )
    .bind(dev_org())
    .bind(plan)
    .bind(status)
    .bind(trial_ends)
    .execute(pool)
    .await
    .unwrap();
}

async fn seed_stored_events(pool: &PgPool, count: i64) {
    let issue_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO issues (id, org_id, project_id, fingerprint, title, status, first_seen_at, last_seen_at) \
         VALUES ($1, $2, $3, $4, 'seed', 'unresolved', now(), now())",
    )
    .bind(issue_id)
    .bind(dev_org())
    .bind(project_id())
    .bind(SEED_FINGERPRINT)
    .execute(pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO events (id, org_id, project_id, issue_id, occurred_at, payload_json, created_at) \
         SELECT gen_random_uuid(), $1, $2, $3, now(), '{}'::jsonb, now() FROM generate_series(1, $4)",
    )
    .bind(dev_org())
    .bind(project_id())
    .bind(issue_id)
    .bind(count)
    .execute(pool)
    .await
    .unwrap();
}

async fn post_browser_event(client: &Client, base: &str) -> (StatusCode, serde_json::Value) {
    let body = fs::read(fixture_path("browser", "envelope.txt")).unwrap();
    let response = client
        .post(format!("{base}/api/{}/envelope/", project_id()))
        .header("X-Sentry-Auth", auth_header())
        .header("Content-Type", "application/x-sentry-envelope")
        .body(body)
        .send()
        .await
        .unwrap();
    let status = response.status();
    (status, response.json().await.unwrap_or_default())
}

async fn stored_events(pool: &PgPool) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM events WHERE org_id = $1")
        .bind(dev_org())
        .fetch_one(pool)
        .await
        .unwrap()
}

/// Total occurrences counted on non-seed issues.
async fn counted_occurrences(pool: &PgPool) -> i64 {
    sqlx::query_scalar(
        "SELECT COALESCE(SUM(event_count), 0)::bigint FROM issues \
         WHERE org_id = $1 AND fingerprint <> $2 AND merge_parent_id IS NULL",
    )
    .bind(dev_org())
    .bind(SEED_FINGERPRINT)
    .fetch_one(pool)
    .await
    .unwrap()
}

async fn wait_until<F, Fut>(mut check: F)
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = bool>,
{
    for _ in 0..300 {
        if check().await {
            return;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    panic!("condition not reached within 15s");
}

#[tokio::test]
async fn over_quota_keeps_first_event_of_new_issue_and_counts_repeats() {
    let pool = admin_pool().await;
    set_billing(&pool, "pro", "active", None).await;
    let limit = PlanTier::Pro.monthly_events() as i64;
    seed_stored_events(&pool, limit).await;

    let (base, _, handle) = spawn_test_server().await;
    let client = Client::new();

    // New issue past the quota: its first event is still stored.
    let (status, _) = post_browser_event(&client, &base).await;
    assert_eq!(status, StatusCode::ACCEPTED);
    wait_until(|| async { stored_events(&pool).await == limit + 1 }).await;

    // Repeat of that issue: counted, payload not stored.
    let (status, _) = post_browser_event(&client, &base).await;
    assert_eq!(status, StatusCode::ACCEPTED);
    wait_until(|| async { counted_occurrences(&pool).await == 2 }).await;
    assert_eq!(stored_events(&pool).await, limit + 1);

    handle.abort();
    reset(&pool).await;
}

#[tokio::test]
async fn grace_exhausted_refuses_new_issues() {
    let pool = admin_pool().await;
    set_billing(&pool, "pro", "active", None).await;
    let limit = PlanTier::Pro.monthly_events() as i64;
    seed_stored_events(&pool, limit + limit / OVER_QUOTA_GRACE_DIVISOR as i64).await;

    let (base, _, handle) = spawn_test_server().await;
    let (status, body) = post_browser_event(&Client::new(), &base).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["error"], "ingest_plan_limit_exceeded");

    handle.abort();
    reset(&pool).await;
}

#[tokio::test]
async fn inactive_and_expired_trial_orgs_refuse_ingest() {
    let pool = admin_pool().await;

    set_billing(&pool, "oss", "deleted", None).await;
    let (base, _, handle) = spawn_test_server().await;
    let (status, body) = post_browser_event(&Client::new(), &base).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["error"], "subscription_inactive");
    handle.abort();

    set_billing(&pool, "pro", "trialing", Some("2020-01-01T00:00:00Z")).await;
    let (base, _, handle) = spawn_test_server().await;
    let (status, body) = post_browser_event(&Client::new(), &base).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["error"], "subscription_inactive");
    assert!(body["message"].as_str().unwrap().contains("Trial ended"));
    handle.abort();

    // A running trial ingests normally.
    set_billing(&pool, "pro", "trialing", Some("2999-01-01T00:00:00Z")).await;
    let (base, _, handle) = spawn_test_server().await;
    let (status, _) = post_browser_event(&Client::new(), &base).await;
    assert_eq!(status, StatusCode::ACCEPTED);
    handle.abort();

    reset(&pool).await;
}

#[tokio::test]
async fn signup_starts_one_trial_per_user() {
    let pool = admin_pool().await;
    let (base, _, handle) = spawn_test_server().await;
    let email = format!("trial-{}@example.test", Uuid::new_v4().simple());
    let client = Client::builder().cookie_store(true).build().unwrap();
    let response = client
        .post(format!("{base}/api/v1/auth/register"))
        .json(&serde_json::json!({ "email": email, "password": "a-long-enough-password-1" }))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    let (user_id, org_id, plan, status, days): (Uuid, Uuid, String, String, f64) = sqlx::query_as(
        "SELECT u.id, o.id, o.plan_tier, o.subscription_status, \
         (EXTRACT(EPOCH FROM (o.trial_ends_at - now())) / 86400)::float8 \
         FROM users u JOIN org_members m ON m.user_id = u.id JOIN organizations o ON o.id = m.org_id \
         WHERE u.email = $1",
    )
    .bind(&email)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(plan, "pro");
    assert_eq!(status, "trialing");
    assert!((13.9..=14.01).contains(&days), "trial length {days}");

    // A second workspace of the same user gets no second trial.
    let second = Uuid::new_v4();
    sqlx::query("INSERT INTO organizations (id, name) VALUES ($1, 'second')")
        .bind(second)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'owner')")
        .bind(second)
        .bind(user_id)
        .execute(&pool)
        .await
        .unwrap();
    let granted: bool = sqlx::query_scalar("SELECT billing_start_trial($1, $2, 14)")
        .bind(user_id)
        .bind(second)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(!granted);
    let (plan, status): (String, String) =
        sqlx::query_as("SELECT plan_tier, subscription_status FROM organizations WHERE id = $1")
            .bind(second)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!((plan.as_str(), status.as_str()), ("oss", "none"));

    for id in [org_id, second] {
        sqlx::query("DELETE FROM organizations WHERE id = $1")
            .bind(id)
            .execute(&pool)
            .await
            .unwrap();
    }
    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user_id)
        .execute(&pool)
        .await
        .unwrap();
    handle.abort();
}

#[tokio::test]
async fn pro_plan_caps_monitors_and_retention() {
    let pool = admin_pool().await;
    set_billing(&pool, "pro", "active", None).await;
    let (base, _, handle) = spawn_test_server().await;
    let client = Client::builder().cookie_store(true).build().unwrap();
    let login = client
        .post(format!("{base}/api/v1/auth/login"))
        .json(&serde_json::json!({ "email": "dev@epure.local", "password": DEV_PASSWORD }))
        .send()
        .await
        .unwrap();
    assert_eq!(login.status(), StatusCode::NO_CONTENT);

    for n in 0..5 {
        let response = client
            .post(format!("{base}/api/v1/monitors"))
            .json(&serde_json::json!({ "project_id": project_id(), "slug": format!("job-{n}") }))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::CREATED, "monitor {n}");
    }
    let sixth = client
        .post(format!("{base}/api/v1/monitors"))
        .json(&serde_json::json!({ "project_id": project_id(), "slug": "job-5" }))
        .send()
        .await
        .unwrap();
    assert_eq!(sixth.status(), StatusCode::PAYMENT_REQUIRED);

    let retention = client
        .patch(format!("{base}/api/v1/projects/{}", project_id()))
        .json(&serde_json::json!({ "retention_days": 90 }))
        .send()
        .await
        .unwrap();
    assert_eq!(retention.status(), StatusCode::PAYMENT_REQUIRED);
    let retention = client
        .patch(format!("{base}/api/v1/projects/{}", project_id()))
        .json(&serde_json::json!({ "retention_days": 14 }))
        .send()
        .await
        .unwrap();
    assert!(retention.status().is_success());

    handle.abort();
    reset(&pool).await;
}
