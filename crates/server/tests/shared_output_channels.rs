mod support;
use reqwest::Client;
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use uuid::Uuid;
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
async fn shared_destination_filters_projects_delivers_once_and_survives_detach() {
    let (base, pool, handle) = support::spawn_test_server().await;
    let owner = client(&base).await;
    let mut ids = Vec::new();
    for name in ["Shared one", "Shared two", "Shared three"] {
        let project = body(
            owner
                .post(format!("{base}/api/v1/projects"))
                .json(&json!({"name":name}))
                .send()
                .await
                .unwrap(),
            201,
        )
        .await;
        ids.push(Uuid::parse_str(project["id"].as_str().unwrap()).unwrap());
    }
    let receipts = Arc::new(Mutex::new(Vec::<Value>::new()));
    let capture = receipts.clone();
    let sink = axum::Router::new().route(
        "/hook",
        axum::routing::post(move |axum::Json(payload): axum::Json<Value>| {
            let capture = capture.clone();
            async move {
                capture.lock().unwrap().push(payload);
                axum::http::StatusCode::OK
            }
        }),
    );
    let socket = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let destination = format!("http://{}/hook", socket.local_addr().unwrap());
    let receiver = tokio::spawn(async move { axum::serve(socket, sink).await.unwrap() });
    let channel=body(owner.post(format!("{base}/api/v1/alert-channels")).json(&json!({"project_ids":ids,"provider":"webhook","label":"Shared destination","config":{"url":destination},"require_verify":false})).send().await.unwrap(),201).await;
    let id = channel["id"].as_str().unwrap();
    assert_eq!(channel["project_ids"].as_array().unwrap().len(), 3);
    for project in &ids {
        let list = body(
            owner
                .get(format!("{base}/api/v1/alert-channels?project_id={project}"))
                .send()
                .await
                .unwrap(),
            200,
        )
        .await;
        assert_eq!(
            list["channels"]
                .as_array()
                .unwrap()
                .iter()
                .filter(|row| row["id"] == id)
                .count(),
            1
        );
    }
    body(
        owner
            .post(format!("{base}/api/v1/alert-channels"))
            .json(&json!({"project_ids":[],"provider":"email","label":"Invalid"}))
            .send()
            .await
            .unwrap(),
        400,
    )
    .await;
    body(
        owner
            .post(format!("{base}/api/v1/alert-channels"))
            .json(&json!({"project_ids":[Uuid::new_v4()],"provider":"email","label":"Foreign"}))
            .send()
            .await
            .unwrap(),
        404,
    )
    .await;
    let hook: String =
        sqlx::query_scalar("SELECT config->>'webhook_id' FROM alert_channels WHERE id=$1")
            .bind(Uuid::parse_str(id).unwrap())
            .fetch_one(&pool)
            .await
            .unwrap();
    let context = epure_server::lifecycle::webhooks::WebhookContext {
        project_id: ids[1],
        issue_id: Uuid::nil(),
        title: Some("Second project failure".into()),
        status: "unresolved".into(),
        release: None,
        event_count: 1,
    };
    epure_server::lifecycle::webhooks::dispatch_event_to_webhooks(
        &pool,
        Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap(),
        "custom_rule",
        &context,
        &[Uuid::parse_str(&hook).unwrap()],
    )
    .await;
    for _ in 0..20 {
        epure_server::lifecycle::webhooks::run_delivery_once(&pool)
            .await
            .unwrap();
        if !receipts.lock().unwrap().is_empty() {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }
    assert_eq!(
        receipts.lock().unwrap().len(),
        1,
        "a shared webhook must deliver once for its second project"
    );
    body(
        owner
            .delete(format!("{base}/api/v1/projects/{}", ids[0]))
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    let list = body(
        owner
            .get(format!(
                "{base}/api/v1/alert-channels?project_id={}",
                ids[1]
            ))
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    let remaining = list["channels"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| row["id"] == id)
        .unwrap();
    assert_eq!(remaining["project_ids"].as_array().unwrap().len(), 2);
    let test = body(
        owner
            .post(format!("{base}/api/v1/alert-channels/{id}/test"))
            .json(&json!({}))
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    assert_eq!(test["sent"], true);
    assert_eq!(
        receipts.lock().unwrap().len(),
        2,
        "one verification for the whole destination"
    );
    handle.abort();
    receiver.abort();
}
