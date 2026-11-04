mod support;
use epure_server::{init_runtime, router_for, ServerRuntime};
use epure_storage::{connect, ingest_queue};
use serde_json::json;
use std::time::{Duration, Instant};
use uuid::Uuid;

async fn runtime() -> ServerRuntime {
    std::env::set_var(
        "EPURE_ARTIFACTS_DIR",
        std::env::temp_dir().join(format!("epure-durable-{}", Uuid::new_v4())),
    );
    std::env::set_var("EPURE_BIND", "127.0.0.1:0");
    std::env::set_var("EPURE_SESSION_SECURE", "0");
    let db = std::env::var("DATABASE_URL").unwrap();
    let rt = init_runtime(&db).await.unwrap();
    let admin = connect(&db).await.unwrap();
    support::seed_dev_pool(&admin).await.unwrap();
    rt
}
async fn serve(rt: &ServerRuntime) -> (String, tokio::task::JoinHandle<()>) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let app = router_for(rt);
    let handle = tokio::spawn(async move {
        axum::serve(
            listener,
            app.into_make_service_with_connect_info::<std::net::SocketAddr>(),
        )
        .await
        .unwrap();
    });
    (url, handle)
}
fn stop(rt: &ServerRuntime) {
    rt.worker.abort();
    rt.flusher.abort();
    rt.ttl.abort();
    rt.deliveries.abort();
    rt.monitors.abort();
    rt.session_cleanup.abort();
}
async fn wait_count(pool: &sqlx::PgPool, fp: &str, expected: i64) {
    let deadline = Instant::now() + Duration::from_secs(15);
    loop {
        let n: Option<i64> = sqlx::query_scalar(
            "SELECT event_count::bigint FROM issues WHERE project_id=$1 AND fingerprint=$2",
        )
        .bind(support::project_id())
        .bind(fp)
        .fetch_optional(pool)
        .await
        .unwrap();
        if n == Some(expected) {
            break;
        }
        assert!(Instant::now() < deadline, "count {n:?} expected {expected}");
        tokio::time::sleep(Duration::from_millis(30)).await;
    }
}
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn admission_survives_worker_crash_and_lost_finish_response() {
    let rt = runtime().await;
    stop(&rt);
    let (url, http) = serve(&rt).await;
    let admin = connect(&std::env::var("DATABASE_URL").unwrap())
        .await
        .unwrap();
    let key = format!("durable-{}", Uuid::new_v4());
    let event_id = Uuid::new_v4();
    let event = json!({"event_id":event_id.simple().to_string(),"fingerprint":[key],"message":"real durable crash test","timestamp":"invalid-clock"});
    let fp = epure_envelope::compute_fingerprint(&event);
    let client = reqwest::Client::new();
    let send = |url: String, event: serde_json::Value, client: reqwest::Client| async move {
        client
            .post(format!("{url}/api/{}/store/", support::project_id()))
            .header("X-Sentry-Auth", support::auth_header())
            .json(&event)
            .send()
            .await
            .unwrap()
            .status()
    };
    // Concurrent duplicate requests are admitted by two independent server runtimes.
    let rt2 = runtime().await;
    stop(&rt2);
    let (url2, http2) = serve(&rt2).await;
    let mut tasks = tokio::task::JoinSet::new();
    for n in 0..32 {
        tasks.spawn(send(
            if n % 2 == 0 {
                url.clone()
            } else {
                url2.clone()
            },
            event.clone(),
            client.clone(),
        ));
    }
    while let Some(result) = tasks.join_next().await {
        assert_eq!(result.unwrap(), 202);
    }
    let receipts:i64=sqlx::query_scalar("SELECT count(*) FROM ingest_inbox WHERE project_id=$1 AND event_id=$2 AND status='pending'").bind(support::project_id()).bind(event_id).fetch_one(&admin).await.unwrap();
    assert_eq!(receipts, 1);
    // Hold the budget lock so a new worker can commit the body but cannot finish its receipt.
    let mut lock = admin.begin().await.unwrap();
    sqlx::query("SELECT ingest_lock_budget()")
        .execute(&mut *lock)
        .await
        .unwrap();
    let recovered = runtime().await;
    wait_count(&admin, &fp, 1).await;
    recovered.worker.abort();
    http.abort();
    http2.abort();
    stop(&recovered);
    lock.rollback().await.unwrap();
    // Force the killed worker's abandoned lease to expire; queued payload and original receipt remain.
    sqlx::query("UPDATE ingest_inbox SET leased_until=now()-interval '1 second' WHERE project_id=$1 AND event_id=$2").bind(support::project_id()).bind(event_id).execute(&admin).await.unwrap();
    let restarted = runtime().await;
    let (url3, http3) = serve(&restarted).await;
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        let status: String = sqlx::query_scalar(
            "SELECT status FROM ingest_inbox WHERE project_id=$1 AND event_id=$2",
        )
        .bind(support::project_id())
        .bind(event_id)
        .fetch_one(&admin)
        .await
        .unwrap();
        if status == "done" {
            break;
        }
        assert!(Instant::now() < deadline, "receipt not recovered: {status}");
        tokio::time::sleep(Duration::from_millis(30)).await;
    }
    let mut changed = event.clone();
    changed["timestamp"] = json!(chrono::Utc::now().to_rfc3339());
    assert_eq!(send(url3, changed, client).await, 202);
    wait_count(&admin, &fp, 1).await;
    let bodies: i64 = sqlx::query_scalar("SELECT count(*) FROM events WHERE id=$1")
        .bind(event_id)
        .fetch_one(&admin)
        .await
        .unwrap();
    assert_eq!(bodies, 1);
    http3.abort();
    stop(&restarted);
}
#[tokio::test]
async fn backlog_limits_are_atomic_and_tenant_scoped() {
    let rt = runtime().await;
    stop(&rt);
    let org = Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap();
    let project = support::project_id();
    let pool = &rt.pools.ingest;
    let id = Uuid::new_v4();
    let job =
        json!({"CounterOnly":{"org_id":org,"project_id":project,"fingerprint":"budget-check"}});
    // Exact tiny limits force the actual admission transaction to reject without leaving a receipt.
    let value: String = sqlx::query_scalar("SELECT ingest_enqueue($1,$2,$3,$4,1,1)")
        .bind(org)
        .bind(project)
        .bind(id)
        .bind(job.clone())
        .fetch_one(pool)
        .await
        .unwrap();
    assert_eq!(value, "full");
    assert!(!ingest_queue::received(pool, org, project, id)
        .await
        .unwrap());
    let foreign = Uuid::new_v4();
    assert!(ingest_queue::enqueue(pool, foreign, project, id, job)
        .await
        .is_err());
    let stats = ingest_queue::stats(pool).await.unwrap();
    assert!(stats.bytes >= 0);
    assert!(stats.pending >= 0);
}
