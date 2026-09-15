use epure_storage::webhooks::{self, WebhookDispatchRow};
use epure_storage::PgPool;
use reqwest::Client;
use serde_json::json;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::sync::OnceLock;
use tracing::warn;
use uuid::Uuid;

use super::webhook_sign::{DELIVERY_HEADER, SIGNATURE_HEADER, TIMESTAMP_HEADER};

fn webhook_allow_private() -> bool {
    std::env::var("EPURE_WEBHOOK_ALLOW_PRIVATE")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

fn is_blocked_ip(addr: IpAddr) -> bool {
    match addr {
        IpAddr::V4(ipv4) => is_blocked_ipv4(ipv4),
        IpAddr::V6(ipv6) => is_blocked_ipv6(ipv6),
    }
}

fn is_blocked_ipv4(addr: Ipv4Addr) -> bool {
    addr.is_private()
        || addr.is_loopback()
        || addr.is_link_local()
        || addr.is_unspecified()
        || addr.is_broadcast()
        || addr.is_documentation()
        || addr.octets()[0] == 0
        || addr.octets()[0] == 100 && (addr.octets()[1] & 0b1100_0000) == 0b0100_0000
        || addr.octets()[0] == 169 && addr.octets()[1] == 254
}

fn is_blocked_ipv6(addr: Ipv6Addr) -> bool {
    addr.is_loopback()
        || addr.is_unspecified()
        || addr.segments()[0] == 0xfe80
        || addr.segments()[0] == 0xfc00
        || addr.segments()[0] == 0xfd00
        || (addr.segments()[0] & 0xffc0) == 0xfe80
}

pub async fn validate_webhook_url(url: &str) -> bool {
    let parsed = match reqwest::Url::parse(url.trim()) {
        Ok(parsed) => parsed,
        Err(_) => return false,
    };
    let scheme = parsed.scheme();
    if scheme != "https" && scheme != "http" {
        return false;
    }
    if scheme == "http" && !webhook_allow_private() {
        return false;
    }

    let host = match parsed.host_str() {
        Some(host) if !host.is_empty() => host,
        _ => return false,
    };

    if webhook_allow_private() {
        return true;
    }

    if let Ok(addr) = host.parse::<IpAddr>() {
        return !is_blocked_ip(addr);
    }

    let port = parsed.port_or_known_default().unwrap_or(if scheme == "https" { 443 } else { 80 });
    let lookup = tokio::net::lookup_host((host, port)).await;
    match lookup {
        Ok(addresses) => {
            let mut found = false;
            for address in addresses {
                found = true;
                if is_blocked_ip(address.ip()) {
                    return false;
                }
            }
            found
        }
        Err(_) => false,
    }
}

#[derive(Debug, Clone)]
pub struct WebhookContext {
    pub project_id: Uuid,
    pub issue_id: Uuid,
    pub title: Option<String>,
    pub status: String,
    pub release: Option<String>,
    pub event_count: i64,
}

fn http_client() -> &'static Client {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .expect("webhook http client")
    })
}

pub async fn dispatch_event(pool: &PgPool, event: &str, context: &WebhookContext) {
    let hooks = match webhooks::list_for_project_ingest(pool, context.project_id).await {
        Ok(rows) => rows,
        Err(err) => {
            warn!("failed to load webhooks: {err}");
            return;
        }
    };

    for hook in hooks {
        if !hook.events.iter().any(|value| value == event) {
            continue;
        }
        dispatch_hook(hook, event, context);
    }
}

pub async fn dispatch_test(
    pool: &PgPool,
    org_id: Uuid,
    webhook_id: Uuid,
) -> Result<(), String> {
    let hook = webhooks::get_for_dispatch_org(pool, org_id, webhook_id)
        .await
        .map_err(|err| err.to_string())?
        .ok_or_else(|| "webhook not found".to_string())?;

    let context = WebhookContext {
        project_id: hook.project_id,
        issue_id: Uuid::nil(),
        title: Some("Webhook test delivery".to_string()),
        status: "test".to_string(),
        release: Some("test@0.0.0".to_string()),
        event_count: 0,
    };
    dispatch_hook(hook, "test", &context);
    Ok(())
}

fn dispatch_hook(hook: WebhookDispatchRow, event: &str, context: &WebhookContext) {
    let payload = format_payload(&hook, event, context);
    let body = serde_json::to_vec(&payload).expect("webhook payload json");
    let signature = super::webhook_sign::sign_payload(&hook.signing_secret, &body);
    let delivery_id = Uuid::new_v4();
    let timestamp = chrono::Utc::now().timestamp().to_string();
    let url = hook.url.clone();

    tokio::spawn(async move {
        if !validate_webhook_url(&url).await {
            warn!("webhook dispatch blocked for unsafe url");
            return;
        }

        if let Err(err) = http_client()
            .post(url)
            .header(SIGNATURE_HEADER, signature)
            .header(DELIVERY_HEADER, delivery_id.to_string())
            .header(TIMESTAMP_HEADER, timestamp)
            .header("Content-Type", "application/json")
            .body(body)
            .send()
            .await
        {
            warn!("webhook dispatch failed: {err}");
        }
    });
}

fn format_payload(hook: &WebhookDispatchRow, event: &str, context: &WebhookContext) -> serde_json::Value {
    let title = context
        .title
        .clone()
        .unwrap_or_else(|| "Untitled issue".to_string());
    let release = context
        .release
        .clone()
        .unwrap_or_else(|| "unknown".to_string());

    match hook.format.as_str() {
        "slack" => json!({
            "text": format!("*{event}*: {title} ({release})"),
            "blocks": [{
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": format!(
                        "*{event}*\n*{title}*\nRelease: `{release}`\nEvents: {count}",
                        event = event,
                        title = title,
                        release = release,
                        count = context.event_count
                    )
                }
            }]
        }),
        "discord" => json!({
            "content": format!(
                "**{event}**: {title} (release `{release}`, {count} events)",
                event = event,
                title = title,
                release = release,
                count = context.event_count
            )
        }),
        _ => json!({
            "event": event,
            "issue_id": context.issue_id,
            "project_id": context.project_id,
            "title": title,
            "status": context.status,
            "release": context.release,
            "event_count": context.event_count,
        }),
    }
}
