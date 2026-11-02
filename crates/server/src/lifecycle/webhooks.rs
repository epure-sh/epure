use epure_storage::webhooks::{self, WebhookDispatchRow};
use epure_storage::PgPool;
use reqwest::Client;
use serde_json::json;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
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
    if let Some(v4) = addr.to_ipv4_mapped() {
        return is_blocked_ipv4(v4);
    }
    if let Some(v4) = embedded_ipv4(addr) {
        if is_blocked_ipv4(v4) {
            return true;
        }
    }
    addr.is_loopback()
        || addr.is_unspecified()
        || (addr.segments()[0] & 0xfe00) == 0xfc00
        || (addr.segments()[0] & 0xffc0) == 0xfe80
}

fn embedded_ipv4(addr: Ipv6Addr) -> Option<Ipv4Addr> {
    let s = addr.segments();
    if s[0] == 0x2002 {
        return Some(Ipv4Addr::new(
            (s[1] >> 8) as u8,
            (s[1] & 0xff) as u8,
            (s[2] >> 8) as u8,
            (s[2] & 0xff) as u8,
        ));
    }
    if s[0] == 0x0064 && s[1] == 0xff9b && s[2] == 0 && s[3] == 0 && s[4] == 0 && s[5] == 0 {
        return Some(Ipv4Addr::new(
            (s[6] >> 8) as u8,
            (s[6] & 0xff) as u8,
            (s[7] >> 8) as u8,
            (s[7] & 0xff) as u8,
        ));
    }
    None
}

/// Result of SSRF validation: either unrestricted (dev) or DNS-pinned safe addrs.
#[derive(Debug, Clone)]
enum WebhookTarget {
    /// `EPURE_WEBHOOK_ALLOW_PRIVATE` — no SSRF pin (local/dev only).
    Unrestricted,
    /// Connect only via these pre-validated addresses (Host/SNI keep the original name).
    Pinned {
        host: String,
        addrs: Vec<SocketAddr>,
    },
}

/// Resolve once, reject blocked ranges, return addresses to pin on the HTTP client.
async fn resolve_webhook_target(url: &str) -> Option<WebhookTarget> {
    let parsed = match reqwest::Url::parse(url.trim()) {
        Ok(parsed) => parsed,
        Err(_) => return None,
    };
    let scheme = parsed.scheme();
    if scheme != "https" && scheme != "http" {
        return None;
    }
    if scheme == "http" && !webhook_allow_private() {
        return None;
    }

    let host = match parsed.host_str() {
        Some(host) if !host.is_empty() => host,
        _ => return None,
    };

    if webhook_allow_private() {
        return Some(WebhookTarget::Unrestricted);
    }

    let host_key = host.to_ascii_lowercase();

    if let Ok(addr) = host.parse::<IpAddr>() {
        if is_blocked_ip(addr) {
            return None;
        }
        // Port 0 → reqwest uses the scheme default (or the URL's explicit port).
        return Some(WebhookTarget::Pinned {
            host: host_key,
            addrs: vec![SocketAddr::new(addr, 0)],
        });
    }

    let port = parsed
        .port_or_known_default()
        .unwrap_or(if scheme == "https" { 443 } else { 80 });
    let lookup = tokio::net::lookup_host((host, port)).await;
    match lookup {
        Ok(addresses) => {
            let mut addrs = Vec::new();
            for address in addresses {
                if is_blocked_ip(address.ip()) {
                    return None;
                }
                // Normalize to port 0 so URL/scheme ports win (reqwest contract).
                addrs.push(SocketAddr::new(address.ip(), 0));
            }
            if addrs.is_empty() {
                return None;
            }
            Some(WebhookTarget::Pinned {
                host: host_key,
                addrs,
            })
        }
        Err(_) => None,
    }
}

pub async fn validate_webhook_url(url: &str) -> bool {
    resolve_webhook_target(url).await.is_some()
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

fn shared_http_client() -> &'static Client {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .expect("webhook http client")
    })
}

fn http_client_for(target: &WebhookTarget) -> Client {
    match target {
        WebhookTarget::Unrestricted => shared_http_client().clone(),
        WebhookTarget::Pinned { host, addrs } => Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .redirect(reqwest::redirect::Policy::none())
            // Pin the validated IPs so connect cannot re-resolve to a different address
            // (DNS rebinding / TOCTOU against the SSRF guard).
            .resolve_to_addrs(host, addrs)
            .build()
            .expect("pinned webhook http client"),
    }
}

