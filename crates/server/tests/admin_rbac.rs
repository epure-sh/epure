mod support;

use epure_storage::{connect, connect_pools, run_migrations};
use reqwest::Client;
use sqlx::PgPool;
use support::{fixture_path, project_id, spawn_test_server, PUBLIC_KEY, SECRET_KEY};
use uuid::Uuid;

fn dev_org() -> Uuid {
    Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap()
}

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

async fn seed_admin_user(pool: &PgPool) -> Uuid {
    let admin_id = Uuid::parse_str("55555555-5555-5555-5555-555555555555").unwrap();
    sqlx::query(
        r#"
        INSERT INTO users (id, email, password_hash)
        VALUES ($1, 'admin@epure.local', (SELECT password_hash FROM users WHERE email = 'dev@epure.local'))
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .bind(admin_id)
    .execute(pool)
    .await
    .expect("seed admin user");

    sqlx::query(
        r#"
        INSERT INTO org_members (org_id, user_id, role)
        VALUES ($1, $2, 'admin')
        ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'admin'
        "#,
    )
    .bind(dev_org())
    .bind(admin_id)
    .execute(pool)
    .await
    .expect("seed admin membership");

    admin_id
}

async fn login_admin(client: &Client, base_url: &str) {
    let login = client
        .post(format!("{base_url}/api/v1/auth/login"))
        .json(&serde_json::json!({
            "email": "admin@epure.local",
            "password": DEV_PASSWORD
        }))
        .send()
        .await
        .expect("admin login");
    assert_eq!(login.status(), 204);
}

async fn seed_member_user(pool: &PgPool) -> Uuid {
    let member_id = Uuid::parse_str("44444444-4444-4444-4444-444444444444").unwrap();
    sqlx::query(
        r#"
        INSERT INTO users (id, email, password_hash)
        VALUES ($1, 'member@epure.local', (SELECT password_hash FROM users WHERE email = 'dev@epure.local'))
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .bind(member_id)
    .execute(pool)
    .await
    .expect("seed member user");

    sqlx::query(
        r#"
        INSERT INTO org_members (org_id, user_id, role)
        VALUES ($1, $2, 'member')
        ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'member'
        "#,
    )
    .bind(dev_org())
    .bind(member_id)
    .execute(pool)
    .await
    .expect("seed member membership");

    member_id
}

async fn login_member(client: &Client, base_url: &str) {
    let login = client
        .post(format!("{base_url}/api/v1/auth/login"))
        .json(&serde_json::json!({
            "email": "member@epure.local",
            "password": DEV_PASSWORD
        }))
        .send()
        .await
        .expect("member login");
    assert_eq!(login.status(), 204);
}

async fn seed_second_project(pool: &PgPool) -> (Uuid, String, String) {
    let project_b = Uuid::new_v4();
    let public_b = format!("test{}", &Uuid::new_v4().simple().to_string()[..16]);
    let secret_b = format!("secret{}", &Uuid::new_v4().simple().to_string()[..16]);

    sqlx::query(
        r#"
        INSERT INTO projects (id, org_id, name, slug, retention_days, ingest_cap_per_hour)
        VALUES ($1, $2, 'Staging API', 'staging-api', 30, 5000)
        "#,
    )
    .bind(project_b)
    .bind(dev_org())
    .execute(pool)
    .await
    .expect("seed project b");

    sqlx::query(
        r#"
        INSERT INTO dsn_keys (id, project_id, public_key, secret_key, label)
        VALUES ($1, $2, $3, convert_to($4, 'UTF8'), 'staging')
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(project_b)
    .bind(&public_b)
    .bind(&secret_b)
    .execute(pool)
    .await
    .expect("seed dsn b");

    (project_b, public_b, secret_b)
}

#[tokio::test]
async fn demoted_admin_loses_admin_access_immediately() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url).await.expect("connect migrate pool");
    run_migrations(&migrate_pool).await.expect("run migrations");

    let _pools = connect_pools(&database_url).await.expect("connect pools");
    support::seed_dev_pool(&migrate_pool)
        .await
        .expect("seed dev org");
    let admin_id = seed_admin_user(&migrate_pool).await;

    let (base_url, _pool, handle) = spawn_test_server().await;
    let admin_client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("admin client");
    let owner_client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("owner client");

    login_admin(&admin_client, &base_url).await;
    login_owner(&owner_client, &base_url).await;

    let create_before = admin_client
        .post(format!(
            "{base_url}/api/v1/projects/{}/dsn-keys",
            project_id()
        ))
        .json(&serde_json::json!({ "label": "allowed-before" }))
        .send()
        .await
        .expect("create dsn before demotion");
    assert_eq!(create_before.status(), 201);

    let demote = owner_client
        .patch(format!("{base_url}/api/v1/members/{admin_id}"))
        .json(&serde_json::json!({ "role": "member" }))
        .send()
        .await
        .expect("demote admin");
    assert_eq!(demote.status(), 200);

    let create_after = admin_client
        .post(format!(
            "{base_url}/api/v1/projects/{}/dsn-keys",
            project_id()
        ))
        .json(&serde_json::json!({ "label": "blocked-after" }))
        .send()
        .await
        .expect("create dsn after demotion");
    assert_eq!(create_after.status(), 403);

    handle.abort();
}

#[tokio::test]
async fn member_cannot_create_dsn_key() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url).await.expect("connect migrate pool");
    run_migrations(&migrate_pool).await.expect("run migrations");

    let _pools = connect_pools(&database_url).await.expect("connect pools");
    support::seed_dev_pool(&migrate_pool)
        .await
        .expect("seed dev org");
    seed_member_user(&migrate_pool).await;

    let (base_url, _pool, handle) = spawn_test_server().await;
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("cookie client");

    login_member(&client, &base_url).await;

    let create = client
        .post(format!(
            "{base_url}/api/v1/projects/{}/dsn-keys",
            project_id()
        ))
        .json(&serde_json::json!({ "label": "blocked" }))
        .send()
        .await
        .expect("create dsn");
    assert_eq!(create.status(), 403);

    handle.abort();
}

