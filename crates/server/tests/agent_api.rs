mod support;

use epure_auth::{dev_seed_password_hash, hash_password};
use epure_storage::{
    agent_tokens::{self, TOKEN_PREFIX, TOKEN_PREFIX_DISPLAY_LEN},
    connect, connect_pools, issues, run_migrations,
};
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

async fn seed_dev_password(pool: &PgPool) {
    let hash = dev_seed_password_hash();
    sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
        .bind(&hash)
        .bind(dev_user())
        .execute(pool)
        .await
        .expect("seed password");
}

fn random_pat_secret() -> String {
    format!(
        "{}{}",
        Uuid::new_v4().simple(),
        "0123456789012345678901234567890"
    )
}

async fn create_pat(pool: &PgPool, scopes: &[&str]) -> String {
    create_pat_with_secret(pool, scopes, &random_pat_secret()).await
}

async fn create_pat_with_secret(pool: &PgPool, scopes: &[&str], secret: &str) -> String {
    let full = format!("{TOKEN_PREFIX}{secret}");
    let prefix = secret[..TOKEN_PREFIX_DISPLAY_LEN].to_string();
    let hash = hash_password(&full).expect("hash");
    let scope_vec: Vec<String> = scopes.iter().map(|s| (*s).to_string()).collect();
    agent_tokens::insert_token(
        pool,
        dev_org(),
        dev_user(),
        "test",
        &prefix,
        &hash,
        &scope_vec,
    )
    .await
    .expect("insert token");
    full
}

const DEV_PASSWORD: &str = "devpassword";

async fn seed_member_user(pool: &PgPool) {
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

async fn login_owner(client: &Client, base_url: &str) {
    let login = client
        .post(format!("{base_url}/api/v1/auth/login"))
        .json(&serde_json::json!({
            "email": "dev@epure.local",
            "password": DEV_PASSWORD
        }))
        .send()
        .await
        .expect("owner login");
    assert_eq!(login.status(), 204);
}

#[tokio::test]
async fn agent_whoami_requires_token() {
    let (base_url, _pool, handle) = spawn_test_server().await;
    let client = Client::new();
    let response = client
        .get(format!("{base_url}/api/v1/agent/whoami"))
        .send()
        .await
        .expect("whoami");
    assert_eq!(response.status(), 401);
    handle.abort();
}

#[tokio::test]
async fn read_pat_can_queue_and_context_but_not_triage() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url).await.expect("connect");
    run_migrations(&migrate_pool).await.expect("migrate");
    let _pools = connect_pools(&database_url).await.expect("pools");
    support::seed_dev_pool(&migrate_pool)
        .await
        .expect("seed dev");
    seed_dev_password(&migrate_pool).await;

    let token = create_pat(&migrate_pool, &[agent_tokens::SCOPE_READ_AGENT]).await;

    let (base_url, _pool, handle) = spawn_test_server().await;
    let client = Client::new();

    let whoami = client
        .get(format!("{base_url}/api/v1/agent/whoami"))
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .expect("whoami");
    assert!(whoami.status().is_success());

    let queue = client
        .get(format!("{base_url}/api/v1/agent/queue"))
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .expect("queue");
    assert!(queue.status().is_success());

    let resolve = client
        .patch(format!(
            "{base_url}/api/v1/agent/issues/00000000-0000-0000-0000-000000000001"
        ))
        .header("Authorization", format!("Bearer {token}"))
        .json(&serde_json::json!({ "status": "resolved" }))
        .send()
        .await
        .expect("resolve");
    assert_eq!(resolve.status(), 403);

    handle.abort();
}

#[tokio::test]
async fn pat_cannot_read_other_org_issue() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url).await.expect("connect");
    run_migrations(&migrate_pool).await.expect("migrate");
    support::seed_dev_pool(&migrate_pool)
        .await
        .expect("seed dev");
    seed_dev_password(&migrate_pool).await;
    seed_org_b_issue(&migrate_pool).await;

    let token = create_pat(&migrate_pool, &[agent_tokens::SCOPE_READ_AGENT]).await;

    let (base_url, _pool, handle) = spawn_test_server().await;
    let client = Client::new();

    let foreign_issue = issue_id_org_b(&migrate_pool).await;
    let response = client
        .get(format!("{base_url}/api/v1/agent/issues/{foreign_issue}"))
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .expect("get issue");
    assert_eq!(response.status(), 404);

    handle.abort();
}