pub async fn dispatch_event(pool: &PgPool, org_id: Uuid, event: &str, context: &WebhookContext) {
    let hooks = match webhooks::list_for_project_ingest(pool, org_id, context.project_id).await {
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
        enqueue_hook(pool, org_id, hook, event, context).await;
    }
}

/// Dispatch only to the given webhook IDs (used when a rule pins output channels).
pub async fn dispatch_event_to_webhooks(
    pool: &PgPool,
    org_id: Uuid,
    event: &str,
    context: &WebhookContext,
    webhook_ids: &[Uuid],
) {
    if webhook_ids.is_empty() {
        return;
    }
    for webhook_id in webhook_ids {
        let hook = match webhooks::get_for_dispatch_org(pool, org_id, *webhook_id).await {
            Ok(Some(row)) => row,
            Ok(None) => continue,
            Err(err) => {
                warn!("failed to load webhook {webhook_id}: {err}");
                continue;
            }
        };
        if hook.project_id != context.project_id {
            continue;
        }
        if !hook.events.iter().any(|value| value == event) && event != "test" {
            // Channel-linked hooks subscribe to custom_rule; still allow if subscribed.
            continue;
        }
        enqueue_hook(pool, org_id, hook, event, context).await;
    }
}

pub async fn dispatch_test(pool: &PgPool, org_id: Uuid, webhook_id: Uuid) -> Result<(), String> {
    let hook = webhooks::get_for_test_org(pool, org_id, webhook_id)
        .await
        .map_err(|err| err.to_string())?
        .ok_or_else(|| "webhook not found".to_string())?;

    let context = WebhookContext {
        project_id: hook.project_id,
        issue_id: Uuid::nil(),
        title: Some("Webhook test delivery".into()),
        status: "test".into(),
        release: None,
        event_count: 0,
    };
    let payload = format_payload(&hook, "test", &context);
    let id = Uuid::new_v4();
    let mut tx = epure_storage::rls::begin_org_transaction(pool, org_id)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query("INSERT INTO webhook_deliveries (id, org_id, project_id, webhook_id, event, payload, status, attempts) VALUES ($1,$2,$3,$4,'test',$5,'processing',1)")
        .bind(id).bind(org_id).bind(hook.project_id).bind(hook.id).bind(&payload)
        .execute(&mut *tx).await.map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())?;
    let result = send_hook(&hook, id, &payload).await;
    let mut tx = epure_storage::rls::begin_org_transaction(pool, org_id)
        .await
        .map_err(|e| e.to_string())?;
    let (status, http, error) = match &result {
        Ok(code) => ("delivered", Some(*code as i32), None),
        Err(failure) => (
            "failed",
            failure.http_status.map(i32::from),
            Some(failure.message.clone()),
        ),
    };
    sqlx::query("UPDATE webhook_deliveries SET status=$2, http_status=$3, last_error=$4, updated_at=now() WHERE id=$1")
        .bind(id).bind(status).bind(http).bind(error).execute(&mut *tx).await.map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())?;
    result.map(|_| ()).map_err(|e| e.message)
}

async fn enqueue_hook(
    pool: &PgPool,
    org_id: Uuid,
    hook: WebhookDispatchRow,
    event: &str,
    context: &WebhookContext,
) {
    let result = async {
        let mut tx = epure_storage::rls::begin_ingest_transaction(pool, org_id).await?;
        sqlx::query("INSERT INTO webhook_deliveries (id,org_id,project_id,webhook_id,event,payload) VALUES ($1,$2,$3,$4,$5,$6)")
            .bind(Uuid::new_v4()).bind(org_id).bind(hook.project_id).bind(hook.id)
            .bind(event).bind(format_payload(&hook,event,context)).execute(&mut *tx).await?;
        tx.commit().await
    }.await;
    if let Err(err) = result {
        warn!(webhook_id=%hook.id, "failed to queue webhook: {err}");
    }
}

struct DeliveryFailure {
    http_status: Option<u16>,
    retry: bool,
    message: String,
}

