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