#[tokio::test]
async fn member_cannot_patch_project_settings() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url).await.expect("connect migrate pool");
    run_migrations(&migrate_pool).await.expect("run migrations");

    let _pools = connect_pools(&database_url).await.expect("connect pools");
    support::seed_dev_pool(&migrate_pool)
        .await
        .expect("seed dev org");
    seed_member_user(&migrate_pool).await;

    let (base_url, _pool, handle) = spawn_test_server().await;
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("cookie client");

    login_member(&client, &base_url).await;

    let patch = client
        .patch(format!("{base_url}/api/v1/projects/{}", project_id()))
        .json(&serde_json::json!({ "retention_days": 14 }))
        .send()
        .await
        .expect("patch project");
    assert_eq!(patch.status(), 403);

    handle.abort();
}

#[tokio::test]
async fn member_cannot_create_webhook() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url).await.expect("connect migrate pool");
    run_migrations(&migrate_pool).await.expect("run migrations");

    let _pools = connect_pools(&database_url).await.expect("connect pools");
    support::seed_dev_pool(&migrate_pool)
        .await
        .expect("seed dev org");
    seed_member_user(&migrate_pool).await;

    let (base_url, _pool, handle) = spawn_test_server().await;
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("cookie client");

    login_member(&client, &base_url).await;

    let create = client
        .post(format!("{base_url}/api/v1/webhooks"))
        .json(&serde_json::json!({
            "project_id": project_id(),
            "url": "http://127.0.0.1/hook",
            "format": "generic"
        }))
        .send()
        .await
        .expect("create webhook");
    assert_eq!(create.status(), 403);

    handle.abort();
}

#[tokio::test]
async fn member_cannot_delete_project() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url).await.expect("connect migrate pool");
    run_migrations(&migrate_pool).await.expect("run migrations");

    let _pools = connect_pools(&database_url).await.expect("connect pools");
    support::seed_dev_pool(&migrate_pool)
        .await
        .expect("seed dev org");
    seed_member_user(&migrate_pool).await;

    let (base_url, _pool, handle) = spawn_test_server().await;
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("cookie client");

    login_member(&client, &base_url).await;

    let delete = client
        .delete(format!("{base_url}/api/v1/projects/{}", project_id()))
        .send()
        .await
        .expect("delete project");
    assert_eq!(delete.status(), 403);

    handle.abort();
}