async fn seed_org_b_issue(pool: &PgPool) {
    sqlx::query(
        r#"
        INSERT INTO organizations (id, name)
        VALUES ($1, 'Org B')
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .bind(org_b())
    .execute(pool)
    .await
    .expect("org b");

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
    .await
    .expect("project b");

    issues::upsert_issue(
        pool,
        issues::UpsertIssueParams {
            org_id: org_b(),
            project_id: project_b(),
            fingerprint: "fp-agent-org-b".to_string(),
            title: Some("Org B only issue".to_string()),
            level: Some("error".to_string()),
            environment: Some("production".to_string()),
            release: None,
            occurred_at: chrono::Utc::now(),
            increment_by: 1,
        },
    )
    .await
    .expect("org b issue");
}

async fn issue_id_org_b(pool: &PgPool) -> Uuid {
    issues::get_issue_by_fingerprint(pool, org_b(), project_b(), "fp-agent-org-b")
        .await
        .expect("lookup")
        .expect("issue")
        .id
}

#[tokio::test]
async fn agent_rejects_malformed_and_invalid_tokens() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url).await.expect("connect");
    run_migrations(&migrate_pool).await.expect("migrate");
    support::seed_dev_pool(&migrate_pool)
        .await
        .expect("seed dev");
    seed_dev_password(&migrate_pool).await;

    let valid = create_pat(&migrate_pool, &[agent_tokens::SCOPE_READ_AGENT]).await;

    let (base_url, pool, handle) = spawn_test_server().await;
    let client = Client::new();
    let url = format!("{base_url}/api/v1/agent/whoami");

    for token in [
        "not-a-token",
        "epure_pat_tooshort",
        "epure_pat_wrongpr0123456789012345678901234567890",
        &format!("{valid}x"),
        "epure_pat_testsecr999999999999999999999999999999",
    ] {
        let response = client
            .get(&url)
            .header("Authorization", format!("Bearer {token}"))
            .send()
            .await
            .expect("whoami");
        assert_eq!(response.status(), 401, "token {:?}", token);
    }

    let prefix = valid
        .strip_prefix(TOKEN_PREFIX)
        .and_then(|rest| rest.get(..TOKEN_PREFIX_DISPLAY_LEN))
        .expect("prefix");
    let row = sqlx::query_as::<_, (Uuid,)>(
        "SELECT id FROM agent_tokens WHERE org_id = $1 AND token_prefix = $2 AND revoked_at IS NULL",
    )
    .bind(dev_org())
    .bind(prefix)
    .fetch_one(&pool)
    .await
    .expect("token row");
    agent_tokens::revoke_token(&migrate_pool, dev_org(), row.0)
        .await
        .expect("revoke");

    let revoked = client
        .get(&url)
        .header("Authorization", format!("Bearer {valid}"))
        .send()
        .await
        .expect("revoked whoami");
    assert_eq!(revoked.status(), 401);

    handle.abort();
}

#[tokio::test]
async fn session_cookie_authenticates_agent_routes() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url).await.expect("connect");
    run_migrations(&migrate_pool).await.expect("migrate");
    support::seed_dev_pool(&migrate_pool)
        .await
        .expect("seed dev");
    seed_dev_password(&migrate_pool).await;

    let (base_url, _pool, handle) = spawn_test_server().await;
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("cookie client");
    login_owner(&client, &base_url).await;

    let whoami = client
        .get(format!("{base_url}/api/v1/agent/whoami"))
        .send()
        .await
        .expect("whoami");
    assert!(whoami.status().is_success());
    let body: serde_json::Value = whoami.json().await.expect("json");
    assert_eq!(body["scopes"], serde_json::json!(["session"]));

    handle.abort();
}

#[tokio::test]
async fn pat_reads_dashboard_but_admin_routes_need_scope() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url).await.expect("connect");
    run_migrations(&migrate_pool).await.expect("migrate");
    support::seed_dev_pool(&migrate_pool)
        .await
        .expect("seed dev");
    seed_dev_password(&migrate_pool).await;

    let token = create_pat(&migrate_pool, &[agent_tokens::SCOPE_READ_AGENT]).await;

    let (base_url, _pool, handle) = spawn_test_server().await;
    let client = Client::new();

    let issues = client
        .get(format!("{base_url}/api/v1/issues"))
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .expect("issues");
    assert!(issues.status().is_success());

    let list_tokens = client
        .get(format!("{base_url}/api/v1/agent-tokens"))
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .expect("agent-tokens");
    assert_eq!(list_tokens.status(), 403);

    handle.abort();
}

