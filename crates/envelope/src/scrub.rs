use regex::Regex;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::sync::LazyLock;

static BEARER_TOKEN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)bearer\s+[A-Za-z0-9\-._~+/]+=*").expect("bearer regex"));
static API_KEY: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(?i)(api[_-]?key|secret|token)\s*[:=]\s*['"]?[A-Za-z0-9\-._]{8,}"#)
        .expect("api key regex")
});
static PASSWORD: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(?i)(password|passwd|pwd)\s*[:=]\s*['"]?\S+"#).expect("password regex")
});
static CREDIT_CARD: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\b(?:\d[ -]*?){13,16}\b").expect("credit card regex"));
static AWS_KEY: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\bAKIA[0-9A-Z]{16}\b").expect("aws key regex"));
static STRIPE_KEY: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b").expect("stripe key regex")
});

const REDACTED: &str = "[REDACTED]";

static EMAIL: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}").expect("email regex")
});

/// How much end-user personal data a project keeps on newly ingested events.
///
/// The default stores an opaque `user.id` and drops email, username, IP, and
/// precise geo. Email-shaped ids are replaced with a stable pseudonym so
/// unique-user counts and erasure still work.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PrivacyPolicy {
    pub store_end_user_identifiers: bool,
}

impl Default for PrivacyPolicy {
    fn default() -> Self {
        Self {
            store_end_user_identifiers: false,
        }
    }
}

/// Stable short pseudonym. Not a secret: anyone with a candidate value can
/// recompute it, which is what erasure-by-email needs. It is not stored email.
pub fn pseudonym_for(value: &str) -> String {
    let normalized = value.trim().to_ascii_lowercase();
    let digest = Sha256::digest(normalized.as_bytes());
    format!("anon_{}", hex::encode(&digest[..8]))
}

pub fn looks_like_email(value: &str) -> bool {
    let value = value.trim();
    if value.len() > 320 || value.contains(' ') {
        return false;
    }
    EMAIL
        .find(value)
        .is_some_and(|matched| matched.start() == 0 && matched.end() == value.len())
}

/// Scrub secrets, then apply the project identifier policy.
pub fn apply_privacy_policy(event: &mut Value, policy: PrivacyPolicy) {
    scrub_event(event);
    if let Some(user) = event.get_mut("user") {
        apply_user_policy(user, policy);
    }
    if let Some(request) = event.get_mut("request") {
        scrub_request_urls(request, !policy.store_end_user_identifiers);
    }
    if !policy.store_end_user_identifiers {
        redact_emails(event);
    }
}

/// Scrub PII and secrets from headers, breadcrumbs, and extra fields.
pub fn scrub_event(event: &mut Value) {
    if let Some(request) = event.get_mut("request") {
        scrub_request(request);
    }

    if let Some(breadcrumbs) = event.get_mut("breadcrumbs") {
        scrub_breadcrumbs(breadcrumbs);
    }

    if let Some(extra) = event.get_mut("extra") {
        scrub_value(extra);
    }

    if let Some(contexts) = event.get_mut("contexts") {
        scrub_value(contexts);
    }
}

fn scrub_request(request: &mut Value) {
    if let Some(headers) = request.get_mut("headers").and_then(Value::as_object_mut) {
        for (key, value) in headers.iter_mut() {
            if is_sensitive_header(key) {
                *value = Value::String(REDACTED.to_string());
            } else if let Some(text) = value.as_str() {
                *value = Value::String(scrub_string(text));
            }
        }
    }

    if let Some(data) = request.get_mut("data") {
        scrub_value(data);
    }

    if request.get("cookies").is_some() {
        if let Some(object) = request.as_object_mut() {
            object.insert("cookies".to_string(), Value::String(REDACTED.to_string()));
        }
    }

    if let Some(env) = request.get_mut("env").and_then(Value::as_object_mut) {
        env.remove("REMOTE_ADDR");
        env.remove("HTTP_COOKIE");
        for key in [
            "HTTP_AUTHORIZATION",
            "HTTP_X_FORWARDED_FOR",
            "HTTP_X_REAL_IP",
        ] {
            if env.contains_key(key) {
                env.insert(key.to_string(), Value::String(REDACTED.to_string()));
            }
        }
    }
}

fn apply_user_policy(user: &mut Value, policy: PrivacyPolicy) {
    let Some(object) = user.as_object_mut() else {
        return;
    };
    object.remove("ip_address");
    if let Some(geo) = object.get_mut("geo").and_then(Value::as_object_mut) {
        for key in ["city", "region", "latitude", "longitude"] {
            geo.remove(key);
        }
    }
    if policy.store_end_user_identifiers {
        return;
    }
    object.remove("email");
    object.remove("username");
    object.remove("name");
    if let Some(id) = object.get("id").and_then(Value::as_str).map(str::to_string) {
        if looks_like_email(&id) {
            object.insert("id".to_string(), Value::String(pseudonym_for(&id)));
        }
    }
}

