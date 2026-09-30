mod support;

use reqwest::Client;
use support::spawn_test_server;
use uuid::Uuid;

const DEV_PASSWORD: &str = "devpassword";

struct RegistrationEnv;

impl RegistrationEnv {
    fn closed() -> Self {
        std::env::set_var("EPURE_REGISTRATION", "false");
        Self
    }
}

impl Drop for RegistrationEnv {
    fn drop(&mut self) {
        std::env::remove_var("EPURE_REGISTRATION");
    }
}

#[tokio::test]
async fn registration_flag_blocks_public_signup_and_keeps_login_and_invites() {
    let (base_url, _pool, handle) = spawn_test_server().await;
    let client = Client::new();

    let open_config = client
        .get(format!("{base_url}/api/v1/auth/config"))
        .send()
        .await
        .expect("open config");
    assert_eq!(open_config.status(), 200);
    let open_body: serde_json::Value = open_config.json().await.expect("open config json");
    assert_eq!(open_body["registration_enabled"], true);

    let email = format!(
        "open-{}@epure.local",
        &Uuid::new_v4().simple().to_string()[..8]
    );
    let registered = client
        .post(format!("{base_url}/api/v1/auth/register"))
        .json(&serde_json::json!({
            "email": email,
            "password": "open-pass-123"
        }))
        .send()
        .await
        .expect("register while open");
    assert_eq!(registered.status(), 204);

    let _guard = RegistrationEnv::closed();

    let closed_config = client
        .get(format!("{base_url}/api/v1/auth/config"))
        .send()
        .await
        .expect("closed config");
    let closed_body: serde_json::Value = closed_config.json().await.expect("closed config json");
    assert_eq!(closed_body["registration_enabled"], false);

    let blocked = client
        .post(format!("{base_url}/api/v1/auth/register"))
        .json(&serde_json::json!({
            "email": format!("blocked-{}@epure.local", &Uuid::new_v4().simple().to_string()[..8]),
            "password": "blocked-pass-123"
        }))
        .send()
        .await
        .expect("register while closed");
    assert_eq!(blocked.status(), 403);

    let owner = Client::builder()
        .cookie_store(true)
        .build()
        .expect("owner client");
    let login = owner
        .post(format!("{base_url}/api/v1/auth/login"))
        .json(&serde_json::json!({
            "email": "dev@epure.local",
            "password": DEV_PASSWORD
        }))
        .send()
        .await
        .expect("login while closed");
    assert_eq!(login.status(), 204);

    let invite_email = format!(
        "invite-{}@epure.local",
        &Uuid::new_v4().simple().to_string()[..8]
    );
    let invite = owner
        .post(format!("{base_url}/api/v1/invitations"))
        .json(&serde_json::json!({
            "email": invite_email,
            "role": "member"
        }))
        .send()
        .await
        .expect("create invitation");
    assert_eq!(invite.status(), 201);
    let invite_body: serde_json::Value = invite.json().await.expect("invite json");
    let invite_token = invite_body["invite_token"].as_str().expect("invite token");

    let invitee = Client::builder()
        .cookie_store(true)
        .build()
        .expect("invitee client");
    let invited = invitee
        .post(format!("{base_url}/api/v1/auth/register"))
        .json(&serde_json::json!({
            "email": invite_email,
            "password": "invitee-pass-123",
            "invite_token": invite_token
        }))
        .send()
        .await
        .expect("register with invite while closed");
    assert_eq!(invited.status(), 204);

    let me = invitee
        .get(format!("{base_url}/api/v1/auth/me"))
        .send()
        .await
        .expect("invitee session");
    assert_eq!(me.status(), 200);

    drop(_guard);
    handle.abort();
}
