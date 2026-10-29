//! Canonical event kept after ingest.
//!
//! The SDK envelope is larger than Epure needs. `project_event` keeps the
//! fields the product actually triages and drops the rest (modules, debug
//! images, full header sets, and breadcrumbs beyond the last 40).

use serde_json::{json, Map, Value};

const MAX_BREADCRUMBS: usize = 40;
const MAX_BODY_BYTES: usize = 8 * 1024;
const SAFE_HEADERS: &[&str] = &[
    "user-agent",
    "referer",
    "origin",
    "content-type",
    "x-request-id",
];

/// Replace a scrubbed SDK event with the stored document.
pub fn project_event(event: &Value, occurred_at: &str) -> Value {
    let mut out = Map::new();
    if let Some(id) = text(event, "event_id") {
        out.insert("event_id".into(), Value::String(id));
    }
    out.insert("occurred_at".into(), Value::String(occurred_at.to_string()));
    insert_text(
        &mut out,
        "level",
        normalize_level(text(event, "level").as_deref()),
    );
    insert_opt(&mut out, "platform", text(event, "platform"));
    insert_opt(&mut out, "environment", text(event, "environment"));
    insert_opt(&mut out, "release", text(event, "release"));
    insert_opt(
        &mut out,
        "transaction_name",
        text(event, "transaction").or_else(|| text(event, "transaction_info")),
    );
    insert_opt(&mut out, "server_name", text(event, "server_name"));
    if let Some(sdk) = sdk(event) {
        out.insert("sdk".into(), sdk);
    }
    if let Some(fingerprint) = custom_fingerprint(event) {
        out.insert("fingerprint".into(), fingerprint);
    }
    out.insert("exceptions".into(), exceptions(event));
    if let Some(user) = user(event) {
        out.insert("user".into(), user);
    }
    if let Some(request) = request(event) {
        out.insert("request".into(), request);
    }
    out.insert("contexts".into(), contexts(event));
    out.insert("breadcrumbs".into(), breadcrumbs(event));
    out.insert(
        "tags".into(),
        event.get("tags").cloned().unwrap_or_else(|| json!({})),
    );
    out.insert(
        "extra".into(),
        event.get("extra").cloned().unwrap_or_else(|| json!({})),
    );
    Value::Object(out)
}