async fn send_hook(
    hook: &WebhookDispatchRow,
    id: Uuid,
    payload: &serde_json::Value,
) -> Result<u16, DeliveryFailure> {
    let target = resolve_webhook_target(&hook.url)
        .await
        .ok_or_else(|| DeliveryFailure {
            http_status: None,
            retry: false,
            message: "Webhook URL is unsafe or cannot be resolved".into(),
        })?;
    let body = serde_json::to_vec(payload).expect("webhook payload json");
    let timestamp = chrono::Utc::now().timestamp().to_string();
    let signature = super::webhook_sign::sign_payload(&hook.signing_secret, &timestamp, &body);
    let response = http_client_for(&target)
        .post(&hook.url)
        .header(SIGNATURE_HEADER, signature)
        .header(DELIVERY_HEADER, id.to_string())
        .header(TIMESTAMP_HEADER, timestamp)
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|_| DeliveryFailure {
            http_status: None,
            retry: true,
            message: "Webhook request failed or timed out".into(),
        })?;
    let status = response.status();
    if status.is_success() {
        return Ok(status.as_u16());
    }
    Err(DeliveryFailure {
        http_status: Some(status.as_u16()),
        retry: status.is_server_error() || status.as_u16() == 429,
        message: format!("Webhook returned HTTP {}", status.as_u16()),
    })
}

#[derive(sqlx::FromRow)]
struct PendingDelivery {
    id: Uuid,
    org_id: Uuid,
    project_id: Uuid,
    webhook_id: Uuid,
    payload: serde_json::Value,
    attempts: i32,
}

/// The maintenance pool owns cross-tenant job scheduling, like TTL. Each queued row
/// was inserted under tenant RLS; destinations are rechecked before every attempt.
pub async fn run_delivery_once(pool: &PgPool) -> Result<usize, sqlx::Error> {
    let rows = sqlx::query_as::<_, PendingDelivery>(
        r#"
        WITH due AS (
            SELECT id FROM webhook_deliveries
            WHERE status IN ('pending','processing') AND next_attempt_at <= now()
            ORDER BY next_attempt_at LIMIT 16 FOR UPDATE SKIP LOCKED
        )
        UPDATE webhook_deliveries d SET status='processing', attempts=attempts+1,
            next_attempt_at=now()+interval '45 seconds', updated_at=now()
        FROM due WHERE d.id=due.id
        RETURNING d.id,d.org_id,d.project_id,d.webhook_id,d.payload,d.attempts
    "#,
    )
    .fetch_all(pool)
    .await?;
    let count = rows.len();
    let mut tasks = tokio::task::JoinSet::new();
    for row in rows {
        let pool = pool.clone();
        tasks.spawn(async move { deliver_pending(&pool, row).await });
    }
    while let Some(result) = tasks.join_next().await {
        match result {
            Ok(Ok(())) => {}
            Ok(Err(e)) => warn!("webhook delivery recording failed: {e}"),
            Err(e) => warn!("webhook delivery task failed: {e}"),
        }
    }
    Ok(count)
}

async fn deliver_pending(pool: &PgPool, row: PendingDelivery) -> Result<(), sqlx::Error> {
    let hook=sqlx::query_as::<_,WebhookDispatchRow>(r#"
        SELECT w.id,w.project_id,w.url,w.format,w.events,w.signing_secret FROM webhooks w
        JOIN projects p ON p.id=w.project_id
        WHERE w.id=$1 AND p.org_id=$2 AND w.project_id=$3
          AND NOT EXISTS (SELECT 1 FROM alert_channels c WHERE c.org_id=$2
              AND c.project_id=w.project_id AND c.config->>'webhook_id'=w.id::text AND NOT c.is_enabled)
    "#).bind(row.webhook_id).bind(row.org_id).bind(row.project_id).fetch_optional(pool).await?;
    let (status, http, error) = if let Some(hook) = hook {
        match send_hook(&hook, row.id, &row.payload).await {
            Ok(code) => ("delivered", Some(i32::from(code)), None),
            Err(e) => (
                if e.retry && row.attempts < 3 {
                    "pending"
                } else {
                    "failed"
                },
                e.http_status.map(i32::from),
                Some(e.message),
            ),
        }
    } else {
        (
            "cancelled",
            None,
            Some("Destination removed or paused".to_string()),
        )
    };
    sqlx::query("UPDATE webhook_deliveries SET status=$2,http_status=$3,last_error=$4,next_attempt_at=now()+make_interval(secs => $5),updated_at=now() WHERE id=$1")
        .bind(row.id).bind(status).bind(http).bind(error).bind(if row.attempts<2 {2.0f64} else {8.0})
        .execute(pool).await?;
    Ok(())
}

pub async fn run_delivery_job(pool: PgPool) {
    let mut tick = tokio::time::interval(std::time::Duration::from_secs(1));
    tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        tick.tick().await;
        if let Err(e) = run_delivery_once(&pool).await {
            warn!("webhook outbox failed: {e}");
        }
    }
}

