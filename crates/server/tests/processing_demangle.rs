mod support;

use epure_envelope::compute_fingerprint;
use epure_storage::events;
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

async fn upload_sourcemap(
    client: &reqwest::Client,
    base_url: &str,
    artifact_name: &str,
) -> reqwest::Response {
    let map_bytes = fs::read(processing_fixture("app.min.js.map")).expect("sourcemap fixture");
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
                    reqwest::multipart::Part::bytes(map_bytes)
                        .file_name("app.min.js.map")
                        .mime_str("application/json")
                        .expect("mime"),
                ),
        )
        .send()
        .await
        .expect("upload sourcemap")
}

#[tokio::test]
async fn processing_demangle_groups_and_scrubs() {
    let (base_url, pool, server) = spawn_test_server().await;
    let client = reqwest::Client::new();

    let upload = upload_sourcemap(&client, &base_url, "app.min.js.map").await;
    assert_eq!(upload.status(), reqwest::StatusCode::CREATED);

    let event = crash_event();
    let fingerprint = compute_fingerprint(&event);
    let payload = serde_json::to_vec(&event).expect("serialize event");

    for _ in 0..2 {
        let response = client
            .post(format!("{}/api/{}/store/", base_url, project_id()))
            .header("X-Sentry-Auth", auth_header())
            .header("Content-Type", "application/json")
            .body(payload.clone())
            .send()
            .await
            .expect("post crash");
        assert_eq!(response.status(), reqwest::StatusCode::ACCEPTED);
    }

    tokio::time::sleep(Duration::from_millis(750)).await;

    let issue_count = events::count_issues_for_fingerprint(&pool, project_id(), &fingerprint)
        .await
        .expect("issue count");
    assert_eq!(issue_count, 1);

    let stack_frames = events::latest_event_stack_frames(&pool, project_id())
        .await
        .expect("stack frames")
        .expect("stack frames present");
    let frames = stack_frames.as_array().expect("frame array");
    assert!(!frames.is_empty());
    assert_eq!(frames[0]["demangled"], true);
    assert_eq!(frames[0]["filename"], "src/app.ts");
    assert_eq!(frames[0]["function"], "throwError");
    assert_eq!(frames[0]["lineno"], 1);
    assert!(
        frames[0]["context"]
            .as_str()
            .is_some_and(|line| line.contains("function throwError"))
    );

    let breadcrumbs = events::latest_event_breadcrumbs(&pool, project_id())
        .await
        .expect("breadcrumbs")
        .expect("breadcrumbs present");
    let message = breadcrumbs[0]["message"].as_str().expect("breadcrumb message");
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

    tokio::time::sleep(Duration::from_millis(750)).await;

    let stack_frames = events::latest_event_stack_frames(&pool, project_id())
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