fn scrub_request_urls(request: &mut Value, strip_contact: bool) {
    if let Some(url) = request
        .get("url")
        .and_then(Value::as_str)
        .map(str::to_string)
    {
        if let Some(object) = request.as_object_mut() {
            object.insert(
                "url".to_string(),
                Value::String(redact_url(&url, strip_contact)),
            );
        }
    }
    if let Some(query) = request
        .get("query_string")
        .and_then(Value::as_str)
        .map(str::to_string)
    {
        if let Some(object) = request.as_object_mut() {
            object.insert(
                "query_string".to_string(),
                Value::String(redact_query(&query, strip_contact)),
            );
        }
    }
}

fn redact_url(raw: &str, strip_contact: bool) -> String {
    let (without_fragment, fragment) = match raw.split_once('#') {
        Some((left, right)) => (left, Some(right)),
        None => (raw, None),
    };
    let mut out = match without_fragment.split_once('?') {
        Some((path, query)) => format!("{path}?{}", redact_query(query, strip_contact)),
        None => without_fragment.to_string(),
    };
    if let Some(fragment) = fragment {
        out.push('#');
        if strip_contact {
            out.push_str(&scrub_email_text(fragment));
        } else {
            out.push_str(fragment);
        }
    }
    out
}

fn redact_query(query: &str, strip_contact: bool) -> String {
    query
        .split('&')
        .map(|pair| redact_query_pair(pair, strip_contact))
        .collect::<Vec<_>>()
        .join("&")
}

fn redact_query_pair(pair: &str, strip_contact: bool) -> String {
    let Some((key, value)) = pair.split_once('=') else {
        return pair.to_string();
    };
    let decoded_key = key.to_ascii_lowercase();
    if is_sensitive_query_key(&decoded_key) || (strip_contact && is_contact_query_key(&decoded_key))
    {
        format!("{key}={REDACTED}")
    } else if strip_contact {
        format!("{key}={}", scrub_email_text(value))
    } else {
        pair.to_string()
    }
}

fn is_sensitive_query_key(key: &str) -> bool {
    matches!(
        key,
        "password"
            | "passwd"
            | "pwd"
            | "secret"
            | "token"
            | "access_token"
            | "refresh_token"
            | "id_token"
            | "api_key"
            | "apikey"
            | "key"
            | "auth"
            | "authorization"
            | "cookie"
            | "session"
            | "code"
            | "signature"
            | "sig"
    )
}

fn is_contact_query_key(key: &str) -> bool {
    matches!(
        key,
        "email" | "e-mail" | "username" | "user" | "ip" | "phone" | "tel"
    )
}

fn scrub_email_text(input: &str) -> String {
    EMAIL.replace_all(input, REDACTED).into_owned()
}

fn redact_emails(value: &mut Value) {
    match value {
        Value::String(text) => {
            if text.contains('@') {
                *text = scrub_email_text(text);
            }
        }
        Value::Array(items) => {
            for item in items {
                redact_emails(item);
            }
        }
        Value::Object(map) => {
            for item in map.values_mut() {
                redact_emails(item);
            }
        }
        _ => {}
    }
}

fn scrub_breadcrumbs(breadcrumbs: &mut Value) {
    let values = if breadcrumbs.get("values").is_some() {
        breadcrumbs.get_mut("values").and_then(Value::as_array_mut)
    } else if breadcrumbs.is_array() {
        breadcrumbs.as_array_mut()
    } else {
        None
    };

    if let Some(values) = values {
        for crumb in values.iter_mut() {
            if let Some(message) = crumb.get_mut("message") {
                scrub_value(message);
            }
            if let Some(data) = crumb.get_mut("data") {
                scrub_value(data);
            }
        }
    }
}

fn scrub_value(value: &mut Value) {
    match value {
        Value::String(text) => *text = scrub_string(text),
        Value::Array(items) => {
            for item in items.iter_mut() {
                scrub_value(item);
            }
        }
        Value::Object(map) => {
            for (key, item) in map.iter_mut() {
                if is_sensitive_key(key) {
                    *item = Value::String(REDACTED.to_string());
                } else {
                    scrub_value(item);
                }
            }
        }
        _ => {}
    }
}

pub fn scrub_string(input: &str) -> String {
    let mut output = input.to_string();
    output = BEARER_TOKEN
        .replace_all(&output, "Bearer [REDACTED]")
        .into_owned();
    output = API_KEY
        .replace_all(&output, |caps: &regex::Captures| {
            let matched = caps.get(0).map(|m| m.as_str()).unwrap_or("");
            if let Some((prefix, _)) = matched.split_once('=') {
                format!("{prefix}=[REDACTED]")
            } else if let Some((prefix, _)) = matched.split_once(':') {
                format!("{prefix}:[REDACTED]")
            } else {
                REDACTED.to_string()
            }
        })
        .into_owned();
    output = PASSWORD
        .replace_all(&output, |caps: &regex::Captures| {
            let matched = caps.get(0).map(|m| m.as_str()).unwrap_or("");
            if let Some((prefix, _)) = matched.split_once('=') {
                format!("{prefix}=[REDACTED]")
            } else if let Some((prefix, _)) = matched.split_once(':') {
                format!("{prefix}:[REDACTED]")
            } else {
                REDACTED.to_string()
            }
        })
        .into_owned();
    output = AWS_KEY.replace_all(&output, REDACTED).into_owned();
    output = STRIPE_KEY.replace_all(&output, REDACTED).into_owned();
    output = CREDIT_CARD.replace_all(&output, REDACTED).into_owned();
    output
}

