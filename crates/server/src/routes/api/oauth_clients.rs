use crate::state::AppState;
use axum::{extract::State, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{sync::Arc, time::Duration};

pub(super) fn cimd_enabled() -> bool {
    std::env::var("EPURE_MCP_CIMD_ENABLED")
        .is_ok_and(|v| v == "1" || v.eq_ignore_ascii_case("true"))
}
fn loopback(url: &reqwest::Url) -> bool {
    url.scheme() == "http" && matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"))
}
fn safe_redirect(value: &str) -> bool {
    reqwest::Url::parse(value).is_ok_and(|url| {
        url.username().is_empty()
            && url.password().is_none()
            && url.fragment().is_none()
            && ((url.scheme() == "https" && url.host_str().is_some()) || loopback(&url))
    })
}
fn redirect_matches(registered: &str, requested: &str) -> bool {
    if registered == requested {
        return true;
    }
    match (
        reqwest::Url::parse(registered),
        reqwest::Url::parse(requested),
    ) {
        (Ok(mut a), Ok(mut b)) if loopback(&a) && loopback(&b) => {
            let _ = a.set_port(None);
            let _ = b.set_port(None);
            a == b
        }
        _ => false,
    }
}
/// Redirect hosts of MCP clients we recognise. A code sent there can only reach
/// that client, so the consent screen can name the destination with confidence.
const KNOWN_REDIRECT_HOSTS: &[&str] = &["claude.ai", "claude.com", "chatgpt.com"];

/// What the consent screen may say about a client. `verified` is false for a
/// self-registered client whose redirect leaves the user's machine for a host
/// we don't recognise: that is the consent-phishing case, so the UI warns.
pub(super) struct ClientTrust {
    pub verified: bool,
    pub redirect_host: String,
}
pub(super) fn client_trust(client_id: &str, redirect: &str) -> ClientTrust {
    let url = reqwest::Url::parse(redirect).ok();
    let redirect_host = url
        .as_ref()
        .and_then(|u| u.host_str())
        .unwrap_or("")
        .to_string();
    let local = url.as_ref().is_some_and(loopback);
    let known = KNOWN_REDIRECT_HOSTS.contains(&redirect_host.as_str());
    let self_registered = client_id.starts_with("epure_registered_");
    ClientTrust {
        verified: !self_registered || local || known,
        redirect_host: if local {
            "this computer".into()
        } else {
            redirect_host
        },
    }
}

/// Display names come from the registering client: keep printable text only,
/// collapse whitespace, cap the length.
fn clean_client_name(raw: Option<String>) -> String {
    let text: String = raw
        .unwrap_or_default()
        .chars()
        .map(|c| {
            // Control, bidi-override and zero-width characters can disguise a name.
            let hidden = matches!(c, '\u{200B}'..='\u{200F}' | '\u{202A}'..='\u{202E}' | '\u{2066}'..='\u{2069}' | '\u{FEFF}');
            if c.is_control() || hidden { ' ' } else { c }
        })
        .collect();
    let name = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let name: String = name.chars().take(80).collect();
    if name.is_empty() {
        "MCP client".into()
    } else {
        name
    }
}
#[derive(Deserialize)]
pub(super) struct Registration {
    redirect_uris: Vec<String>,
    client_name: Option<String>,
    token_endpoint_auth_method: Option<String>,
    grant_types: Option<Vec<String>>,
    response_types: Option<Vec<String>>,
}
pub(super) async fn register(
    State(state): State<Arc<AppState>>,
    Json(body): Json<Registration>,
) -> Result<(StatusCode, Json<Value>), (StatusCode, Json<Value>)> {
    if body.redirect_uris.is_empty()
        || body.redirect_uris.len() > 5
        || body
            .redirect_uris
            .iter()
            .any(|s| s.len() > 2048 || !safe_redirect(s))
        || body
            .token_endpoint_auth_method
            .as_deref()
            .is_some_and(|m| m != "none")
        || body.grant_types.as_ref().is_some_and(|v| {
            v.iter()
                .any(|s| s != "authorization_code" && s != "refresh_token")
        })
        || body
            .response_types
            .as_ref()
            .is_some_and(|v| v.iter().any(|s| s != "code"))
    {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error":"invalid_client_metadata"})),
        ));
    }
    let id = format!("epure_registered_{}", uuid::Uuid::new_v4().simple());
    let name = clean_client_name(body.client_name);
    // Housekeeping on the write path: drop self-registered clients unused for 7 days.
    let _ = sqlx::query_scalar::<_, i32>("SELECT oauth_expire_unused_registered_clients()")
        .fetch_one(&state.pools.app)
        .await;
    sqlx::query("INSERT INTO oauth_clients(client_id,client_name,redirect_uris) VALUES($1,$2,$3)")
        .bind(&id)
        .bind(&name)
        .bind(json!(body.redirect_uris))
        .execute(&state.pools.app)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"server_error"})),
            )
        })?;
    Ok((
        StatusCode::CREATED,
        Json(
            json!({"client_id":id,"client_name":name,"redirect_uris":body.redirect_uris,"token_endpoint_auth_method":"none","grant_types":["authorization_code","refresh_token"],"response_types":["code"]}),
        ),
    ))
}
pub(super) async fn validate(
    state: &AppState,
    client_id: &str,
    redirect: &str,
) -> Result<String, StatusCode> {
    if !safe_redirect(redirect) || client_id.len() > 2048 {
        return Err(StatusCode::BAD_REQUEST);
    }
    let cached:Option<(String,Value)>=sqlx::query_as("SELECT client_name,redirect_uris FROM oauth_clients WHERE client_id=$1 AND (client_id NOT LIKE 'https:%' OR verified_at>now()-interval '1 hour')").bind(client_id).fetch_optional(&state.pools.app).await.map_err(|_|StatusCode::INTERNAL_SERVER_ERROR)?;
    let (name, redirects) = if let Some(value) = cached {
        value
    } else if client_id.starts_with("https:") {
        if !cimd_enabled() {
            return Err(StatusCode::BAD_REQUEST);
        }
        let url = reqwest::Url::parse(client_id).map_err(|_| StatusCode::BAD_REQUEST)?;
        // CIMD fetches are deliberately limited to Anthropic's published identity host: no arbitrary URL fetch/SSRF.
        if url.scheme() != "https"
            || url.host_str() != Some("claude.ai")
            || url.port_or_known_default() != Some(443)
            || !url.username().is_empty()
            || url.password().is_some()
            || url.query().is_some()
            || url.fragment().is_some()
            || !url.path().starts_with("/oauth/")
        {
            return Err(StatusCode::BAD_REQUEST);
        }
        let mut response = reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .user_agent("EpureOAuth/0.3")
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .get(url)
            .send()
            .await
            .map_err(|_| StatusCode::BAD_GATEWAY)?;
        if !response.status().is_success() {
            return Err(StatusCode::BAD_REQUEST);
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| StatusCode::BAD_GATEWAY)?
        {
            if bytes.len() + chunk.len() > 65536 {
                return Err(StatusCode::BAD_REQUEST);
            }
            bytes.extend_from_slice(&chunk);
        }
        let doc: Value = serde_json::from_slice(&bytes).map_err(|_| StatusCode::BAD_REQUEST)?;
        if doc["client_id"].as_str() != Some(client_id)
            || doc["token_endpoint_auth_method"]
                .as_str()
                .is_some_and(|s| s != "none")
        {
            return Err(StatusCode::BAD_REQUEST);
        }
        let redirects = doc["redirect_uris"]
            .as_array()
            .filter(|a| !a.is_empty() && a.len() <= 10)
            .ok_or(StatusCode::BAD_REQUEST)?;
        if redirects
            .iter()
            .any(|r| r.as_str().is_none_or(|s| !safe_redirect(s)))
        {
            return Err(StatusCode::BAD_REQUEST);
        }
        let name = "Claude (claude.ai)".to_string();
        let redirects = json!(redirects);
        sqlx::query("INSERT INTO oauth_clients(client_id,client_name,redirect_uris) VALUES($1,$2,$3) ON CONFLICT(client_id) DO UPDATE SET redirect_uris=EXCLUDED.redirect_uris,verified_at=now()")
    .bind(client_id).bind(&name).bind(&redirects).execute(&state.pools.app).await.map_err(|_|StatusCode::INTERNAL_SERVER_ERROR)?;
        (name, redirects)
    } else {
        // Native Epure/legacy clients are public PKCE clients with loopback callbacks only.
        if client_id.starts_with("epure_registered_")
            || !reqwest::Url::parse(redirect).is_ok_and(|u| loopback(&u))
        {
            return Err(StatusCode::BAD_REQUEST);
        }
        return Ok(client_id.chars().take(80).collect());
    };
    if !redirects.as_array().is_some_and(|items| {
        items
            .iter()
            .any(|r| r.as_str().is_some_and(|r| redirect_matches(r, redirect)))
    }) {
        return Err(StatusCode::BAD_REQUEST);
    }
    Ok(name)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn redirect_binding() {
        assert!(redirect_matches(
            "http://localhost/callback",
            "http://localhost:4521/callback"
        ));
        assert!(!redirect_matches(
            "https://claude.ai/api/mcp/auth_callback",
            "https://claude.ai.evil.invalid/api/mcp/auth_callback"
        ));
        assert!(!safe_redirect("javascript:alert(1)"));
        assert!(!safe_redirect("https://user:pass@claude.ai/cb"));
        assert!(!redirect_matches(
            "http://localhost/callback",
            "http://localhost:4521/other"
        ));
    }

    #[test]
    fn self_registered_client_with_unknown_host_is_unverified() {
        let t = client_trust("epure_registered_abc", "https://attacker.example.com/cb");
        assert!(!t.verified);
        assert_eq!(t.redirect_host, "attacker.example.com");
    }

    #[test]
    fn known_hosts_and_loopback_are_verified() {
        assert!(
            client_trust(
                "epure_registered_abc",
                "https://claude.ai/api/mcp/auth_callback"
            )
            .verified
        );
        let local = client_trust("epure_registered_abc", "http://127.0.0.1:4521/callback");
        assert!(local.verified);
        assert_eq!(local.redirect_host, "this computer");
        assert!(
            !client_trust("epure_registered_abc", "https://claude.ai.evil.invalid/cb").verified
        );
        assert!(
            client_trust(
                "https://claude.ai/oauth/claude-code-client-metadata",
                "https://claude.ai/cb"
            )
            .verified
        );
    }

    #[test]
    fn client_names_are_cleaned() {
        assert_eq!(
            clean_client_name(Some("  Claude\n\u{202e}Code  ".into())),
            "Claude Code"
        );
        assert_eq!(clean_client_name(Some("\t\n".into())), "MCP client");
        assert_eq!(clean_client_name(None), "MCP client");
        assert_eq!(clean_client_name(Some("x".repeat(200))).chars().count(), 80);
    }
}
