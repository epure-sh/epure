use regex::Regex;
use serde_json::Value;
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
static CREDIT_CARD: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\b(?:\d[ -]*?){13,16}\b").expect("credit card regex")
});
static AWS_KEY: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\bAKIA[0-9A-Z]{16}\b").expect("aws key regex"));
static STRIPE_KEY: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b").expect("stripe key regex")
});

const REDACTED: &str = "[REDACTED]";

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

    if let Some(cookies) = request.get_mut("cookies") {
        scrub_value(cookies);
    }
}

fn scrub_breadcrumbs(breadcrumbs: &mut Value) {
    let values = if breadcrumbs.get("values").is_some() {
        breadcrumbs
            .get_mut("values")
            .and_then(Value::as_array_mut)
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
        "authorization" | "cookie" | "set-cookie" | "x-api-key" | "x-auth-token"
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
}
