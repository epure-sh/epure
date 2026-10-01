use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{LazyLock, Mutex};
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
    let key = addr.ip().to_string();
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

#[cfg(test)]
mod agent_limit_tests {
    use super::agent_rate_limit_key;

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
}
