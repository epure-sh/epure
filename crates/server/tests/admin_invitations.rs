mod support;

use epure_auth::GoogleAuth;
use epure_storage::{connect, connect_pools, run_migrations};
use reqwest::Client;
use support::{project_id, spawn_test_server};
use uuid::Uuid;

fn dev_org() -> Uuid {
    Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap()
}

const DEV_PASSWORD: &str = "devpassword";

#[tokio::test]
async fn invitation_register_applies_role_with_token() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url)
        .await
        .expect("connect migrate pool");
    run_migrations(&migrate_pool)
        .await
        .expect("run migrations");

    let pools = connect_pools(&database_url).await.expect("connect pools");
    support::seed_dev_pool(&pools.ingest)
        .await
        .expect("seed dev org");

    let invite_email = format!(
        "invite-{}@epure.local",
        &Uuid::new_v4().simple().to_string()[..8]
    );

    let (base_url, _pool, handle) = spawn_test_server().await;
    let owner_client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("owner client");

    let owner_login = owner_client
        .post(format!("{base_url}/api/v1/auth/login"))
        .json(&serde_json::json!({
            "email": "dev@epure.local",
            "password": DEV_PASSWORD
        }))
        .send()
        .await
        .expect("owner login");
    assert_eq!(owner_login.status(), 204);

    let invite = owner_client
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
    let invite_token = invite_body["invite_token"]
        .as_str()
        .expect("invite token");

    let invitee_client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("invitee client");

    let register = invitee_client
        .post(format!("{base_url}/api/v1/auth/register"))
        .json(&serde_json::json!({
            "email": invite_email,
            "password": "invitee-pass-123",
            "invite_token": invite_token
        }))
        .send()
        .await
        .expect("register invitee");
    assert_eq!(register.status(), 204);

    let me = invitee_client
        .get(format!("{base_url}/api/v1/auth/me"))
        .send()
        .await
        .expect("invitee me");
    assert_eq!(me.status(), 200);

    let me_body: serde_json::Value = me.json().await.expect("me json");
    assert_eq!(
        me_body.get("org_id").and_then(|v| v.as_str()),
        Some(dev_org().to_string().as_str())
    );
    assert_eq!(
        me_body.get("role").and_then(|v| v.as_str()),
        Some("member")
    );
    assert_eq!(
        me_body.get("email").and_then(|v| v.as_str()),
        Some(invite_email.as_str())
    );

    let issues = invitee_client
        .get(format!("{base_url}/api/v1/issues?project_id={}", project_id()))
        .send()
        .await
        .expect("invitee issues");
    assert_eq!(issues.status(), 200);

    handle.abort();
}

#[tokio::test]
async fn invitation_register_without_token_does_not_hijack_org() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url)
        .await
        .expect("connect migrate pool");
    run_migrations(&migrate_pool)
        .await
        .expect("run migrations");

    let pools = connect_pools(&database_url).await.expect("connect pools");
    support::seed_dev_pool(&pools.ingest)
        .await
        .expect("seed dev org");

    let invite_email = format!(
        "hijack-{}@epure.local",
        &Uuid::new_v4().simple().to_string()[..8]
    );

    let (base_url, _pool, handle) = spawn_test_server().await;
    let owner_client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("owner client");

    let owner_login = owner_client
        .post(format!("{base_url}/api/v1/auth/login"))
        .json(&serde_json::json!({
            "email": "dev@epure.local",
            "password": DEV_PASSWORD
        }))
        .send()
        .await
        .expect("owner login");
    assert_eq!(owner_login.status(), 204);

    let invite = owner_client
        .post(format!("{base_url}/api/v1/invitations"))
        .json(&serde_json::json!({
            "email": invite_email,
            "role": "admin"
        }))
        .send()
        .await
        .expect("create invitation");
    assert_eq!(invite.status(), 201);

    let attacker_client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("attacker client");

    let register = attacker_client
        .post(format!("{base_url}/api/v1/auth/register"))
        .json(&serde_json::json!({
            "email": invite_email,
            "password": "attacker-pass-123"
        }))
        .send()
        .await
        .expect("register attacker");
    assert_eq!(register.status(), 204);

    let me = attacker_client
        .get(format!("{base_url}/api/v1/auth/me"))
        .send()
        .await
        .expect("attacker me");
    assert_eq!(me.status(), 200);

    let me_body: serde_json::Value = me.json().await.expect("me json");
    assert_ne!(
        me_body.get("org_id").and_then(|v| v.as_str()),
        Some(dev_org().to_string().as_str())
    );
    assert_eq!(
        me_body.get("role").and_then(|v| v.as_str()),
        Some("owner")
    );

    handle.abort();
}

#[tokio::test]
async fn invitation_google_signup_applies_role_with_token() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url)
        .await
        .expect("connect migrate pool");
    run_migrations(&migrate_pool)
        .await
        .expect("run migrations");

    let pools = connect_pools(&database_url).await.expect("connect pools");
    support::seed_dev_pool(&pools.ingest)
        .await
        .expect("seed dev org");

    let invite_email = format!(
        "google-invite-{}@epure.local",
        &Uuid::new_v4().simple().to_string()[..8]
    );

    let (base_url, _pool, handle) = spawn_test_server().await;
    let owner_client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("owner client");

    let owner_login = owner_client
        .post(format!("{base_url}/api/v1/auth/login"))
        .json(&serde_json::json!({
            "email": "dev@epure.local",
            "password": DEV_PASSWORD
        }))
        .send()
        .await
        .expect("owner login");
    assert_eq!(owner_login.status(), 204);

    let invite = owner_client
        .post(format!("{base_url}/api/v1/invitations"))
        .json(&serde_json::json!({
            "email": invite_email,
            "role": "admin"
        }))
        .send()
        .await
        .expect("create invitation");
    assert_eq!(invite.status(), 201);
    let invite_body: serde_json::Value = invite.json().await.expect("invite json");
    let invite_token = invite_body["invite_token"]
        .as_str()
        .expect("invite token");

    let google = GoogleAuth::for_test(pools.ingest.clone());
    let google_sub = format!("google-sub-{}", Uuid::new_v4());
    let session = google
        .signup_new_user(&google_sub, &invite_email, Some(invite_token))
        .await
        .expect("google signup with invite");

    assert_eq!(session.org_id, dev_org());
    assert_eq!(session.role, "admin");
    assert_eq!(session.email, invite_email);

    handle.abort();
}
