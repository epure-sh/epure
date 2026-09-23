#![allow(dead_code)]

use axum::{routing::post, Json, Router};
use epure_server::{init_runtime, router_for};
use serde_json::Value;
use sqlx::PgPool;
use std::fs;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use tokio::task::JoinHandle;
use uuid::Uuid;

pub fn project_id() -> Uuid {
    Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").expect("project id")
}
pub const PUBLIC_KEY: &str = "a1b2c3d4e5f6g7h8i9j0";
pub const SECRET_KEY: &str = "supersecretdevkey";

pub async fn spawn_test_server() -> (String, PgPool, JoinHandle<()>) {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let artifacts_dir =
        std::env::temp_dir().join(format!("epure-artifacts-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&artifacts_dir).expect("create artifacts dir");
    std::env::set_var("EPURE_ARTIFACTS_DIR", artifacts_dir);
    std::env::set_var("EPURE_SESSION_SECURE", "0");
    std::env::set_var("EPURE_WEBHOOK_ALLOW_PRIVATE", "1");
    std::env::set_var("EPURE_BIND", "127.0.0.1:0");
    let runtime = {
        let mut last_err = None;
        let mut runtime = None;
        for attempt in 0..8 {
            match init_runtime(&database_url).await {
                Ok(rt) => {
                    runtime = Some(rt);
                    break;
                }
                Err(err) => {
                    let msg = err.to_string();
                    if msg.contains("tuple concurrently updated") && attempt < 7 {
                        tokio::time::sleep(std::time::Duration::from_millis(50 * (attempt + 1)))
                            .await;
                        last_err = Some(err);
                        continue;
                    }
                    panic!("init runtime: {err}");
                }
            }
        }
        runtime.unwrap_or_else(|| panic!("init runtime: {:?}", last_err))
    };
    let admin = epure_storage::connect(&database_url)
        .await
        .expect("connect admin pool");
    seed_dev(&admin).await.expect("seed dev data");

    let pool = admin;
    let app = router_for(&runtime);
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind test listener");
    let addr: SocketAddr = listener.local_addr().expect("local addr");
    let base_url = format!("http://{}", addr);

    let handle = tokio::spawn(async move {
        axum::serve(
            listener,
            app.into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        .expect("serve test app");
    });

    (base_url, pool, handle)
}

async fn seed_dev(pool: &PgPool) -> Result<(), sqlx::Error> {
    seed_dev_pool(pool).await
}

pub async fn seed_dev_pool(pool: &PgPool) -> Result<(), sqlx::Error> {
    let seed = fs::read_to_string(seed_path()).expect("seed-dev.sql");
    for statement in seed
        .split(';')
        .map(str::trim)
        .filter(|part| !part.is_empty())
    {
        sqlx::query(statement).execute(pool).await?;
    }
    // Test-only account — never written into seed SQL shipped for operators.
    let hash = epure_auth::dev_seed_password_hash();
    let user_id = Uuid::parse_str("33333333-3333-3333-3333-333333333333").expect("dev user");
    let org_id = Uuid::parse_str("11111111-1111-1111-1111-111111111111").expect("dev org");
    sqlx::query(
        r#"
        INSERT INTO users (id, email, password_hash)
        VALUES ($1, 'dev@epure.local', $2)
        ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash
        "#,
    )
    .bind(user_id)
    .bind(hash)
    .execute(pool)
    .await?;
    sqlx::query(
        r#"
        INSERT INTO org_members (org_id, user_id, role)
        VALUES ($1, $2, 'owner')
        ON CONFLICT (org_id, user_id) DO NOTHING
        "#,
    )
    .bind(org_id)
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub fn fixture_path(language: &str, name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../fixtures/sentry")
        .join(language)
        .join(name)
}

pub fn auth_header() -> String {
    format!(
        "Sentry sentry_version=7, sentry_key={}, sentry_secret={}",
        PUBLIC_KEY, SECRET_KEY
    )
}

fn seed_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../scripts/seed-dev.sql")
}

pub async fn spawn_webhook_capture() -> (String, JoinHandle<()>, Arc<Mutex<Vec<Value>>>) {
    let events: Arc<Mutex<Vec<Value>>> = Arc::new(Mutex::new(Vec::new()));
    let events_for_handler = events.clone();
    let (ready_tx, ready_rx) = oneshot::channel();

    let handle = tokio::spawn(async move {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind webhook listener");
        let addr = listener.local_addr().expect("webhook addr");
        ready_tx.send(addr).expect("ready signal");

        let app = Router::new().route(
            "/hook",
            post({
                let events = events_for_handler;
                move |Json(body): Json<Value>| {
                    events.lock().expect("lock").push(body);
                    async { "ok" }
                }
            }),
        );

        axum::serve(listener, app)
            .await
            .expect("serve webhook capture");
    });

    let addr = ready_rx.await.expect("webhook ready");
    let url = format!("http://{addr}/hook");
    (url, handle, events)
}
