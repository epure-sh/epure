mod support;

use epure_storage::{connect, connect_pools, issues, run_migrations};
use reqwest::Client;
use sqlx::PgPool;
use support::spawn_test_server;
use uuid::Uuid;

fn dev_org() -> Uuid {
    Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap()
}

fn dev_user() -> Uuid {
    Uuid::parse_str("33333333-3333-3333-3333-333333333333").unwrap()
}

fn org_b() -> Uuid {
    Uuid::parse_str("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb").unwrap()
}

fn project_b() -> Uuid {
    Uuid::parse_str("dddddddd-dddd-dddd-dddd-dddddddddddd").unwrap()
}

fn user_b() -> Uuid {
    Uuid::parse_str("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee").unwrap()
}

const DEV_PASSWORD: &str = "devpassword";

#[tokio::test]
async fn unauthenticated_issues_returns_401() {
    let (base_url, _pool, handle) = spawn_test_server().await;
    let client = Client::new();

    let response = client
        .get(format!("{base_url}/api/v1/issues"))
        .send()
        .await
        .expect("request issues");

    assert_eq!(response.status(), 401);
    handle.abort();
}

#[tokio::test]
async fn password_login_returns_org_scoped_issues_only() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url).await.expect("connect migrate pool");
    run_migrations(&migrate_pool).await.expect("run migrations");

    let _pools = connect_pools(&database_url).await.expect("connect pools");
    support::seed_dev_pool(&migrate_pool)
        .await
        .expect("seed dev org");
    seed_dev_password(&migrate_pool)
        .await
        .expect("seed dev password");
    seed_dev_issue(&migrate_pool).await.expect("seed dev issue");
    seed_org_b_user_and_issue(&migrate_pool)
        .await
        .expect("seed org b");

    let (base_url, _pool, handle) = spawn_test_server().await;
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("cookie client");

    let unauthenticated = client
        .get(format!("{base_url}/api/v1/issues"))
        .send()
        .await
        .expect("unauthenticated issues");
    assert_eq!(unauthenticated.status(), 401);

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

    let me = client
        .get(format!("{base_url}/api/v1/auth/me"))
        .send()
        .await
        .expect("session me");
    assert_eq!(me.status(), 200);
    let me_body: serde_json::Value = me.json().await.expect("me json");
    assert_eq!(
        me_body.get("org_id").and_then(|value| value.as_str()),
        Some(dev_org().to_string().as_str())
    );

    let issues = client
        .get(format!("{base_url}/api/v1/issues"))
        .send()
        .await
        .expect("authenticated issues");
    assert_eq!(issues.status(), 200);
    let issues_body: serde_json::Value = issues.json().await.expect("issues json");
    let rows = issues_body
        .get("issues")
        .and_then(|value| value.as_array())
        .expect("issues array");

    assert!(!rows.is_empty());
    assert!(rows.iter().all(|row| {
        row.get("org_id").and_then(|value| value.as_str()) == Some(dev_org().to_string().as_str())
    }));
    assert!(rows.iter().all(|row| {
        row.get("org_id").and_then(|value| value.as_str()) != Some(org_b().to_string().as_str())
    }));

    handle.abort();
}

async fn seed_dev_password(pool: &PgPool) -> Result<(), sqlx::Error> {
    let hash = epure_auth::dev_seed_password_hash();
    sqlx::query(
        r#"
        UPDATE users
        SET password_hash = $1
        WHERE id = $2
        "#,
    )
    .bind(hash)
    .bind(dev_user())
    .execute(pool)
    .await?;
    Ok(())
}

async fn seed_dev_issue(pool: &PgPool) -> Result<(), sqlx::Error> {
    issues::upsert_issue(
        pool,
        issues::UpsertIssueParams {
            org_id: dev_org(),
            project_id: Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap(),
            fingerprint: "fp-dev-session-gate".to_string(),
            title: Some("Dev org issue".to_string()),
            level: Some("error".to_string()),
            environment: Some("production".to_string()),
            release: None,
            occurred_at: chrono::Utc::now(),
            increment_by: 1,
        },
    )
    .await?;
    Ok(())
}

async fn seed_org_b_user_and_issue(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO organizations (id, name)
        VALUES ($1, 'Org B')
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .bind(org_b())
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO projects (id, org_id, name, slug, retention_days)
        VALUES ($1, $2, 'Project B', 'project-b', 30)
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .bind(project_b())
    .bind(org_b())
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO users (id, email)
        VALUES ($1, 'member-b@epure.local')
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .bind(user_b())
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO org_members (org_id, user_id, role)
        VALUES ($1, $2, 'member')
        ON CONFLICT (org_id, user_id) DO NOTHING
        "#,
    )
    .bind(org_b())
    .bind(user_b())
    .execute(pool)
    .await?;

    issues::upsert_issue(
        pool,
        issues::UpsertIssueParams {
            org_id: org_b(),
            project_id: project_b(),
            fingerprint: "fp-org-b-session-gate".to_string(),
            title: Some("Org B only issue".to_string()),
            level: Some("error".to_string()),
            environment: Some("production".to_string()),
            release: None,
            occurred_at: chrono::Utc::now(),
            increment_by: 1,
        },
    )
    .await?;

    Ok(())
}