fn format_payload(
    hook: &WebhookDispatchRow,
    event: &str,
    context: &WebhookContext,
) -> serde_json::Value {
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::OnceLock;
    use tokio::sync::Mutex;

    fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    #[tokio::test]
    async fn mapped_ipv4_loopback_is_blocked() {
        let mapped: Ipv6Addr = "::ffff:127.0.0.1".parse().unwrap();
        assert!(is_blocked_ip(IpAddr::V6(mapped)));
        let _guard = env_lock().lock().await;
        std::env::remove_var("EPURE_WEBHOOK_ALLOW_PRIVATE");
        assert!(!validate_webhook_url("http://[::ffff:127.0.0.1]/hook").await);
    }

    #[tokio::test]
    async fn public_literal_ip_is_pinned() {
        let _guard = env_lock().lock().await;
        std::env::remove_var("EPURE_WEBHOOK_ALLOW_PRIVATE");
        let target = resolve_webhook_target("https://8.8.8.8/hook")
            .await
            .expect("public literal should resolve");
        match target {
            WebhookTarget::Pinned { host, addrs } => {
                assert_eq!(host, "8.8.8.8");
                assert_eq!(addrs.len(), 1);
                assert_eq!(addrs[0].ip(), IpAddr::V4(Ipv4Addr::new(8, 8, 8, 8)));
                assert_eq!(addrs[0].port(), 0);
            }
            WebhookTarget::Unrestricted => panic!("expected pinned target"),
        }
    }

    #[tokio::test]
    async fn link_local_metadata_ip_is_blocked() {
        let _guard = env_lock().lock().await;
        std::env::remove_var("EPURE_WEBHOOK_ALLOW_PRIVATE");
        assert!(!validate_webhook_url("https://169.254.169.254/latest/meta-data/").await);
    }

    #[test]
    fn unique_local_and_embedded_private_ipv4_are_blocked() {
        let ula: Ipv6Addr = "fd12::1".parse().unwrap();
        assert!(is_blocked_ip(IpAddr::V6(ula)));
        let sixto4_metadata: Ipv6Addr = "2002:a9fe:a9fe::".parse().unwrap();
        assert!(is_blocked_ip(IpAddr::V6(sixto4_metadata)));
        let nat64_loopback: Ipv6Addr = "64:ff9b::7f00:1".parse().unwrap();
        assert!(is_blocked_ip(IpAddr::V6(nat64_loopback)));
        let nat64_public: Ipv6Addr = "64:ff9b::808:808".parse().unwrap();
        assert!(!is_blocked_ip(IpAddr::V6(nat64_public)));
    }

    #[tokio::test]
    async fn private_literal_is_blocked() {
        let _guard = env_lock().lock().await;
        std::env::remove_var("EPURE_WEBHOOK_ALLOW_PRIVATE");
        assert!(!validate_webhook_url("https://10.0.0.1/hook").await);
        assert!(!validate_webhook_url("https://192.168.1.1/hook").await);
        assert!(!validate_webhook_url("https://127.0.0.1/hook").await);
    }

    #[tokio::test]
    async fn allow_private_skips_pin() {
        let _guard = env_lock().lock().await;
        std::env::set_var("EPURE_WEBHOOK_ALLOW_PRIVATE", "1");
        let target = resolve_webhook_target("http://127.0.0.1/hook")
            .await
            .expect("allow_private should accept loopback http");
        assert!(matches!(target, WebhookTarget::Unrestricted));
        std::env::remove_var("EPURE_WEBHOOK_ALLOW_PRIVATE");
    }
}
