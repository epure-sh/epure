use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use std::sync::{LazyLock, Mutex, OnceLock};
use std::time::{Duration, Instant};

use axum::{
    extract::{ConnectInfo, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};

const WINDOW: Duration = Duration::from_secs(60);
const MAX_REQUESTS: u32 = 20;

#[derive(Default)]
struct RateLimiter {
    buckets: HashMap<String, (Instant, u32)>,
}

static LOGIN_LIMITER: LazyLock<Mutex<RateLimiter>> =
    LazyLock::new(|| Mutex::new(RateLimiter::default()));

pub async fn login_rate_limit(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    request: Request,
    next: Next,
) -> Response {
    let forwarded = request
        .headers()
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok());
    let real_ip = request
        .headers()
        .get("x-real-ip")
        .and_then(|value| value.to_str().ok());
    let key = client_ip_from_peer(addr.ip(), forwarded, real_ip).to_string();
    let now = Instant::now();

    let allowed = {
        let mut limiter = match LOGIN_LIMITER.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        limiter
            .buckets
            .retain(|_, (started, _)| now.duration_since(*started) < WINDOW);
        let entry = limiter.buckets.entry(key).or_insert((now, 0));
        if now.duration_since(entry.0) >= WINDOW {
            *entry = (now, 0);
        }
        if entry.1 >= MAX_REQUESTS {
            false
        } else {
            entry.1 += 1;
            true
        }
    };

    if allowed {
        next.run(request).await
    } else {
        (
            StatusCode::TOO_MANY_REQUESTS,
            "Too many login attempts. Try again in a minute.",
        )
            .into_response()
    }
}

const AGENT_READ_MAX: u32 = 600;
const AGENT_WRITE_MAX: u32 = 120;

static AGENT_LIMITER: LazyLock<Mutex<RateLimiter>> =
    LazyLock::new(|| Mutex::new(RateLimiter::default()));

fn agent_rate_limit_key(ip: &str, authorization: Option<&str>) -> String {
    let token_suffix = authorization
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(str::trim)
        .and_then(epure_storage::agent_tokens::parse_token_prefix)
        .map(|prefix| format!("pat:{prefix}"))
        .unwrap_or_else(|| "anon".to_string());
    format!("{ip}:{token_suffix}")
}

fn agent_write_method(method: &http::Method) -> bool {
    matches!(
        *method,
        http::Method::PATCH | http::Method::POST | http::Method::PUT | http::Method::DELETE
    )
}

fn is_pat_bearer(authorization: Option<&str>) -> bool {
    authorization
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(str::trim)
        .and_then(epure_storage::agent_tokens::parse_token_prefix)
        .is_some()
}

pub async fn agent_rate_limit(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    request: Request,
    next: Next,
) -> Response {
    let auth = request
        .headers()
        .get(http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok());
    if !is_pat_bearer(auth) {
        return next.run(request).await;
    }

    let ip = addr.ip().to_string();
    let token_key = agent_rate_limit_key(&ip, auth);

    let max = if agent_write_method(request.method()) {
        AGENT_WRITE_MAX
    } else {
        AGENT_READ_MAX
    };

    let now = Instant::now();
    let allowed = {
        let mut limiter = match AGENT_LIMITER.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        limiter
            .buckets
            .retain(|_, (started, _)| now.duration_since(*started) < WINDOW);
        let entry = limiter.buckets.entry(token_key).or_insert((now, 0));
        if now.duration_since(entry.0) >= WINDOW {
            *entry = (now, 0);
        }
        if entry.1 >= max {
            false
        } else {
            entry.1 += 1;
            true
        }
    };

    if allowed {
        next.run(request).await
    } else {
        (
            StatusCode::TOO_MANY_REQUESTS,
            axum::Json(serde_json::json!({ "error": "rate_limit_exceeded" })),
        )
            .into_response()
    }
}

#[derive(Clone, Debug)]
enum ProxyTrust {
    Addr(IpAddr),
    V4 { network: u32, prefix: u8 },
    V6 { network: u128, prefix: u8 },
}

fn trusted_proxies() -> &'static [ProxyTrust] {
    static LIST: OnceLock<Vec<ProxyTrust>> = OnceLock::new();
    LIST.get_or_init(|| {
        parse_trusted_proxies(&std::env::var("EPURE_TRUSTED_PROXIES").unwrap_or_default())
    })
}

fn parse_trusted_proxies(raw: &str) -> Vec<ProxyTrust> {
    raw.split(',')
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .filter_map(parse_trust_entry)
        .collect()
}

