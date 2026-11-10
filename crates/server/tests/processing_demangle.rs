mod support;

use serde_json::json;
use std::fs;
use std::time::Duration;
use support::{auth_header, project_id, spawn_test_server};

const RELEASE_VERSION: &str = "1.0.0";

fn processing_fixture(name: &str) -> std::path::PathBuf {
    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../fixtures/processing")
        .join(name)
}

fn crash_event() -> serde_json::Value {
    json!({
        "platform": "javascript",
        "release": RELEASE_VERSION,
        "level": "error",
        "exception": {
            "values": [{
                "type": "Error",
                "value": "boom",
                "stacktrace": {
                    "frames": [
                        {
                            "filename": "app.min.js",
                            "function": "n",
                            "lineno": 1,
                            "colno": 10,
                            "in_app": true
                        }
                    ]
                }
            }]
        },
        "breadcrumbs": {
            "values": [
                {
                    "category": "console",
                    "timestamp": 1_700_000_000.0,
                    "level": "info",
                    "message": "Authorization: Bearer sk_live_abcdef1234567890"
                }
            ]
        }
    })
}

async fn upload_release_file(
    client: &reqwest::Client,
    base_url: &str,
    artifact_name: &str,
    artifact_bytes: Vec<u8>,
) -> reqwest::Response {
    client
        .post(format!(
            "{}/api/{}/releases/{}/files/",
            base_url,
            project_id(),
            RELEASE_VERSION
        ))
        .header("X-Sentry-Auth", auth_header())
        .multipart(
            reqwest::multipart::Form::new()
                .text("name", artifact_name.to_string())
                .part(
                    "file",
                    reqwest::multipart::Part::bytes(artifact_bytes)
                        .file_name("app.min.js.map")
                        .mime_str("application/json")
                        .expect("mime"),
                ),
        )
        .send()
        .await
        .expect("upload release file")
}

async fn upload_sourcemap(
    client: &reqwest::Client,
    base_url: &str,
    artifact_name: &str,
) -> reqwest::Response {
    let map_bytes = fs::read(processing_fixture("app.min.js.map")).expect("sourcemap fixture");
    upload_release_file(client, base_url, artifact_name, map_bytes).await
}

#[tokio::test]
async fn release_upload_accepts_32_mib_nextjs_catch_all_artifact() {
    let (base_url, pool, server) = spawn_test_server().await;
    let client = reqwest::Client::new();
    let artifact_name = "~/_next/static/chunks/app/[[...path]]/page.js.map";
    let artifact_size = 32 * 1024 * 1024;

    let upload =
        upload_release_file(&client, &base_url, artifact_name, vec![b'x'; artifact_size]).await;
    assert_eq!(upload.status(), reqwest::StatusCode::CREATED);

    let storage_path = sqlx::query_scalar::<_, String>(
        r#"
        SELECT ra.storage_path
        FROM release_artifacts ra
        JOIN releases r ON r.id = ra.release_id
        WHERE r.project_id = $1 AND r.version = $2 AND ra.name = $3
        "#,
    )
    .bind(project_id())
    .bind(RELEASE_VERSION)
    .bind(artifact_name)
    .fetch_one(&pool)
    .await
    .expect("fetch stored artifact");
    let stored = fs::read(storage_path).expect("read stored artifact");
    assert_eq!(stored.len(), artifact_size);
    assert!(stored.iter().all(|byte| *byte == b'x'));

    server.abort();
}

#[tokio::test]
async fn release_upload_rejects_artifact_over_32_mib() {
    let (base_url, pool, server) = spawn_test_server().await;
    let client = reqwest::Client::new();
    let artifact_name = "oversized.js.map";

    let upload = upload_release_file(
        &client,
        &base_url,
        artifact_name,
        vec![b'x'; 32 * 1024 * 1024 + 1],
    )
    .await;
    assert_eq!(upload.status(), reqwest::StatusCode::PAYLOAD_TOO_LARGE);

    let stored = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM release_artifacts ra
        JOIN releases r ON r.id = ra.release_id
        WHERE r.project_id = $1 AND r.version = $2 AND ra.name = $3
        "#,
    )
    .bind(project_id())
    .bind(RELEASE_VERSION)
    .bind(artifact_name)
    .fetch_one(&pool)
    .await
    .expect("count artifacts");
    assert_eq!(stored, 0);

    server.abort();
}

#[tokio::test]
async fn release_upload_rejects_parent_segment_and_long_name() {
    let (base_url, _pool, server) = spawn_test_server().await;
    let client = reqwest::Client::new();

    let traversal = upload_release_file(&client, &base_url, "../outside.map", b"{}".to_vec()).await;
    assert_eq!(traversal.status(), reqwest::StatusCode::BAD_REQUEST);

    let long_name = format!("~/{}.map", "a".repeat(5000));
    let long = upload_release_file(&client, &base_url, &long_name, b"{}".to_vec()).await;
    assert_eq!(long.status(), reqwest::StatusCode::BAD_REQUEST);

    server.abort();
}

#[tokio::test]
async fn store_ingest_retains_two_mib_body_limit() {
    let (base_url, _pool, server) = spawn_test_server().await;
    let client = reqwest::Client::new();

    let response = client
        .post(format!("{}/api/{}/store/", base_url, project_id()))
        .header("X-Sentry-Auth", auth_header())
        .header("Content-Type", "application/json")
        .body(vec![b' '; 2 * 1024 * 1024 + 1])
        .send()
        .await
        .expect("post oversized store payload");
    assert_eq!(response.status(), reqwest::StatusCode::PAYLOAD_TOO_LARGE);

    server.abort();
}

