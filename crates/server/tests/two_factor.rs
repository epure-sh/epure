//! TOTP two-factor login end to end against the dev user.

mod support;

use epure_auth::totp;
use reqwest::{Client, StatusCode};
use serde_json::{json, Value};
use std::time::{SystemTime, UNIX_EPOCH};
use support::spawn_test_server;
use uuid::Uuid;

const EMAIL: &str = "dev@epure.local";
const PASSWORD: &str = "devpassword";

fn dev_user() -> Uuid {
    Uuid::parse_str("33333333-3333-3333-3333-333333333333").unwrap()
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

fn code_at_step(secret: &[u8], offset: i64) -> String {
    let counter = (totp::counter_at(now()) as i64 + offset) as u64;
    format!("{:06}", totp::hotp(secret, counter))
}

fn client() -> Client {
    Client::builder().cookie_store(true).build().unwrap()
}

async fn login(client: &Client, base: &str) -> (StatusCode, Value) {
    let response = client
        .post(format!("{base}/api/v1/auth/login"))
        .json(&json!({ "email": EMAIL, "password": PASSWORD }))
        .send()
        .await
        .unwrap();
    let status = response.status();
    (status, response.json().await.unwrap_or(Value::Null))
}

async fn verify(client: &Client, base: &str, code: &str) -> StatusCode {
    client
        .post(format!("{base}/api/v1/auth/two-factor/verify"))
        .json(&json!({ "code": code }))
        .send()
        .await
        .unwrap()
        .status()
}

async fn me(client: &Client, base: &str) -> (StatusCode, Value) {
    let response = client
        .get(format!("{base}/api/v1/auth/me"))
        .send()
        .await
        .unwrap();
    let status = response.status();
    (status, response.json().await.unwrap_or(Value::Null))
}

#[tokio::test]
async fn totp_enrollment_login_recovery_and_disable() {
    let (base, pool, handle) = spawn_test_server().await;
    sqlx::query("SELECT auth_totp_disable($1)")
        .bind(dev_user())
        .execute(&pool)
        .await
        .unwrap();

    // Enroll.
    let owner = client();
    assert_eq!(login(&owner, &base).await.0, StatusCode::NO_CONTENT);
    let setup: Value = owner
        .post(format!("{base}/api/v1/auth/two-factor/setup"))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let secret = totp::base32_decode(setup["secret"].as_str().unwrap()).unwrap();
    assert!(setup["uri"]
        .as_str()
        .unwrap()
        .starts_with("otpauth://totp/Epure:"));

    let wrong = owner
        .post(format!("{base}/api/v1/auth/two-factor/enable"))
        .json(&json!({ "code": "000000" }))
        .send()
        .await
        .unwrap();
    assert!(wrong.status() == StatusCode::BAD_REQUEST || code_at_step(&secret, 0) == "000000");
    let enabled: Value = owner
        .post(format!("{base}/api/v1/auth/two-factor/enable"))
        .json(&json!({ "code": code_at_step(&secret, 0) }))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let recovery: Vec<String> = serde_json::from_value(enabled["recovery_codes"].clone()).unwrap();
    assert_eq!(recovery.len(), totp::RECOVERY_CODE_COUNT);
    let again = owner
        .post(format!("{base}/api/v1/auth/two-factor/setup"))
        .send()
        .await
        .unwrap();
    assert_eq!(again.status(), StatusCode::CONFLICT);
    assert_eq!(me(&owner, &base).await.1["two_factor_enabled"], true);

    // Login now needs the second factor; the pending state grants no API access.
    let c = client();
    let (status, body) = login(&c, &base).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["two_factor_required"], true);
    assert_eq!(me(&c, &base).await.0, StatusCode::UNAUTHORIZED);
    assert_eq!(verify(&c, &base, "12345").await, StatusCode::UNAUTHORIZED);
    // The enrollment code's time step is already used: replays are refused.
    assert_eq!(
        verify(&c, &base, &code_at_step(&secret, 0)).await,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        verify(&c, &base, &code_at_step(&secret, 1)).await,
        StatusCode::OK
    );
    assert_eq!(me(&c, &base).await.0, StatusCode::OK);

    // No pending sign-in: 410.
    assert_eq!(verify(&client(), &base, "123456").await, StatusCode::GONE);

    // A recovery code works once.
    let r = client();
    assert_eq!(login(&r, &base).await.0, StatusCode::OK);
    assert_eq!(
        verify(&r, &base, &recovery[0].to_uppercase()).await,
        StatusCode::OK
    );
    let r2 = client();
    assert_eq!(login(&r2, &base).await.0, StatusCode::OK);
    assert_eq!(
        verify(&r2, &base, &recovery[0]).await,
        StatusCode::UNAUTHORIZED
    );

    // Disable needs a valid code, then login is one step again.
    let off = owner
        .post(format!("{base}/api/v1/auth/two-factor/disable"))
        .json(&json!({ "code": "999999" }))
        .send()
        .await
        .unwrap();
    assert!(off.status() == StatusCode::BAD_REQUEST || off.status() == StatusCode::NO_CONTENT);
    let off = owner
        .post(format!("{base}/api/v1/auth/two-factor/disable"))
        .json(&json!({ "code": recovery[1] }))
        .send()
        .await
        .unwrap();
    assert_eq!(off.status(), StatusCode::NO_CONTENT);
    assert_eq!(login(&client(), &base).await.0, StatusCode::NO_CONTENT);

    sqlx::query("SELECT auth_totp_disable($1)")
        .bind(dev_user())
        .execute(&pool)
        .await
        .unwrap();
    handle.abort();
}