#[tokio::test]
async fn revoked_dsn_returns_403_on_ingest() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url).await.expect("connect migrate pool");
    run_migrations(&migrate_pool).await.expect("run migrations");

    let _pools = connect_pools(&database_url).await.expect("connect pools");
    support::seed_dev_pool(&migrate_pool)
        .await
        .expect("seed dev org");

    let (base_url, pool, handle) = spawn_test_server().await;
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("cookie client");

    login_owner(&client, &base_url).await;

    let create = client
        .post(format!(
            "{base_url}/api/v1/projects/{}/dsn-keys",
            project_id()
        ))
        .json(&serde_json::json!({ "label": "revoke-test" }))
        .send()
        .await
        .expect("create key");
    assert_eq!(create.status(), 201);
    let created: serde_json::Value = create.json().await.expect("created json");
    let key_id = created["id"].as_str().expect("key id");

    let revoke = client
        .post(format!("{base_url}/api/v1/dsn-keys/{key_id}/revoke"))
        .send()
        .await
        .expect("revoke key");
    assert_eq!(revoke.status(), 200);

    let body_bytes = std::fs::read(fixture_path("browser", "envelope.txt")).expect("fixture");
    let created_public = created["public_key"].as_str().expect("public key");
    let created_secret = created["secret_key"].as_str().expect("secret key");
    let auth = format!(
        "Sentry sentry_version=7, sentry_key={}, sentry_secret={}",
        created_public, created_secret
    );
    let ingest = client
        .post(format!("{base_url}/api/{}/envelope/", project_id()))
        .header("X-Sentry-Auth", auth)
        .header("Content-Type", "application/x-sentry-envelope")
        .body(body_bytes)
        .send()
        .await
        .expect("ingest after revoke");

    assert_eq!(ingest.status(), 403);
    let error: serde_json::Value = ingest.json().await.expect("error json");
    assert_eq!(
        error.get("error").and_then(|v| v.as_str()),
        Some("dsn_revoked")
    );

    drop(pool);
    handle.abort();
}

#[tokio::test]
async fn two_projects_have_isolated_environments() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url).await.expect("connect migrate pool");
    run_migrations(&migrate_pool).await.expect("run migrations");

    let _pools = connect_pools(&database_url).await.expect("connect pools");
    support::seed_dev_pool(&migrate_pool)
        .await
        .expect("seed dev org");
    let (project_b, public_b, secret_b) = seed_second_project(&migrate_pool).await;
    let prod_fp = format!("prod-fp-{}", &Uuid::new_v4().simple().to_string()[..8]);
    let staging_fp = format!("staging-fp-{}", &Uuid::new_v4().simple().to_string()[..8]);
    let prod_title = format!("Prod error {prod_fp}");
    let staging_title = format!("Staging error {staging_fp}");

    sqlx::query(
        r#"
        INSERT INTO issues (
            id, org_id, project_id, fingerprint, title, status, environment, event_count, last_seen_at
        )
        VALUES
            ($1, $2, $3, $4, $5, 'unresolved', 'production', 1, now()),
            ($6, $2, $7, $8, $9, 'unresolved', 'staging', 1, now())
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(dev_org())
    .bind(project_id())
    .bind(&prod_fp)
    .bind(&prod_title)
    .bind(Uuid::new_v4())
    .bind(project_b)
    .bind(&staging_fp)
    .bind(&staging_title)
    .execute(&migrate_pool)
    .await
    .expect("seed issues");

    let (base_url, _pool, handle) = spawn_test_server().await;
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("cookie client");

    login_owner(&client, &base_url).await;

    let prod_issues = client
        .get(format!(
            "{base_url}/api/v1/issues?q=env:production%20{}&project_id={}",
            urlencoding::encode(&prod_title),
            project_id()
        ))
        .send()
        .await
        .expect("prod issues");
    assert_eq!(prod_issues.status(), 200);
    let prod_body: serde_json::Value = prod_issues.json().await.expect("prod json");
    assert_eq!(prod_body["issues"].as_array().map(|v| v.len()), Some(1));

    let staging_issues = client
        .get(format!(
            "{base_url}/api/v1/issues?q=env:staging%20{}&project_id={project_b}",
            urlencoding::encode(&staging_title)
        ))
        .send()
        .await
        .expect("staging issues");
    assert_eq!(staging_issues.status(), 200);
    let staging_body: serde_json::Value = staging_issues.json().await.expect("staging json");
    assert_eq!(staging_body["issues"].as_array().map(|v| v.len()), Some(1));

    let cross_prod = client
        .get(format!(
            "{base_url}/api/v1/issues?q=env:production%20{}&project_id={project_b}",
            urlencoding::encode(&staging_title)
        ))
        .send()
        .await
        .expect("cross prod filter");
    let cross_body: serde_json::Value = cross_prod.json().await.expect("cross json");
    assert_eq!(cross_body["issues"].as_array().map(|v| v.len()), Some(0));

    assert_ne!(public_b, PUBLIC_KEY);
    assert_ne!(secret_b, SECRET_KEY);

    handle.abort();
}