#[tokio::test]
async fn processing_demangle_groups_and_scrubs() {
    let (base_url, pool, server) = spawn_test_server().await;
    let client = reqwest::Client::new();

    let upload = upload_sourcemap(&client, &base_url, "app.min.js.map").await;
    assert_eq!(upload.status(), reqwest::StatusCode::CREATED);

    let event = crash_event();
    let mut ids = Vec::<uuid::Uuid>::new();
    assert_eq!(
        upload_sourcemap(&client, &base_url, "other.min.js.map")
            .await
            .status(),
        reqwest::StatusCode::CREATED
    );
    let payload = serde_json::to_vec(&event).expect("serialize event");

    for index in 0..2 {
        let payload = if index == 1 {
            let mut second = event.clone();
            second["exception"]["values"][0]["stacktrace"]["frames"][0]["filename"] =
                json!("other.min.js");
            second["exception"]["values"][0]["stacktrace"]["frames"][0]["function"] =
                json!("differentGeneratedSymbol");
            serde_json::to_vec(&second).unwrap()
        } else {
            payload.clone()
        };
        let response = client
            .post(format!("{}/api/{}/store/", base_url, project_id()))
            .header("X-Sentry-Auth", auth_header())
            .header("Content-Type", "application/json")
            .body(payload.clone())
            .send()
            .await
            .expect("post crash");
        assert_eq!(response.status(), reqwest::StatusCode::ACCEPTED);
        ids.push(
            serde_json::from_value(
                response.json::<serde_json::Value>().await.unwrap()["id"].clone(),
            )
            .unwrap(),
        );
    }

    tokio::time::sleep(Duration::from_millis(750)).await;

    let issue_count: i64 =
        sqlx::query_scalar("SELECT count(DISTINCT issue_id) FROM events WHERE id=ANY($1)")
            .bind(&ids)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(issue_count, 1);

    let stack_frames = sqlx::query_scalar::<_, Option<serde_json::Value>>(
        "SELECT stack_frames FROM events WHERE id=ANY($1) ORDER BY occurred_at DESC LIMIT 1",
    )
    .bind(&ids)
    .fetch_one(&pool)
    .await
    .expect("stack frames")
    .expect("stack frames present");
    let frames = stack_frames.as_array().expect("frame array");
    assert!(!frames.is_empty());
    assert_eq!(frames[0]["demangled"], true);
    assert_eq!(frames[0]["filename"], "src/app.ts");
    assert_eq!(frames[0]["function"], "throwError");
    assert_eq!(frames[0]["lineno"], 1);
    assert!(frames[0]["context"]
        .as_str()
        .is_some_and(|line| line.contains("function throwError")));

    let breadcrumbs = sqlx::query_scalar::<_, Option<serde_json::Value>>(
        "SELECT breadcrumbs FROM events WHERE id=ANY($1) ORDER BY occurred_at DESC LIMIT 1",
    )
    .bind(&ids)
    .fetch_one(&pool)
    .await
    .expect("breadcrumbs")
    .expect("breadcrumbs present");
    let message = breadcrumbs[0]["message"]
        .as_str()
        .expect("breadcrumb message");
    assert!(message.contains("[REDACTED]"));
    assert!(!message.contains("sk_live"));

    server.abort();
}

#[tokio::test]
async fn processing_demangle_finds_prefixed_artifact_names() {
    let (base_url, pool, server) = spawn_test_server().await;
    let client = reqwest::Client::new();

    let upload = upload_sourcemap(&client, &base_url, "~/dist/app.min.js.map").await;
    assert_eq!(upload.status(), reqwest::StatusCode::CREATED);

    let event = crash_event();
    let payload = serde_json::to_vec(&event).expect("serialize event");
    let response = client
        .post(format!("{}/api/{}/store/", base_url, project_id()))
        .header("X-Sentry-Auth", auth_header())
        .header("Content-Type", "application/json")
        .body(payload)
        .send()
        .await
        .expect("post crash");
    assert_eq!(response.status(), reqwest::StatusCode::ACCEPTED);
    let id: uuid::Uuid =
        serde_json::from_value(response.json::<serde_json::Value>().await.unwrap()["id"].clone())
            .unwrap();

    tokio::time::sleep(Duration::from_millis(750)).await;

    let stack_frames = sqlx::query_scalar::<_, Option<serde_json::Value>>(
        "SELECT stack_frames FROM events WHERE id=$1",
    )
    .bind(id)
    .fetch_one(&pool)
    .await
    .expect("stack frames")
    .expect("stack frames present");
    let frames = stack_frames.as_array().expect("frame array");
    assert_eq!(frames[0]["demangled"], true);
    assert_eq!(frames[0]["function"], "throwError");

    server.abort();
}

#[tokio::test]
async fn release_upload_rejects_path_traversal_version() {
    let (base_url, _pool, server) = spawn_test_server().await;
    let client = reqwest::Client::new();
    let map_bytes = fs::read(processing_fixture("app.min.js.map")).expect("sourcemap fixture");

    let upload = client
        .post(format!(
            "{}/api/{}/releases/{}/files/",
            base_url,
            project_id(),
            "1.0..0"
        ))
        .header("X-Sentry-Auth", auth_header())
        .multipart(
            reqwest::multipart::Form::new()
                .text("name", "app.min.js.map")
                .part(
                    "file",
                    reqwest::multipart::Part::bytes(map_bytes)
                        .file_name("app.min.js.map")
                        .mime_str("application/json")
                        .expect("mime"),
                ),
        )
        .send()
        .await
        .expect("upload sourcemap");
    assert_eq!(upload.status(), reqwest::StatusCode::BAD_REQUEST);

    server.abort();
}
