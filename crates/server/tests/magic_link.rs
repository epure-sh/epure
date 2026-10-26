mod support;

use reqwest::Client;
use support::spawn_test_server;
use uuid::Uuid;

#[tokio::test]
async fn magic_link_verify_establishes_dashboard_session() {
    let (base_url, _pool, handle) = spawn_test_server().await;
    let http = Client::new();

    let email = format!(
        "magic-{}@epure.local",
        &Uuid::new_v4().simple().to_string()[..8]
    );

    let requested = http
        .post(format!("{base_url}/api/v1/auth/magic-link"))
        .json(&serde_json::json!({ "email": email }))
        .send()
        .await
        .expect("request magic link");
    assert_eq!(requested.status(), 200);

    let body: serde_json::Value = requested.json().await.expect("magic link json");
    assert_eq!(body["sent"], true);
    let dev_link_raw = body["dev_link"]
        .as_str()
        .expect("dev_link in debug integration tests");
    // `epure_public_url()` follows EPURE_BIND (127.0.0.1:0 during tests); hit the bound listener.
    let dev_link = dev_link_raw
        .split_once("/api/")
        .map(|(_, rest)| format!("{base_url}/api/{rest}"))
        .expect("dev_link path");

    let session_client = Client::builder()
        .cookie_store(true)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .expect("session client");

    let verify = session_client
        .get(&dev_link)
        .send()
        .await
        .expect("verify magic link");
    assert!(
        verify.status().is_redirection(),
        "expected redirect, got {}",
        verify.status()
    );

    let me = session_client
        .get(format!("{base_url}/api/v1/auth/me"))
        .send()
        .await
        .expect("me after magic link");
    assert_eq!(me.status(), 200);

    let me_body: serde_json::Value = me.json().await.expect("me json");
    assert_eq!(
        me_body.get("email").and_then(|v| v.as_str()),
        Some(email.as_str())
    );
    assert_eq!(me_body.get("role").and_then(|v| v.as_str()), Some("owner"));
    assert!(me_body.get("org_id").and_then(|v| v.as_str()).is_some());

    let reused = session_client
        .get(dev_link)
        .send()
        .await
        .expect("reuse link");
    assert_eq!(reused.status(), 401);

    handle.abort();
}
