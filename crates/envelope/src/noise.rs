//! Optional inbound noise rules.
//!
//! Presets match signals that are not application bugs: an extension URL at
//! the throw site, a known crawler user agent, a localhost leak into
//! production, Internet Explorer, ResizeObserver, or a chunk-load error.
//! Custom rules are case-insensitive substrings of at least 8 characters so
//! a one-word pattern cannot hide an unrelated exception.

use serde_json::Value;

pub const MIN_PATTERN_LEN: usize = 8;
pub const MAX_PATTERNS: usize = 20;
pub const MAX_PATTERN_LEN: usize = 120;

#[derive(Debug, Clone, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct NoisePolicy {
    pub extensions: bool,
    pub crawlers: bool,
    pub localhost: bool,
    pub legacy_browsers: bool,
    pub resize_observer: bool,
    pub chunk_load: bool,
    pub message_patterns: Vec<String>,
}

impl NoisePolicy {
    pub fn sanitize_patterns(patterns: &[String]) -> Vec<String> {
        let mut out = Vec::new();
        for pattern in patterns {
            let trimmed = pattern.trim();
            if trimmed.chars().count() < MIN_PATTERN_LEN
                || trimmed.chars().count() > MAX_PATTERN_LEN
            {
                continue;
            }
            if out.iter().any(|existing: &String| existing == trimmed) {
                continue;
            }
            out.push(trimmed.to_string());
            if out.len() == MAX_PATTERNS {
                break;
            }
        }
        out
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NoiseMatch {
    pub rule: &'static str,
    pub detail: String,
}

/// `Some` when the event should be counted and not stored.
pub fn match_noise(
    event: &Value,
    user_agent: Option<&str>,
    policy: &NoisePolicy,
) -> Option<NoiseMatch> {
    if policy.extensions && throw_site_is_extension(event) {
        return Some(NoiseMatch {
            rule: "extensions",
            detail: "throw site is a browser-extension URL".to_string(),
        });
    }
    if policy.crawlers && user_agent.is_some_and(is_known_crawler) {
        return Some(NoiseMatch {
            rule: "crawlers",
            detail: "user agent is a known crawler".to_string(),
        });
    }
    if policy.localhost && is_production(event) && request_is_loopback(event) {
        return Some(NoiseMatch {
            rule: "localhost",
            detail: "production event came from a loopback host".to_string(),
        });
    }
    if policy.legacy_browsers && user_agent.is_some_and(is_legacy_browser) {
        return Some(NoiseMatch {
            rule: "legacy_browsers",
            detail: "user agent is Internet Explorer".to_string(),
        });
    }
    if policy.resize_observer && is_resize_observer(event) {
        return Some(NoiseMatch {
            rule: "resize_observer",
            detail: "ResizeObserver loop notification".to_string(),
        });
    }
    if policy.chunk_load && is_chunk_load(event) {
        return Some(NoiseMatch {
            rule: "chunk_load",
            detail: "JavaScript chunk failed to load".to_string(),
        });
    }
    let message = exception_text(event);
    for pattern in &policy.message_patterns {
        if pattern.chars().count() < MIN_PATTERN_LEN {
            continue;
        }
        if contains_ignore_ascii_case(&message, pattern) {
            return Some(NoiseMatch {
                rule: "pattern",
                detail: pattern.clone(),
            });
        }
    }
    None
}

pub fn outcome_reason(matched: &NoiseMatch) -> String {
    if matched.rule == "pattern" {
        let slug: String = matched
            .detail
            .chars()
            .take(80)
            .map(|ch| {
                if ch.is_ascii_alphanumeric() {
                    ch.to_ascii_lowercase()
                } else {
                    '-'
                }
            })
            .collect();
        format!("noise:pattern:{slug}")
    } else {
        format!("noise:{}", matched.rule)
    }
}

fn throw_site_is_extension(event: &Value) -> bool {
    let Some(frame) = innermost_frame(event) else {
        return false;
    };
    let filename = frame
        .get("filename")
        .or_else(|| frame.get("abs_path"))
        .and_then(Value::as_str)
        .unwrap_or("");
    is_extension_url(filename)
}

fn is_extension_url(filename: &str) -> bool {
    let lower = filename.to_ascii_lowercase();
    lower.starts_with("chrome-extension://")
        || lower.starts_with("moz-extension://")
        || lower.starts_with("safari-web-extension://")
        || lower.starts_with("safari-extension://")
        || lower.starts_with("webkit-masked-url://")
}

fn is_known_crawler(user_agent: &str) -> bool {
    const TOKENS: &[&str] = &[
        "googlebot",
        "bingbot",
        "baiduspider",
        "yandexbot",
        "duckduckbot",
        "petalbot",
        "applebot",
        "slurp",
        "facebookexternalhit",
        "twitterbot",
        "linkedinbot",
        "semrushbot",
        "ahrefsbot",
        "bytespider",
    ];
    let lower = user_agent.to_ascii_lowercase();
    TOKENS.iter().any(|token| lower.contains(token))
}

fn is_legacy_browser(user_agent: &str) -> bool {
    user_agent.contains("MSIE ") || user_agent.contains("Trident/")
}

fn is_production(event: &Value) -> bool {
    let environment = event
        .get("environment")
        .and_then(Value::as_str)
        .unwrap_or("");
    matches!(
        environment.to_ascii_lowercase().as_str(),
        "production" | "prod"
    )
}

fn request_is_loopback(event: &Value) -> bool {
    let url = event
        .pointer("/request/url")
        .and_then(Value::as_str)
        .unwrap_or("");
    let server = event
        .get("server_name")
        .and_then(Value::as_str)
        .unwrap_or("");
    host_is_loopback(url) || host_is_loopback(server)
}

fn host_is_loopback(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.contains("://localhost")
        || lower.contains("://127.0.0.1")
        || lower.contains("://[::1]")
        || lower == "localhost"
        || lower == "127.0.0.1"
        || lower == "::1"
}

fn is_resize_observer(event: &Value) -> bool {
    const EXACT: &[&str] = &[
        "ResizeObserver loop limit exceeded",
        "ResizeObserver loop completed with undelivered notifications",
    ];
    let text = exception_text(event);
    EXACT.iter().any(|needle| text.trim() == *needle)
        || exception_type(event) == "ResizeObserverLoopError"
}

fn is_chunk_load(event: &Value) -> bool {
    if exception_type(event) == "ChunkLoadError" {
        return true;
    }
    let text = exception_text(event);
    text.starts_with("Loading chunk ") || text.starts_with("Loading CSS chunk ")
}

fn exception_type(event: &Value) -> String {
    event
        .pointer("/exception/values/0/type")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string()
}

fn exception_text(event: &Value) -> String {
    if let Some(text) = event
        .pointer("/exception/values/0/value")
        .and_then(Value::as_str)
    {
        return text.to_string();
    }
    if let Some(text) = event.get("message").and_then(Value::as_str) {
        return text.to_string();
    }
    if let Some(text) = event
        .get("message")
        .and_then(|value| value.get("formatted"))
        .and_then(Value::as_str)
    {
        return text.to_string();
    }
    String::new()
}

fn innermost_frame(event: &Value) -> Option<&Value> {
    event
        .pointer("/exception/values/0/stacktrace/frames")
        .or_else(|| event.pointer("/stacktrace/frames"))
        .and_then(Value::as_array)
        .and_then(|frames| frames.last())
}

fn contains_ignore_ascii_case(haystack: &str, needle: &str) -> bool {
    if needle.is_empty() || haystack.len() < needle.len() {
        return false;
    }
    let haystack = haystack.as_bytes();
    let needle = needle.as_bytes();
    haystack.windows(needle.len()).any(|window| {
        window
            .iter()
            .zip(needle.iter())
            .all(|(left, right)| left.eq_ignore_ascii_case(right))
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClientDiscard {
    pub reason: String,
    pub category: String,
    pub quantity: u64,
}

pub fn parse_client_report(payload: &[u8]) -> Vec<ClientDiscard> {
    let Ok(value) = serde_json::from_slice::<Value>(payload) else {
        return Vec::new();
    };
    let Some(items) = value.get("discarded_events").and_then(Value::as_array) else {
        return Vec::new();
    };
    items
        .iter()
        .filter_map(|item| {
            let reason = item.get("reason").and_then(Value::as_str)?.trim();
            let quantity = item.get("quantity").and_then(Value::as_u64).unwrap_or(0);
            if reason.is_empty() || quantity == 0 {
                return None;
            }
            let reason = sanitize_token(reason);
            if reason.is_empty() {
                return None;
            }
            let category = item
                .get("category")
                .and_then(Value::as_str)
                .map(sanitize_token)
                .unwrap_or_default();
            Some(ClientDiscard {
                reason,
                category,
                quantity: quantity.min(1_000_000),
            })
        })
        .collect()
}

pub fn client_event_id(payload: &[u8]) -> Option<uuid::Uuid> {
    let value = serde_json::from_slice::<Value>(payload).ok()?;
    let raw = value.get("event_id").and_then(Value::as_str)?;
    uuid::Uuid::parse_str(raw).ok()
}

fn sanitize_token(raw: &str) -> String {
    raw.chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || *ch == '_')
        .take(40)
        .collect::<String>()
        .to_ascii_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn event(value: serde_json::Value) -> Value {
        value
    }

    #[test]
    fn extension_throw_site_matches_only_when_enabled() {
        let payload = event(json!({
            "exception": {
                "values": [{
                    "type": "TypeError",
                    "value": "x",
                    "stacktrace": {
                        "frames": [
                            { "filename": "app.js", "function": "run", "in_app": true },
                            { "filename": "chrome-extension://abc/content.js", "function": "hook", "in_app": false }
                        ]
                    }
                }]
            }
        }));
        assert!(match_noise(&payload, None, &NoisePolicy::default()).is_none());
        let policy = NoisePolicy {
            extensions: true,
            ..NoisePolicy::default()
        };
        let matched = match_noise(&payload, None, &policy).expect("extension");
        assert_eq!(matched.rule, "extensions");
    }

    #[test]
    fn app_throw_site_is_kept_when_an_extension_is_only_a_caller() {
        let payload = event(json!({
            "exception": {
                "values": [{
                    "type": "TypeError",
                    "value": "x",
                    "stacktrace": {
                        "frames": [
                            { "filename": "chrome-extension://abc/content.js", "function": "hook" },
                            { "filename": "https://app.example/main.js", "function": "submit", "in_app": true }
                        ]
                    }
                }]
            }
        }));
        let policy = NoisePolicy {
            extensions: true,
            ..NoisePolicy::default()
        };
        assert!(match_noise(&payload, None, &policy).is_none());
    }

    #[test]
    fn failed_to_fetch_is_not_a_preset() {
        let payload = event(json!({
            "exception": { "values": [{ "type": "TypeError", "value": "Failed to fetch" }] }
        }));
        let policy = NoisePolicy {
            extensions: true,
            crawlers: true,
            localhost: true,
            legacy_browsers: true,
            resize_observer: true,
            chunk_load: true,
            ..NoisePolicy::default()
        };
        assert!(match_noise(&payload, Some("Mozilla/5.0"), &policy).is_none());
        let with_pattern = NoisePolicy {
            message_patterns: vec!["Failed to fetch".to_string()],
            ..policy
        };
        assert_eq!(
            match_noise(&payload, None, &with_pattern).map(|m| m.rule),
            Some("pattern")
        );
    }

    #[test]
    fn chunk_load_and_resize_observer_are_exact() {
        let policy = NoisePolicy {
            chunk_load: true,
            resize_observer: true,
            ..NoisePolicy::default()
        };
        let chunk = event(json!({
            "exception": { "values": [{ "type": "ChunkLoadError", "value": "Loading chunk 12 failed" }] }
        }));
        assert_eq!(
            match_noise(&chunk, None, &policy).map(|m| m.rule),
            Some("chunk_load")
        );
        let resize = event(json!({
            "exception": { "values": [{ "type": "Error", "value": "ResizeObserver loop limit exceeded" }] }
        }));
        assert_eq!(
            match_noise(&resize, None, &policy).map(|m| m.rule),
            Some("resize_observer")
        );
    }

    #[test]
    fn localhost_filter_requires_production() {
        let policy = NoisePolicy {
            localhost: true,
            ..NoisePolicy::default()
        };
        let dev = event(json!({
            "environment": "development",
            "request": { "url": "http://localhost:3000/app" },
            "exception": { "values": [{ "type": "Error", "value": "boom" }] }
        }));
        assert!(match_noise(&dev, None, &policy).is_none());
        let prod = event(json!({
            "environment": "production",
            "request": { "url": "http://127.0.0.1:3000/app" },
            "exception": { "values": [{ "type": "Error", "value": "boom" }] }
        }));
        assert_eq!(
            match_noise(&prod, None, &policy).map(|m| m.rule),
            Some("localhost")
        );
    }

    #[test]
    fn short_patterns_are_dropped() {
        let cleaned = NoisePolicy::sanitize_patterns(&[
            "err".to_string(),
            "ResizeObserver loop limit exceeded".to_string(),
            "ResizeObserver loop limit exceeded".to_string(),
        ]);
        assert_eq!(
            cleaned,
            vec!["ResizeObserver loop limit exceeded".to_string()]
        );
    }

    #[test]
    fn client_report_quantities_are_bounded() {
        let payload = br#"{"discarded_events":[
            {"reason":"queue_overflow","category":"error","quantity":12},
            {"reason":"before_send","category":"error","quantity":0},
            {"reason":"network_error","category":"error","quantity":50000000}
        ]}"#;
        let discards = parse_client_report(payload);
        assert_eq!(discards.len(), 2);
        assert_eq!(discards[0].reason, "queue_overflow");
        assert_eq!(discards[0].quantity, 12);
        assert_eq!(discards[1].quantity, 1_000_000);
    }
}