fn is_sensitive_header(key: &str) -> bool {
    matches!(
        key.to_ascii_lowercase().as_str(),
        "authorization"
            | "cookie"
            | "set-cookie"
            | "x-api-key"
            | "x-auth-token"
            | "x-csrf-token"
            | "x-xsrf-token"
            | "proxy-authorization"
            | "x-forwarded-for"
            | "x-real-ip"
            | "forwarded"
            | "cf-connecting-ip"
            | "true-client-ip"
    )
}

fn is_sensitive_key(key: &str) -> bool {
    let lower = key.to_ascii_lowercase();
    lower.contains("password")
        || lower.contains("secret")
        || lower.contains("token")
        || lower.contains("api_key")
        || lower.contains("apikey")
        || lower.contains("authorization")
        || lower == "ip_address"
        || lower == "remote_addr"
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn scrubs_bearer_tokens_in_breadcrumbs() {
        let mut event = json!({
            "breadcrumbs": {
                "values": [
                    { "message": "Authorization: Bearer sk_live_abcdef1234567890" }
                ]
            }
        });
        scrub_event(&mut event);
        let message = event["breadcrumbs"]["values"][0]["message"]
            .as_str()
            .expect("message");
        assert!(message.contains("[REDACTED]"));
        assert!(!message.contains("sk_live"));
    }

    #[test]
    fn scrubs_api_keys_in_extra() {
        let mut event = json!({
            "extra": {
                "api_key": "supersecretvalue123"
            }
        });
        scrub_event(&mut event);
        assert_eq!(event["extra"]["api_key"], REDACTED);
    }

    #[test]
    fn scrubs_credit_cards() {
        let input = "card 4111 1111 1111 1111";
        let output = scrub_string(input);
        assert!(!output.contains("4111"));
        assert!(output.contains(REDACTED));
    }

    #[test]
    fn default_policy_drops_email_ip_and_pseudonymizes_email_ids() {
        let mut event = json!({
            "user": {
                "id": "ada@example.com",
                "email": "ada@example.com",
                "username": "ada",
                "ip_address": "203.0.113.10",
                "geo": { "country_code": "FR", "city": "Lyon" }
            },
            "message": "failed for ada@example.com",
            "request": {
                "url": "https://app.example/reset?token=abc123&email=ada@example.com",
                "cookies": { "sid": "session-value" },
                "headers": { "X-Forwarded-For": "203.0.113.10" }
            }
        });
        apply_privacy_policy(&mut event, PrivacyPolicy::default());
        assert!(event["user"].get("email").is_none());
        assert!(event["user"].get("username").is_none());
        assert!(event["user"].get("ip_address").is_none());
        assert!(event["user"]["geo"].get("city").is_none());
        assert_eq!(event["user"]["geo"]["country_code"], "FR");
        let id = event["user"]["id"].as_str().expect("id");
        assert_eq!(id, pseudonym_for("ada@example.com"));
        assert!(!id.contains('@'));
        assert!(!event["message"].as_str().unwrap().contains("ada@"));
        assert!(event["request"]["url"]
            .as_str()
            .unwrap()
            .contains("token=[REDACTED]"));
        assert!(!event["request"]["url"].as_str().unwrap().contains("ada@"));
        assert_eq!(event["request"]["cookies"], "[REDACTED]");
        assert_eq!(event["request"]["headers"]["X-Forwarded-For"], "[REDACTED]");
    }

    #[test]
    fn opted_in_policy_keeps_email_but_still_drops_ip_and_secrets() {
        let mut event = json!({
            "user": {
                "id": "user_123",
                "email": "ada@example.com",
                "ip_address": "203.0.113.10"
            },
            "message": "failed for ada@example.com",
            "request": {
                "url": "https://app.example/reset?token=abc123"
            }
        });
        apply_privacy_policy(
            &mut event,
            PrivacyPolicy {
                store_end_user_identifiers: true,
            },
        );
        assert_eq!(event["user"]["email"], "ada@example.com");
        assert_eq!(event["user"]["id"], "user_123");
        assert!(event["user"].get("ip_address").is_none());
        assert!(event["message"]
            .as_str()
            .unwrap()
            .contains("ada@example.com"));
        assert!(event["request"]["url"]
            .as_str()
            .unwrap()
            .contains("token=[REDACTED]"));
    }

    #[test]
    fn opaque_user_id_is_kept() {
        let mut event = json!({ "user": { "id": "usr_8f3a2b1c" } });
        apply_privacy_policy(&mut event, PrivacyPolicy::default());
        assert_eq!(event["user"]["id"], "usr_8f3a2b1c");
    }
}