#[tokio::test]
async fn read_pat_cannot_create_project() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url).await.expect("connect");
    run_migrations(&migrate_pool).await.expect("migrate");
    support::seed_dev_pool(&migrate_pool)
        .await
        .expect("seed dev");
    seed_dev_password(&migrate_pool).await;

    let token = create_pat(&migrate_pool, &[agent_tokens::SCOPE_READ_AGENT]).await;

    let (base_url, _pool, handle) = spawn_test_server().await;
    let client = Client::new();

    let response = client
        .post(format!("{base_url}/api/v1/projects"))
        .header("Authorization", format!("Bearer {token}"))
        .json(&serde_json::json!({ "name": "blocked", "slug": "blocked" }))
        .send()
        .await
        .expect("create project");
    assert_eq!(response.status(), 403);

    handle.abort();
}

#[tokio::test]
async fn member_cannot_manage_agent_tokens() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url).await.expect("connect");
    run_migrations(&migrate_pool).await.expect("migrate");
    support::seed_dev_pool(&migrate_pool)
        .await
        .expect("seed dev");
    seed_dev_password(&migrate_pool).await;
    seed_member_user(&migrate_pool).await;

    let (base_url, _pool, handle) = spawn_test_server().await;
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("cookie client");
    login_member(&client, &base_url).await;

    let list = client
        .get(format!("{base_url}/api/v1/agent-tokens"))
        .send()
        .await
        .expect("list");
    assert_eq!(list.status(), 403);

    let create = client
        .post(format!("{base_url}/api/v1/agent-tokens"))
        .json(&serde_json::json!({ "label": "nope" }))
        .send()
        .await
        .expect("create");
    assert_eq!(create.status(), 403);

    handle.abort();
}

async fn seed_dev_issue(pool: &PgPool) -> Uuid {
    let project_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
    issues::upsert_issue(
        pool,
        issues::UpsertIssueParams {
            org_id: dev_org(),
            project_id,
            fingerprint: "fp-agent-triage-test".to_string(),
            title: Some("Triage PAT issue".to_string()),
            level: Some("error".to_string()),
            environment: Some("production".to_string()),
            release: None,
            occurred_at: chrono::Utc::now(),
            increment_by: 1,
        },
    )
    .await
    .expect("seed issue");
    issues::get_issue_by_fingerprint(pool, dev_org(), project_id, "fp-agent-triage-test")
        .await
        .expect("lookup")
        .expect("issue")
        .id
}

#[tokio::test]
async fn triage_pat_can_patch_dashboard_issue() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url).await.expect("connect");
    run_migrations(&migrate_pool).await.expect("migrate");
    support::seed_dev_pool(&migrate_pool)
        .await
        .expect("seed dev");
    seed_dev_password(&migrate_pool).await;
    let issue_id = seed_dev_issue(&migrate_pool).await;

    let token = create_pat(
        &migrate_pool,
        &[
            agent_tokens::SCOPE_READ_AGENT,
            agent_tokens::SCOPE_WRITE_TRIAGE,
        ],
    )
    .await;

    let (base_url, _pool, handle) = spawn_test_server().await;
    let client = Client::new();

    let patch = client
        .patch(format!("{base_url}/api/v1/issues/{issue_id}"))
        .header("Authorization", format!("Bearer {token}"))
        .json(&serde_json::json!({ "status": "resolved" }))
        .send()
        .await
        .expect("patch");
    assert!(patch.status().is_success());

    handle.abort();
}

#[tokio::test]
async fn admin_pat_can_list_agent_tokens() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url).await.expect("connect");
    run_migrations(&migrate_pool).await.expect("migrate");
    support::seed_dev_pool(&migrate_pool)
        .await
        .expect("seed dev");
    seed_dev_password(&migrate_pool).await;

    let token = create_pat(
        &migrate_pool,
        &[
            agent_tokens::SCOPE_READ_AGENT,
            agent_tokens::SCOPE_WRITE_ADMIN,
        ],
    )
    .await;

    let (base_url, _pool, handle) = spawn_test_server().await;
    let client = Client::new();

    let list = client
        .get(format!("{base_url}/api/v1/agent-tokens"))
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .expect("list");
    assert!(list.status().is_success());

    handle.abort();
}
