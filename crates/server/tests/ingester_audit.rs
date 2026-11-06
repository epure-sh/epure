mod support;
use serde_json::json;
use std::time::{Duration, Instant};
use support::{auth_header, project_id, spawn_test_server};
use uuid::Uuid;

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn concurrent_http_flood_preserves_exact_counts_and_other_errors() {
    tracing_subscriber::fmt()
        .with_test_writer()
        .with_max_level(tracing::Level::WARN)
        .try_init()
        .expect("initialize ingest audit logging");
    let (url, pool, server) = spawn_test_server().await;
    let restricted = epure_storage::connect_pools(&std::env::var("DATABASE_URL").unwrap())
        .await
        .unwrap();
    let key = format!("audit-{}", Uuid::new_v4());
    let fingerprint = epure_envelope::preview_fingerprint(
        &serde_json::to_vec(&json!({"fingerprint":[key]})).unwrap(),
    );
    let total = std::env::var("EPURE_AUDIT_EVENTS")
        .ok()
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(2000);
    let client = reqwest::Client::new();
    let start = Instant::now();
    let mut tasks = tokio::task::JoinSet::new();
    for worker in 0..16 {
        let client = client.clone();
        let url = url.clone();
        let key = key.clone();
        tasks.spawn(async move {
   for n in (worker..total).step_by(16) {
    let event=json!({"event_id":Uuid::new_v4().simple().to_string(),"fingerprint":[key],"message":format!("Order {n} failed"),"environment":"audit","tags":{"audit":"flood"}});
    let response=client.post(format!("{url}/api/{}/store/",project_id())).header("X-Sentry-Auth",auth_header()).json(&event).send().await.unwrap();
    assert_eq!(response.status(),202);
   }
  });
    }
    while let Some(result) = tasks.join_next().await {
        result.unwrap();
    }
    let duration = start.elapsed();
    // The audit checks exact accounting, so allow a busy CI runner to finish
    // draining the same 2,000-event burst.
    let deadline = Instant::now() + Duration::from_secs(90);
    let (issue, count, bodies, counter, body_counter) = loop {
        let row=sqlx::query_as::<_,(Uuid,i64,i64,i64,i64)>("SELECT i.id,i.event_count::bigint,(SELECT count(*) FROM events e WHERE e.issue_id=i.id),COALESCE((SELECT sum(count)::bigint FROM issue_counters c WHERE c.project_id=i.project_id AND c.fingerprint=i.fingerprint),0),COALESCE((SELECT sum(bodies_stored)::bigint FROM issue_counters c WHERE c.project_id=i.project_id AND c.fingerprint=i.fingerprint),0) FROM issues i WHERE i.project_id=$1 AND i.fingerprint=$2").bind(project_id()).bind(&fingerprint).fetch_optional(&pool).await.unwrap();
        if let Some(r) = row {
            if r.1 == total as i64 && r.3 == total as i64 {
                break r;
            }
            if Instant::now() > deadline {
                // Say why the backlog did not drain: which rows are still queued and why.
                let queue = sqlx::query_as::<_, (String, Option<String>, i64, i32, f64)>(
                    "SELECT status, last_error, count(*)::bigint, max(attempts), \
                     COALESCE(max(extract(epoch FROM available_at - now())), 0)::float8 \
                     FROM ingest_inbox WHERE project_id=$1 AND status<>'done' \
                     GROUP BY 1,2 ORDER BY 3 DESC",
                )
                .bind(project_id())
                .fetch_all(&pool)
                .await
                .unwrap();
                let budget = sqlx::query_as::<_, (Uuid, i64, i64)>(
                    "SELECT org_id, pending_count, pending_bytes FROM ingest_backlog_budget",
                )
                .fetch_all(&pool)
                .await
                .unwrap();
                panic!("bad accounting: {r:?}; queue (status, last_error, rows, max_attempts, next_in_s): {queue:?}; budget: {budget:?}");
            }
        }
        assert!(Instant::now() < deadline, "ingestion did not drain");
        tokio::time::sleep(Duration::from_millis(100)).await;
    };
    assert_eq!(count, total as i64);
    assert_eq!(counter, total as i64);
    assert_eq!(bodies, body_counter);
    assert!(bodies > 0 && bodies < total as i64);
    // A genuine different issue must survive the flood.
    let other = format!("audit-other-{}", Uuid::new_v4());
    let id = Uuid::new_v4();
    let body = json!({"event_id":id.simple().to_string(),"fingerprint":[other],"message":"Distinct failure"});
    for _ in 0..3 {
        assert_eq!(
            client
                .post(format!("{url}/api/{}/store/", project_id()))
                .header("X-Sentry-Auth", auth_header())
                .json(&body)
                .send()
                .await
                .unwrap()
                .status(),
            202
        );
    }
    let other_fingerprint =
        epure_envelope::preview_fingerprint(&serde_json::to_vec(&body).unwrap());
    let other_count: i64 = tokio::time::timeout(Duration::from_secs(30), async {
        loop {
            let count = sqlx::query_scalar(
                "SELECT i.event_count::bigint FROM issues i JOIN ingest_inbox q ON q.project_id=i.project_id
                 WHERE i.project_id=$1 AND i.fingerprint=$2 AND q.event_id=$3 AND q.status='done'",
            )
            .bind(project_id())
            .bind(&other_fingerprint)
            .bind(id)
            .fetch_optional(&pool)
            .await
            .unwrap();
            if let Some(count) = count {
                break count;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    })
    .await
    .expect("distinct failure did not finish processing");
    assert_eq!(other_count, 1);
    eprintln!("FLOOD total={total} http_seconds={:.3} accepted_per_sec={:.0} stored={bodies} count={count} counters={counter} issue={issue}",duration.as_secs_f64(),total as f64/duration.as_secs_f64());

    // Replaying a persisted batch must not increase occurrences, bodies or tag totals.
    let timestamp = chrono::Utc::now();
    let event = epure_storage::events::InsertEventParams {
        id: Uuid::new_v4(),
        org_id: Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap(),
        project_id: project_id(),
        issue_id: issue,
        occurred_at: timestamp,
        environment: Some("audit".into()),
        release: Some("audit-1".into()),
        platform: None,
        runtime_name: None,
        runtime_version: None,
        browser_name: None,
        os_name: None,
        country_code: None,
        user_id: None,
        user_email: None,
        payload_json: json!({"tags":{"audit":"replay"}}),
        stack_frames: None,
        breadcrumbs: None,
    };
    assert_eq!(
        epure_storage::persist::persist_event_batch(
            &restricted.ingest,
            std::slice::from_ref(&event)
        )
        .await
        .unwrap(),
        vec![event.id]
    );
    assert!(epure_storage::persist::persist_event_batch(
        &restricted.ingest,
        std::slice::from_ref(&event)
    )
    .await
    .unwrap()
    .is_empty());
    let after_replay: i64 =
        sqlx::query_scalar("SELECT event_count::bigint FROM issues WHERE id=$1")
            .bind(issue)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(after_replay, total as i64 + 1);
    // Force a foreign-key failure after counters: the entire flush must roll back.
    let org = Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap();
    let hour = chrono::Utc::now()
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_utc();
    let mut deltas = epure_storage::TelemetryDeltas::default();
    for _ in 0..2 {
        deltas.issue_counts.push(epure_storage::IssueCountDelta {
            org_id: org,
            project_id: project_id(),
            issue_id: issue,
            fingerprint: fingerprint.clone(),
            window_start: hour,
            count_delta: 1,
        });
    }
    deltas.tag_facets.push(epure_storage::TagFacetDelta {
        org_id: org,
        issue_id: Uuid::new_v4(),
        tag_key: "fault".into(),
        tag_value: "rollback".into(),
        count: 1,
    });
    assert!(
        epure_storage::persist::flush_all_telemetry_deltas(&restricted.ingest, &deltas)
            .await
            .is_err()
    );
    let unchanged: i64 = sqlx::query_scalar("SELECT event_count::bigint FROM issues WHERE id=$1")
        .bind(issue)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(unchanged, total as i64 + 1);
    deltas.tag_facets.clear();
    epure_storage::persist::flush_all_telemetry_deltas(&restricted.ingest, &deltas)
        .await
        .unwrap();
    let recovered: i64 = sqlx::query_scalar("SELECT event_count::bigint FROM issues WHERE id=$1")
        .bind(issue)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(recovered, total as i64 + 3);
    server.abort();
}
