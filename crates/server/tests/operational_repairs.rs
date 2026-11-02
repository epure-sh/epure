//! Regression coverage for the real-application audit. Uses an isolated local DB.
mod support;
use epure_storage::{
    connect_pools,
    monitor_deadlines::evaluate_deadlines,
    monitors::{self, RecordCheckInParams},
};
use reqwest::Client;
use serde_json::{json, Value};
use std::sync::{
    atomic::{AtomicU16, Ordering},
    Arc, Mutex,
};
use uuid::Uuid;

fn org() -> Uuid {
    Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap()
}
async fn client(base: &str) -> Client {
    let c = Client::builder().cookie_store(true).build().unwrap();
    assert_eq!(
        c.post(format!("{base}/api/v1/auth/login"))
            .json(&json!({"email":"dev@epure.local","password":"devpassword"}))
            .send()
            .await
            .unwrap()
            .status(),
        204
    );
    c
}
async fn body(r: reqwest::Response, expected: u16) -> Value {
    let status = r.status();
    let text = r.text().await.unwrap();
    assert_eq!(status.as_u16(), expected, "{text}");
    if text.is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&text).unwrap()
    }
}

#[tokio::test]
async fn audit_oauth_account_and_removed_session_regressions() {
    let (base, pool, handle) = support::spawn_test_server().await;
    let owner = client(&base).await;
    body(
        owner
            .get(format!("{base}/api/v1/user/connected-apps"))
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    body(
        owner
            .get(format!("{base}/api/v1/oauth/info?client_id=repair-check"))
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    let verifier = "repair-check-verifier-with-at-least-forty-three-characters";
    let challenge = epure_auth::oauth::base64url_encode_nopad(&epure_auth::oauth::sha256_hash(
        verifier.as_bytes(),
    ));
    let approval = json!({"client_id":"repair-check","client_name":"Repair regression","org_id":org(),"redirect_uri":"http://127.0.0.1:9876/callback","code_challenge":challenge,"code_challenge_method":"S256","scopes":["read:agent"]});
    let code = body(
        owner
            .post(format!("{base}/api/v1/oauth/authorize"))
            .json(&approval)
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    let token = body(
        owner
            .post(format!("{base}/oauth/token"))
            .form(&[
                ("grant_type", "authorization_code"),
                ("code", code["code"].as_str().unwrap()),
                ("client_id", "repair-check"),
                ("code_verifier", verifier),
                ("redirect_uri", "http://127.0.0.1:9876/callback"),
            ])
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    let access = token["access_token"].as_str().unwrap();
    body(
        Client::new()
            .get(format!("{base}/api/v1/agent/whoami"))
            .bearer_auth(access)
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    let apps = body(
        owner
            .get(format!("{base}/api/v1/user/connected-apps"))
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    let id = apps["connected_apps"]
        .as_array()
        .unwrap()
        .iter()
        .find(|a| a["client_id"] == "repair-check")
        .unwrap()["id"]
        .as_str()
        .unwrap();
    body(
        owner
            .delete(format!("{base}/api/v1/user/connected-apps/{id}"))
            .send()
            .await
            .unwrap(),
        204,
    )
    .await;
    assert_eq!(
        Client::new()
            .get(format!("{base}/api/v1/agent/whoami"))
            .bearer_auth(access)
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
    let mut foreign = approval.clone();
    foreign["org_id"] = json!(Uuid::new_v4());
    body(
        owner
            .post(format!("{base}/api/v1/oauth/authorize"))
            .json(&foreign)
            .send()
            .await
            .unwrap(),
        403,
    )
    .await;
    body(
        owner
            .post(format!("{base}/oauth/token"))
            .json(&json!({"grant_type":"invalid"}))
            .send()
            .await
            .unwrap(),
        400,
    )
    .await;
    body(
        owner
            .post(format!("{base}/oauth/token"))
            .form(&[("grant_type", "invalid")])
            .send()
            .await
            .unwrap(),
        400,
    )
    .await;

    // Create disposable members through real invitation/registration endpoints.
    for remove in [false, true] {
        let email = format!("repair-{}@epure.local", Uuid::new_v4());
        let invite = body(
            owner
                .post(format!("{base}/api/v1/invitations"))
                .json(&json!({"email":email,"role":"admin"}))
                .send()
                .await
                .unwrap(),
            201,
        )
        .await;
        let invite_token = invite["token"]
            .as_str()
            .or_else(|| invite["invite_token"].as_str())
            .expect("invitation token");
        let c = Client::builder().cookie_store(true).build().unwrap();
        body(c.post(format!("{base}/api/v1/auth/register")).json(&json!({"email":email,"password":"repair-password-123456","invite_token":invite_token})).send().await.unwrap(),204).await;
        let me = body(
            c.get(format!("{base}/api/v1/auth/me"))
                .send()
                .await
                .unwrap(),
            200,
        )
        .await;
        if remove {
            body(
                owner
                    .delete(format!(
                        "{base}/api/v1/members/{}",
                        me["user_id"].as_str().unwrap()
                    ))
                    .send()
                    .await
                    .unwrap(),
                200,
            )
            .await;
        } else {
            body(
                c.delete(format!("{base}/api/v1/auth/account"))
                    .json(&json!({"confirm_email":email,"password":"repair-password-123456"}))
                    .send()
                    .await
                    .unwrap(),
                204,
            )
            .await;
            let count: i64 = sqlx::query_scalar("SELECT count(*) FROM users WHERE email=$1")
                .bind(&email)
                .fetch_one(&pool)
                .await
                .unwrap();
            assert_eq!(count, 0);
        }
        assert_eq!(
            c.get(format!("{base}/api/v1/auth/me"))
                .send()
                .await
                .unwrap()
                .status(),
            401
        );
        assert_eq!(
            c.get(format!("{base}/api/v1/projects"))
                .send()
                .await
                .unwrap()
                .status(),
            401
        );
    }
    handle.abort();
}

#[tokio::test]
async fn audit_delivery_and_deadline_regressions() {
    let (base, pool, handle) = support::spawn_test_server().await;
    let owner = client(&base).await;
    let pools = connect_pools(&std::env::var("DATABASE_URL").unwrap())
        .await
        .unwrap();
    let status = Arc::new(AtomicU16::new(503));
    let receipts = Arc::new(Mutex::new(Vec::<(String, Vec<u8>, String, String)>::new()));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}/hook", listener.local_addr().unwrap());
    let status_clone = status.clone();
    let receipts_clone = receipts.clone();
    let app = axum::Router::new().route(
        "/hook",
        axum::routing::post(
            move |headers: axum::http::HeaderMap, bytes: axum::body::Bytes| {
                let status = status_clone.clone();
                let receipts = receipts_clone.clone();
                async move {
                    receipts.lock().unwrap().push((
                        headers["x-epure-delivery-id"].to_str().unwrap().into(),
                        bytes.to_vec(),
                        headers["x-epure-timestamp"].to_str().unwrap().into(),
                        headers["x-epure-signature"].to_str().unwrap().into(),
                    ));
                    axum::http::StatusCode::from_u16(status.load(Ordering::SeqCst)).unwrap()
                }
            },
        ),
    );
    let receiver = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    let channel=body(owner.post(format!("{base}/api/v1/alert-channels")).json(&json!({"project_id":support::project_id(),"provider":"webhook","label":"Repair receiver","config":{"url":url},"require_verify":true})).send().await.unwrap(),201).await;
    let id = channel["id"].as_str().unwrap();
    let secret = channel["signing_secret"]
        .as_str()
        .unwrap()
        .trim_start_matches("whsec_");
    let secret = hex::decode(secret).unwrap();
    for code in [503, 401] {
        status.store(code, Ordering::SeqCst);
        let tested = body(
            owner
                .post(format!("{base}/api/v1/alert-channels/{id}/test"))
                .json(&json!({"enable_on_ok":true}))
                .send()
                .await
                .unwrap(),
            200,
        )
        .await;
        assert_eq!(tested["sent"], false);
        assert_eq!(tested["channel"]["last_test_status"], "fail");
        assert_eq!(tested["channel"]["is_enabled"], false);
    }
    status.store(200, Ordering::SeqCst);
    let tested = body(
        owner
            .post(format!("{base}/api/v1/alert-channels/{id}/test"))
            .json(&json!({"enable_on_ok":true}))
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    assert_eq!(tested["sent"], true);
    for (_, bytes, time, signature) in receipts.lock().unwrap().iter() {
        assert!(epure_server::lifecycle::webhook_sign::verify_payload(
            &secret, time, bytes, signature
        ));
    }
    let channels = epure_storage::alert_rules::get_channels_by_ids_ingest(
        &pools.ingest,
        org(),
        &[Uuid::parse_str(id).unwrap()],
    )
    .await
    .unwrap();
    assert_eq!(channels.len(), 1);
    let foreign = epure_storage::alert_rules::get_channels_by_ids_ingest(
        &pools.ingest,
        Uuid::parse_str("22222222-2222-2222-2222-222222222222").unwrap(),
        &[Uuid::parse_str(id).unwrap()],
    )
    .await;
    assert!(foreign.is_err() || foreign.unwrap().is_empty());
    let context = epure_server::lifecycle::webhooks::WebhookContext {
        project_id: support::project_id(),
        issue_id: Uuid::nil(),
        title: Some("Operational regression".into()),
        status: "unresolved".into(),
        release: None,
        event_count: 0,
    };
    body(
        owner
            .patch(format!("{base}/api/v1/alert-channels/{id}"))
            .json(&json!({"is_enabled":false}))
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    let before = receipts.lock().unwrap().len();
    epure_server::lifecycle::webhooks::dispatch_event(
        &pools.ingest,
        org(),
        "issue_created",
        &context,
    )
    .await;
    epure_server::lifecycle::webhooks::run_delivery_once(&pool)
        .await
        .unwrap();
    assert_eq!(
        receipts.lock().unwrap().len(),
        before,
        "paused destination sent"
    );
    body(
        owner
            .patch(format!("{base}/api/v1/alert-channels/{id}"))
            .json(&json!({"is_enabled":true}))
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    status.store(503, Ordering::SeqCst);
    epure_server::lifecycle::webhooks::dispatch_event(
        &pools.ingest,
        org(),
        "custom_rule",
        &context,
    )
    .await;
    epure_server::lifecycle::webhooks::run_delivery_once(&pool)
        .await
        .unwrap();
    let pending:(Uuid,i32)=sqlx::query_as("SELECT id,attempts FROM webhook_deliveries WHERE status='pending' AND webhook_id=(SELECT (config->>'webhook_id')::uuid FROM alert_channels WHERE id=$1) ORDER BY created_at DESC LIMIT 1").bind(Uuid::parse_str(id).unwrap()).fetch_one(&pool).await.unwrap();
    status.store(200, Ordering::SeqCst);
    sqlx::query("UPDATE webhook_deliveries SET next_attempt_at=now() WHERE id=$1")
        .bind(pending.0)
        .execute(&pool)
        .await
        .unwrap();
    epure_server::lifecycle::webhooks::run_delivery_once(&pool)
        .await
        .unwrap();
    let (state, attempts): (String, i32) =
        sqlx::query_as("SELECT status,attempts FROM webhook_deliveries WHERE id=$1")
            .bind(pending.0)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(state, "delivered");
    assert!(attempts >= 2);
    let matching = receipts
        .lock()
        .unwrap()
        .iter()
        .filter(|(id, _, _, _)| id == &pending.0.to_string())
        .count();
    assert!(matching >= 2, "retries must retain the delivery ID");

    // Clock-controlled integration reproduces minute-scale failures instantly.
    let slug = format!("repair-cron-{}", Uuid::new_v4());
    let params = RecordCheckInParams {
        slug: slug.clone(),
        status: "ok".into(),
        schedule: Some("every 1 minute".into()),
        schedule_type: Some("interval".into()),
        checkin_margin_mins: Some(1),
        max_runtime_mins: Some(1),
        failure_issue_threshold: Some(2),
        ..Default::default()
    };
    let monitor =
        monitors::record_check_in(&pools.ingest, org(), support::project_id(), params.clone())
            .await
            .unwrap();
    assert!(monitor.next_check_in_at.is_some());
    let initial = monitor.last_check_in_at.unwrap();
    evaluate_deadlines(&pool, initial + chrono::Duration::seconds(121))
        .await
        .unwrap();
    let (state, open): (String, bool) =
        sqlx::query_as("SELECT status,incident_open FROM monitors WHERE id=$1")
            .bind(monitor.id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(state, "missed");
    assert!(!open);
    evaluate_deadlines(&pool, initial + chrono::Duration::seconds(181))
        .await
        .unwrap();
    let transitions: i64 =
        sqlx::query_scalar("SELECT count(*) FROM monitor_transitions WHERE monitor_id=$1")
            .bind(monitor.id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(transitions, 1);
    evaluate_deadlines(&pool, initial + chrono::Duration::seconds(182))
        .await
        .unwrap();
    let same: i64 =
        sqlx::query_scalar("SELECT count(*) FROM monitor_transitions WHERE monitor_id=$1")
            .bind(monitor.id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(same, 1);
    monitors::record_check_in(&pools.ingest, org(), support::project_id(), params.clone())
        .await
        .unwrap();
    let recovered: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM monitor_transitions WHERE monitor_id=$1 AND kind='recovered'",
    )
    .bind(monitor.id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(recovered, 1);
    let running = RecordCheckInParams {
        status: "in_progress".into(),
        check_in_id: Some("new-run".into()),
        failure_issue_threshold: Some(1),
        ..params.clone()
    };
    let monitor = monitors::record_check_in(&pools.ingest, org(), support::project_id(), running)
        .await
        .unwrap();
    let stale = RecordCheckInParams {
        check_in_id: Some("old-run".into()),
        ..params.clone()
    };
    let still_running =
        monitors::record_check_in(&pools.ingest, org(), support::project_id(), stale)
            .await
            .unwrap();
    assert_eq!(still_running.status, "in_progress");
    evaluate_deadlines(
        &pool,
        monitor.last_check_in_at.unwrap() + chrono::Duration::seconds(61),
    )
    .await
    .unwrap();
    let state: String = sqlx::query_scalar("SELECT status FROM monitors WHERE id=$1")
        .bind(monitor.id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(state, "timeout");
    sqlx::query("UPDATE monitors SET paused=true WHERE id=$1")
        .bind(monitor.id)
        .execute(&pool)
        .await
        .unwrap();
    let before: i64 =
        sqlx::query_scalar("SELECT count(*) FROM monitor_transitions WHERE monitor_id=$1")
            .bind(monitor.id)
            .fetch_one(&pool)
            .await
            .unwrap();
    evaluate_deadlines(&pool, initial + chrono::Duration::days(3))
        .await
        .unwrap();
    let after: i64 =
        sqlx::query_scalar("SELECT count(*) FROM monitor_transitions WHERE monitor_id=$1")
            .bind(monitor.id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(before, after);
    receiver.abort();
    handle.abort();
}
