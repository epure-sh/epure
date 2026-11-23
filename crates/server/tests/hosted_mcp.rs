//! Real HTTP discovery, DCR, browser consent/PKCE, scoped MCP calls and refresh/revocation.
mod support;
use reqwest::Client;
use serde_json::{json, Value};
async fn json_response(response: reqwest::Response, status: u16) -> Value {
    let endpoint = response.url().to_string();
    let actual = response.status().as_u16();
    let text = response.text().await.unwrap();
    assert_eq!(actual, status, "{endpoint}: {text}");
    serde_json::from_str(&text).unwrap()
}
#[tokio::test]
async fn hosted_connector_discovers_oauth_and_calls_tenant_scoped_named_tools() {
    std::env::set_var("EPURE_MCP_ENABLED", "true");
    let (base, _, server) = support::spawn_test_server().await;
    std::env::set_var("EPURE_PUBLIC_URL", &base);
    std::env::set_var("EPURE_INTERNAL_URL", &base);
    let client = Client::new();
    let rpc = json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"connector-test","version":"1"}}});
    let response = client
        .post(format!("{base}/mcp"))
        .json(&rpc)
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 401);
    assert!(response.headers()["www-authenticate"]
        .to_str()
        .unwrap()
        .contains("oauth-protected-resource/mcp"));
    let metadata = json_response(
        client
            .get(format!("{base}/.well-known/oauth-protected-resource/mcp"))
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    assert_eq!(metadata["resource"], format!("{base}/mcp"));
    let metadata = json_response(
        client
            .get(format!("{base}/.well-known/oauth-authorization-server"))
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    assert_eq!(metadata["client_id_metadata_document_supported"], false);
    let registration=json_response(client.post(format!("{base}/oauth/register")).json(&json!({"client_name":"Claude","redirect_uris":["https://claude.ai/api/mcp/auth_callback"],"token_endpoint_auth_method":"none"})).send().await.unwrap(),201).await;
    let id = registration["client_id"].as_str().unwrap();
    let owner = Client::builder().cookie_store(true).build().unwrap();
    assert_eq!(
        owner
            .post(format!("{base}/api/v1/auth/login"))
            .json(&json!({"email":"dev@epure.local","password":"devpassword"}))
            .send()
            .await
            .unwrap()
            .status(),
        204
    );
    let verifier = "hosted-mcp-test-verifier-with-at-least-forty-three-characters";
    let challenge = epure_auth::oauth::base64url_encode_nopad(&epure_auth::oauth::sha256_hash(
        verifier.as_bytes(),
    ));
    let mut approval = json!({"client_id":id,"client_name":"spoofed name","org_id":"11111111-1111-1111-1111-111111111111","redirect_uri":"https://claude.ai/api/mcp/auth_callback","code_challenge":challenge,"code_challenge_method":"S256","scopes":["read:agent"],"state":"test-state"});
    let mut bad = approval.clone();
    bad["redirect_uri"] = json!("https://attacker.invalid/callback");
    json_response(
        owner
            .post(format!("{base}/api/v1/oauth/authorize"))
            .json(&bad)
            .send()
            .await
            .unwrap(),
        400,
    )
    .await;
    let grant = json_response(
        owner
            .post(format!("{base}/api/v1/oauth/authorize"))
            .json(&approval)
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    let tokens = json_response(
        client
            .post(format!("{base}/oauth/token"))
            .form(&[
                ("grant_type", "authorization_code"),
                ("client_id", id),
                ("code", grant["code"].as_str().unwrap()),
                ("code_verifier", verifier),
                ("redirect_uri", "https://claude.ai/api/mcp/auth_callback"),
                ("resource", &format!("{base}/mcp")),
            ])
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    let access = tokens["access_token"].as_str().unwrap();
    let init = json_response(
        client
            .post(format!("{base}/mcp"))
            .bearer_auth(access)
            .json(&rpc)
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    assert_eq!(init["result"]["protocolVersion"], "2025-11-25");
    assert!(init["result"]["instructions"]
        .as_str()
        .unwrap()
        .contains("cron"));
    let list = json_response(
        client
            .post(format!("{base}/mcp"))
            .bearer_auth(access)
            .json(&json!({"jsonrpc":"2.0","id":2,"method":"tools/list"}))
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    assert!(list["result"]["tools"]
        .as_array()
        .unwrap()
        .iter()
        .any(|t| t["name"] == "epure_channels_create"));
    let read = json!({"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"epure_projects_list","arguments":{}}});
    let result = json_response(
        client
            .post(format!("{base}/mcp"))
            .bearer_auth(access)
            .json(&read)
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    assert_ne!(result["result"]["isError"], true, "{result}");
    assert!(result["result"]["structuredContent"].is_object());
    let write = json!({"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"epure_projects_create","arguments":{"name":"Unauthorized write"}}});
    let denied = client
        .post(format!("{base}/mcp"))
        .bearer_auth(access)
        .json(&write)
        .send()
        .await
        .unwrap();
    assert_eq!(denied.status(), 403);
    assert!(denied.headers()["www-authenticate"]
        .to_str()
        .unwrap()
        .contains("insufficient_scope"));
    let scope_header = denied.headers()["www-authenticate"].to_str().unwrap();
    assert!(scope_header.contains("read:agent write:admin"));
    let admin_read = json!({"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"epure_invitations_list","arguments":{}}});
    let denied_read = client
        .post(format!("{base}/mcp"))
        .bearer_auth(access)
        .json(&admin_read)
        .send()
        .await
        .unwrap();
    assert_eq!(denied_read.status(), 403);
    assert!(denied_read.headers()["www-authenticate"]
        .to_str()
        .unwrap()
        .contains("write:admin"));
    assert_eq!(
        client
            .get(format!("{base}/mcp"))
            .bearer_auth(access)
            .send()
            .await
            .unwrap()
            .status(),
        405
    );
    assert_eq!(
        client
            .post(format!("{base}/mcp"))
            .bearer_auth(access)
            .json(&json!({"jsonrpc":"2.0","method":"notifications/initialized"}))
            .send()
            .await
            .unwrap()
            .status(),
        202
    );
    let refreshed = json_response(
        client
            .post(format!("{base}/oauth/token"))
            .form(&[
                ("grant_type", "refresh_token"),
                ("client_id", id),
                ("refresh_token", tokens["refresh_token"].as_str().unwrap()),
                ("resource", &format!("{base}/mcp")),
            ])
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    assert_eq!(
        client
            .post(format!("{base}/mcp"))
            .bearer_auth(access)
            .json(&read)
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
    let access = refreshed["access_token"].as_str().unwrap();
    json_response(
        client
            .post(format!("{base}/mcp"))
            .bearer_auth(access)
            .json(&read)
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    assert_eq!(
        client
            .post(format!("{base}/oauth/revoke"))
            .form(&[
                ("client_id", id),
                ("token", refreshed["refresh_token"].as_str().unwrap())
            ])
            .send()
            .await
            .unwrap()
            .status(),
        200
    );
    assert_eq!(
        client
            .post(format!("{base}/mcp"))
            .bearer_auth(access)
            .json(&read)
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
    // Another consent can request administration, with its actual scopes visible to the owner.
    approval["scopes"] = json!(["read:agent", "write:triage", "write:admin"]);
    let grant = json_response(
        owner
            .post(format!("{base}/api/v1/oauth/authorize"))
            .json(&approval)
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    assert_eq!(
        client
            .post(format!("{base}/oauth/token"))
            .form(&[
                ("grant_type", "authorization_code"),
                ("client_id", "wrong-client"),
                ("code", grant["code"].as_str().unwrap()),
                ("code_verifier", verifier)
            ])
            .send()
            .await
            .unwrap()
            .status(),
        400
    );
    server.abort();
}

/// Open DCR stays open for MCP clients; the consent screen learns which
/// registrations it must flag, and unused registrations expire.
#[tokio::test]
async fn consent_info_flags_unverified_clients_and_unused_registrations_expire() {
    std::env::set_var("EPURE_MCP_ENABLED", "true");
    let (base, pool, server) = support::spawn_test_server().await;
    let client = Client::new();
    let register = |name: &str, redirect: &str| {
        client
            .post(format!("{base}/oauth/register"))
            .json(&json!({"client_name":name,"redirect_uris":[redirect]}))
            .send()
    };
    let attacker = json_response(
        register("Claude\u{202e}", "https://attacker.example.com/cb")
            .await
            .unwrap(),
        201,
    )
    .await;
    assert_eq!(attacker["client_name"], "Claude");
    let claude = json_response(
        register("Claude", "https://claude.ai/api/mcp/auth_callback")
            .await
            .unwrap(),
        201,
    )
    .await;

    let owner = Client::builder().cookie_store(true).build().unwrap();
    owner
        .post(format!("{base}/api/v1/auth/login"))
        .json(&json!({"email":"dev@epure.local","password":"devpassword"}))
        .send()
        .await
        .unwrap();
    let info = |id: &str, redirect: &str| {
        owner
            .get(format!("{base}/api/v1/oauth/info"))
            .query(&[("client_id", id), ("redirect_uri", redirect)])
            .send()
    };
    let flagged = json_response(
        info(
            attacker["client_id"].as_str().unwrap(),
            "https://attacker.example.com/cb",
        )
        .await
        .unwrap(),
        200,
    )
    .await;
    assert_eq!(flagged["verified"], false);
    assert_eq!(flagged["redirect_host"], "attacker.example.com");
    let known = json_response(
        info(
            claude["client_id"].as_str().unwrap(),
            "https://claude.ai/api/mcp/auth_callback",
        )
        .await
        .unwrap(),
        200,
    )
    .await;
    assert_eq!(known["verified"], true);

    // A registration unused for more than 7 days is removed; a fresh one stays.
    sqlx::query(
        "UPDATE oauth_clients SET verified_at = now() - interval '8 days' WHERE client_id = $1",
    )
    .bind(attacker["client_id"].as_str().unwrap())
    .execute(&pool)
    .await
    .unwrap();
    let removed: i32 = sqlx::query_scalar("SELECT oauth_expire_unused_registered_clients()")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(removed >= 1);
    let left: Vec<String> =
        sqlx::query_scalar("SELECT client_id FROM oauth_clients WHERE client_id = ANY($1)")
            .bind(vec![
                attacker["client_id"].as_str().unwrap().to_string(),
                claude["client_id"].as_str().unwrap().to_string(),
            ])
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(
        left,
        vec![claude["client_id"].as_str().unwrap().to_string()]
    );
    server.abort();
}