fn parse_trust_entry(entry: &str) -> Option<ProxyTrust> {
    let (addr, prefix) = match entry.split_once('/') {
        Some((addr, prefix)) => (addr.trim(), Some(prefix.parse::<u8>().ok()?)),
        None => (entry, None),
    };
    let addr = addr.trim_matches(|c| c == '[' || c == ']');
    if let Ok(v4) = addr.parse::<Ipv4Addr>() {
        return match prefix {
            None => Some(ProxyTrust::Addr(IpAddr::V4(v4))),
            Some(prefix) if prefix <= 32 => Some(ProxyTrust::V4 {
                network: u32::from(v4),
                prefix,
            }),
            _ => None,
        };
    }
    if let Ok(v6) = addr.parse::<Ipv6Addr>() {
        return match prefix {
            None => Some(ProxyTrust::Addr(IpAddr::V6(v6))),
            Some(prefix) if prefix <= 128 => Some(ProxyTrust::V6 {
                network: u128::from(v6),
                prefix,
            }),
            _ => None,
        };
    }
    None
}

fn peer_is_trusted(peer: IpAddr, trusted: &[ProxyTrust]) -> bool {
    trusted.iter().any(|entry| match (entry, peer) {
        (ProxyTrust::Addr(addr), peer) => *addr == peer,
        (ProxyTrust::V4 { network, prefix }, IpAddr::V4(addr)) => {
            let mask = if *prefix == 0 {
                0
            } else {
                u32::MAX << (32 - prefix)
            };
            (u32::from(addr) & mask) == (*network & mask)
        }
        (ProxyTrust::V6 { network, prefix }, IpAddr::V6(addr)) => {
            if *prefix == 0 {
                return true;
            }
            let shift = 128 - u32::from(*prefix);
            (u128::from(addr) >> shift) == (*network >> shift)
        }
        _ => false,
    })
}

pub fn client_ip_from_peer(
    peer: IpAddr,
    forwarded_for: Option<&str>,
    real_ip: Option<&str>,
) -> IpAddr {
    client_ip(peer, forwarded_for, real_ip, trusted_proxies())
}

fn client_ip(
    peer: IpAddr,
    forwarded_for: Option<&str>,
    real_ip: Option<&str>,
    trusted: &[ProxyTrust],
) -> IpAddr {
    if !peer_is_trusted(peer, trusted) {
        return peer;
    }
    if let Some(ip) = client_from_forwarded(forwarded_for, trusted) {
        return ip;
    }
    if let Some(ip) = real_ip
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .and_then(|value| value.parse().ok())
    {
        return ip;
    }
    peer
}

fn client_from_forwarded(forwarded_for: Option<&str>, trusted: &[ProxyTrust]) -> Option<IpAddr> {
    let header = forwarded_for?;
    let hops: Vec<IpAddr> = header
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .filter_map(|value| value.parse().ok())
        .collect();
    if hops.is_empty() {
        return None;
    }
    for hop in hops.iter().rev() {
        if !peer_is_trusted(*hop, trusted) {
            return Some(*hop);
        }
    }
    hops.first().copied()
}

#[cfg(test)]
mod agent_limit_tests {
    use super::agent_rate_limit_key;
    use std::net::IpAddr;

    #[test]
    fn anonymous_requests_share_ip_bucket() {
        let key = agent_rate_limit_key("203.0.113.1", None);
        assert_eq!(key, "203.0.113.1:anon");
        let unique_bearer = agent_rate_limit_key(
            "203.0.113.1",
            Some("Bearer epure_pat_abcdefgh0123456789012345678901234"),
        );
        let other_bearer = agent_rate_limit_key(
            "203.0.113.1",
            Some("Bearer epure_pat_zzzzzzzz0123456789012345678901234"),
        );
        assert_eq!(unique_bearer, "203.0.113.1:pat:abcdefgh");
        assert_ne!(unique_bearer, other_bearer);
        let malformed = agent_rate_limit_key("203.0.113.1", Some("Bearer totally-wrong"));
        assert_eq!(malformed, "203.0.113.1:anon");
    }

    #[test]
    fn forwarded_for_is_ignored_unless_the_peer_is_trusted() {
        let trusted = super::parse_trusted_proxies("10.0.0.0/8, 192.0.2.1");
        let peer = "203.0.113.8".parse().unwrap();
        assert_eq!(
            super::client_ip(peer, Some("1.2.3.4"), None, &trusted),
            peer
        );
        let proxy = "10.1.2.3".parse().unwrap();
        assert_eq!(
            super::client_ip(proxy, Some("8.8.8.8, 203.0.113.9"), None, &trusted),
            "203.0.113.9".parse::<IpAddr>().unwrap()
        );
        let exact = "192.0.2.1".parse().unwrap();
        assert_eq!(
            super::client_ip(exact, None, Some("198.51.100.20"), &trusted),
            "198.51.100.20".parse::<IpAddr>().unwrap()
        );
    }
}