pub fn event_occurred_at(event: &Value) -> Option<String> {
    match event.get("timestamp")? {
        Value::String(text) => {
            let trimmed = text.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        Value::Number(number) => number.as_f64().map(|seconds| chrono_lite_rfc3339(seconds)),
        _ => None,
    }
}

fn chrono_lite_rfc3339(seconds: f64) -> String {
    let whole = seconds.trunc() as i64;
    let nanos = ((seconds - seconds.trunc()) * 1_000_000_000.0).max(0.0) as u32;
    chrono::DateTime::from_timestamp(whole, nanos)
        .map(|time| time.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
        .unwrap_or_else(|| seconds.to_string())
}

pub fn culprit_from_event(event: &Value) -> Option<String> {
    let frames = event
        .pointer("/exceptions/0/frames")
        .or_else(|| event.pointer("/exception/values/0/stacktrace/frames"))
        .and_then(Value::as_array)?;
    let frame = frames
        .iter()
        .rev()
        .find(|frame| {
            frame
                .get("in_app")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        })
        .or_else(|| frames.last())?;
    let file = frame
        .get("filename")
        .or_else(|| frame.get("abs_path"))
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let function = frame
        .get("function")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let line = frame.get("lineno").and_then(Value::as_u64).unwrap_or(0);
    Some(format!("{file} in {function}:{line}"))
}

pub fn is_unhandled(event: &Value) -> bool {
    event
        .pointer("/exception/values/0/mechanism/handled")
        .and_then(Value::as_bool)
        .map(|handled| !handled)
        .unwrap_or(false)
}

fn exceptions(event: &Value) -> Value {
    let Some(values) = event.pointer("/exception/values").and_then(Value::as_array) else {
        return json!([]);
    };
    Value::Array(
        values
            .iter()
            .map(|exception| {
                json!({
                    "type": exception.get("type").and_then(Value::as_str).unwrap_or("Error"),
                    "value": exception.get("value").and_then(Value::as_str).unwrap_or(""),
                    "mechanism": {
                        "type": exception.pointer("/mechanism/type").and_then(Value::as_str).unwrap_or("generic"),
                        "handled": exception.pointer("/mechanism/handled").and_then(Value::as_bool).unwrap_or(true),
                    },
                    "frames": frames(exception.pointer("/stacktrace/frames")),
                })
            })
            .collect(),
    )
}

fn frames(raw: Option<&Value>) -> Value {
    let Some(frames) = raw.and_then(Value::as_array) else {
        return json!([]);
    };
    Value::Array(
        frames
            .iter()
            .map(|frame| {
                let mut kept = Map::new();
                for key in [
                    "filename",
                    "abs_path",
                    "function",
                    "lineno",
                    "colno",
                    "in_app",
                    "context_line",
                ] {
                    if let Some(value) = frame.get(key) {
                        if !value.is_null() {
                            kept.insert(key.to_string(), value.clone());
                        }
                    }
                }
                for key in ["pre_context", "post_context", "vars"] {
                    if let Some(value) = frame.get(key) {
                        kept.insert(key.to_string(), value.clone());
                    }
                }
                Value::Object(kept)
            })
            .collect(),
    )
}

fn user(event: &Value) -> Option<Value> {
    let user = event.get("user")?;
    let id = user.get("id").and_then(Value::as_str);
    let email = user.get("email").and_then(Value::as_str);
    let username = user.get("username").and_then(Value::as_str);
    let user_key = id.or(email).or(username);
    if id.is_none() && email.is_none() && username.is_none() {
        return None;
    }
    Some(json!({
        "id": id,
        "email": email,
        "username": username,
        "user_key": user_key,
    }))
}

fn request(event: &Value) -> Option<Value> {
    let request = event.get("request")?;
    let headers = whitelist_headers(request.get("headers"));
    let data = request.get("data").map(cap_json);
    Some(json!({
        "method": request.get("method").and_then(Value::as_str),
        "url": request.get("url").and_then(Value::as_str),
        "query_string": request.get("query_string").and_then(Value::as_str),
        "headers": headers,
        "data": data,
    }))
}

fn whitelist_headers(headers: Option<&Value>) -> Value {
    let Some(headers) = headers.and_then(Value::as_object) else {
        return json!({});
    };
    let mut kept = Map::new();
    for (key, value) in headers {
        if SAFE_HEADERS
            .iter()
            .any(|allowed| key.eq_ignore_ascii_case(allowed))
        {
            kept.insert(key.clone(), value.clone());
        }
    }
    Value::Object(kept)
}

fn cap_json(value: &Value) -> Value {
    let text = value.to_string();
    if text.len() <= MAX_BODY_BYTES {
        return value.clone();
    }
    Value::String(format!("{}…", &text[..MAX_BODY_BYTES]))
}

fn contexts(event: &Value) -> Value {
    json!({
        "browser": slim_context(event, "browser", &["name", "version"]),
        "os": slim_context(event, "os", &["name", "version"]),
        "device": slim_context(event, "device", &["family", "model", "arch"]),
        "runtime": slim_context(event, "runtime", &["name", "version"]),
        "trace": slim_context(event, "trace", &["trace_id", "span_id"]),
    })
}

fn slim_context(event: &Value, name: &str, keys: &[&str]) -> Value {
    let Some(context) = event
        .pointer(&format!("/contexts/{name}"))
        .and_then(Value::as_object)
    else {
        return Value::Null;
    };
    let mut kept = Map::new();
    for key in keys {
        if let Some(value) = context.get(*key) {
            if !value.is_null() {
                kept.insert((*key).to_string(), value.clone());
            }
        }
    }
    if kept.is_empty() {
        Value::Null
    } else {
        Value::Object(kept)
    }
}

fn breadcrumbs(event: &Value) -> Value {
    let values = event
        .pointer("/breadcrumbs/values")
        .and_then(Value::as_array)
        .or_else(|| event.get("breadcrumbs").and_then(Value::as_array));
    let Some(values) = values else {
        return json!([]);
    };
    let start = values.len().saturating_sub(MAX_BREADCRUMBS);
    Value::Array(
        values
            .iter()
            .skip(start)
            .map(|crumb| {
                json!({
                    "timestamp": crumb.get("timestamp"),
                    "type": crumb.get("type").and_then(Value::as_str),
                    "category": crumb.get("category").and_then(Value::as_str),
                    "level": crumb.get("level").and_then(Value::as_str),
                    "message": crumb.get("message").and_then(Value::as_str),
                    "data": crumb.get("data"),
                })
            })
            .collect(),
    )
}

fn sdk(event: &Value) -> Option<Value> {
    let sdk = event.get("sdk")?;
    let name = sdk.get("name").and_then(Value::as_str)?;
    Some(json!({
        "name": name,
        "version": sdk.get("version").and_then(Value::as_str),
    }))
}

fn custom_fingerprint(event: &Value) -> Option<Value> {
    let values = event.get("fingerprint")?.as_array()?;
    if values.is_empty() {
        None
    } else {
        Some(Value::Array(values.clone()))
    }
}

fn normalize_level(level: Option<&str>) -> Option<String> {
    let level = level?.trim().to_ascii_lowercase();
    match level.as_str() {
        "fatal" | "error" | "warning" | "info" | "debug" => Some(level),
        _ => None,
    }
}

fn text(event: &Value, key: &str) -> Option<String> {
    event
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn insert_text(out: &mut Map<String, Value>, key: &str, value: Option<String>) {
    if let Some(value) = value {
        out.insert(key.to_string(), Value::String(value));
    }
}

fn insert_opt(out: &mut Map<String, Value>, key: &str, value: Option<String>) {
    insert_text(out, key, value);
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn keeps_the_triage_fields_and_drops_the_rest() {
        let event = json!({
            "event_id": "550e8400-e29b-41d4-a716-446655440000",
            "timestamp": "2026-10-28T12:00:00Z",
            "level": "ERROR",
            "platform": "node",
            "environment": "production",
            "release": "api@1.4.0",
            "transaction": "POST /api/checkout",
            "server_name": "web-1",
            "sdk": { "name": "sentry.javascript.node", "version": "8.0.0", "integrations": ["Http"] },
            "modules": { "express": "4.0.0" },
            "fingerprint": ["checkout", "charge"],
            "exception": {
                "values": [{
                    "type": "TypeError",
                    "value": "charge failed",
                    "mechanism": { "type": "generic", "handled": false },
                    "stacktrace": {
                        "frames": [{
                            "filename": "src/billing.ts",
                            "function": "chargeCard",
                            "lineno": 42,
                            "colno": 8,
                            "in_app": true,
                            "context_line": "charge()",
                            "debug_id": "drop-me"
                        }]
                    }
                }]
            },
            "user": { "id": "u1", "email": "a@b.co", "ip_address": "203.0.113.8" },
            "request": {
                "method": "POST",
                "url": "https://app.example/api/checkout",
                "headers": { "User-Agent": "test", "Authorization": "secret", "X-Request-Id": "req-1" },
                "data": { "card": "4242" }
            },
            "contexts": {
                "runtime": { "name": "node", "version": "22.9.0", "build": "unused" },
                "trace": { "trace_id": "abc", "span_id": "def", "op": "http" }
            },
            "tags": { "plan": "pro" },
            "extra": { "cart": 2 }
        });
        let projected = project_event(&event, "2026-10-28T12:00:00Z");
        assert!(projected.get("modules").is_none());
        assert_eq!(projected["level"], "error");
        assert_eq!(projected["transaction_name"], "POST /api/checkout");
        assert_eq!(projected["sdk"]["name"], "sentry.javascript.node");
        assert!(projected["sdk"].get("integrations").is_none());
        assert_eq!(projected["exceptions"][0]["mechanism"]["handled"], false);
        assert!(projected["exceptions"][0]["frames"][0]
            .get("debug_id")
            .is_none());
        assert_eq!(projected["user"]["user_key"], "u1");
        assert!(projected["user"].get("ip_address").is_none());
        assert!(projected["request"]["headers"]
            .get("Authorization")
            .is_none());
        assert_eq!(projected["request"]["headers"]["X-Request-Id"], "req-1");
        assert!(projected["contexts"]["runtime"].get("build").is_none());
        assert_eq!(projected["contexts"]["trace"]["trace_id"], "abc");
        assert_eq!(
            culprit_from_event(&projected).as_deref(),
            Some("src/billing.ts in chargeCard:42")
        );
        assert!(is_unhandled(&event));
    }

    #[test]
    fn breadcrumbs_keep_the_last_forty() {
        let mut values = Vec::new();
        for index in 0..50 {
            values.push(
                json!({"message": format!("c{index}"), "category": "console", "level": "info"}),
            );
        }
        let event = json!({"breadcrumbs": {"values": values}});
        let projected = project_event(&event, "2026-10-28T12:00:00Z");
        let crumbs = projected["breadcrumbs"].as_array().unwrap();
        assert_eq!(crumbs.len(), 40);
        assert_eq!(crumbs[0]["message"], "c10");
        assert_eq!(crumbs[39]["message"], "c49");
    }
}
