use serde_json::Value;
use sha2::{Digest, Sha256};

/// SHA-256 fingerprint for spike valve preview (raw event, no demangle).
pub fn preview_fingerprint(payload: &[u8]) -> String {
    if let Ok(value) = serde_json::from_slice::<Value>(payload) {
        return compute_fingerprint(&value);
    }

    let mut hasher = Sha256::new();
    hasher.update(payload);
    hex::encode(hasher.finalize())
}

/// Deterministic SHA-256 fingerprint honoring custom overrides.
pub fn compute_fingerprint(event: &Value) -> String {
    if let Some(custom) = event.get("fingerprint").and_then(Value::as_array) {
        if !custom.is_empty() {
            let joined = custom
                .iter()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>()
                .join(":");
            if !joined.is_empty() {
                return hash_string(&joined);
            }
        }
    }

    let exception_type = normalized_exception_type(event);
    let frame_key = top_in_app_frame_key(event);
    hash_string(&format!("{exception_type}\0{frame_key}"))
}

fn normalized_exception_type(event: &Value) -> String {
    if let Some(values) = event.pointer("/exception/values").and_then(Value::as_array) {
        if let Some(first) = values.first() {
            let ty = first
                .get("type")
                .and_then(Value::as_str)
                .map(normalize_token)
                .unwrap_or_else(|| "unknown".to_string());
            return ty;
        }
    }

    event
        .get("message")
        .and_then(Value::as_str)
        .map(normalize_token)
        .unwrap_or_else(|| "unknown".to_string())
}

fn top_in_app_frame_key(event: &Value) -> String {
    let frames = exception_frames(event);
    if frames.is_empty() {
        return "no-frame".to_string();
    }

    let platform = event.get("platform").and_then(Value::as_str);

    // Prefer innermost in-app frame (closer to the fault location)
    let frame = frames
        .iter()
        .rev()
        .find(|frame| is_frame_in_app(frame, platform))
        .or_else(|| frames.last())
        .expect("frames not empty");

    let file = frame
        .get("filename")
        .or_else(|| frame.get("abs_path"))
        .or_else(|| frame.get("module"))
        .or_else(|| frame.get("package"))
        .and_then(Value::as_str)
        .map(normalize_path)
        .unwrap_or_else(|| "unknown".to_string());
    let function = frame
        .get("function")
        .or_else(|| frame.get("symbol"))
        .and_then(Value::as_str)
        .map(normalize_token)
        .unwrap_or_else(|| "unknown".to_string());
    let line = frame
        .get("lineno")
        .and_then(Value::as_u64)
        .map(|line| line.to_string())
        .unwrap_or_else(|| "0".to_string());

    format!("{file}:{function}:{line}")
}

fn is_frame_in_app(frame: &Value, platform: Option<&str>) -> bool {
    if let Some(in_app) = frame.get("in_app").and_then(Value::as_bool) {
        return in_app;
    }
    let filename = frame
        .get("filename")
        .or_else(|| frame.get("abs_path"))
        .and_then(Value::as_str);
    let module = frame.get("module").and_then(Value::as_str);
    let package = frame.get("package").and_then(Value::as_str);
    let function = frame
        .get("function")
        .or_else(|| frame.get("symbol"))
        .and_then(Value::as_str);

    !crate::frames::is_framework_frame(filename, module, package, function, platform)
}

fn exception_frames(event: &Value) -> Vec<Value> {
    if let Some(values) = event.pointer("/exception/values").and_then(Value::as_array) {
        if let Some(first) = values.first() {
            if let Some(frames) = first
                .pointer("/stacktrace/frames")
                .and_then(Value::as_array)
            {
                return frames.clone();
            }
        }
    }

    if let Some(frames) = event
        .pointer("/stacktrace/frames")
        .and_then(Value::as_array)
    {
        return frames.clone();
    }

    Vec::new()
}

fn normalize_path(path: &str) -> String {
    crate::frames::clean_frame_filename(path)
}

fn normalize_token(token: &str) -> String {
    let cleaned = crate::frames::demangle_rust_symbol(token);
    cleaned.trim().to_lowercase()
}

fn hash_string(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn honors_custom_fingerprint_override() {
        let event = json!({
            "fingerprint": ["custom-group", "part-two"],
            "exception": { "values": [{ "type": "Error", "value": "boom" }] }
        });
        let fp = compute_fingerprint(&event);
        assert_eq!(fp, hash_string("custom-group:part-two"));
    }

    #[test]
    fn same_exception_and_frame_produces_same_fingerprint() {
        let event_a = json!({
            "exception": {
                "values": [{
                    "type": "TypeError",
                    "stacktrace": {
                        "frames": [
                            { "filename": "app.min.js", "function": "n", "lineno": 1, "in_app": true }
                        ]
                    }
                }]
            }
        });
        let event_b = event_a.clone();
        assert_eq!(compute_fingerprint(&event_a), compute_fingerprint(&event_b));
    }

    #[test]
    fn different_frames_produce_different_fingerprints() {
        let event_a = json!({
            "exception": {
                "values": [{
                    "type": "TypeError",
                    "stacktrace": {
                        "frames": [
                            { "filename": "app.min.js", "function": "a", "lineno": 1, "in_app": true }
                        ]
                    }
                }]
            }
        });
        let event_b = json!({
            "exception": {
                "values": [{
                    "type": "TypeError",
                    "stacktrace": {
                        "frames": [
                            { "filename": "app.min.js", "function": "b", "lineno": 2, "in_app": true }
                        ]
                    }
                }]
            }
        });
        assert_ne!(compute_fingerprint(&event_a), compute_fingerprint(&event_b));
    }

    #[test]
    fn prefers_in_app_frame() {
        let event = json!({
            "exception": {
                "values": [{
                    "type": "Error",
                    "stacktrace": {
                        "frames": [
                            { "filename": "vendor.js", "function": "vendor", "lineno": 10, "in_app": false },
                            { "filename": "app.js", "function": "main", "lineno": 4, "in_app": true }
                        ]
                    }
                }]
            }
        });
        let fp = compute_fingerprint(&event);
        let expected = hash_string(&format!("error\0{}", "app.js:main:4"));
        assert_eq!(fp, expected);
    }

    #[test]
    fn nextjs_ssr_and_client_paths_produce_same_fingerprint() {
        let event_client = json!({
            "exception": {
                "values": [{
                    "type": "Error",
                    "stacktrace": {
                        "frames": [
                            { "filename": "webpack:///./src/app/page.tsx", "function": "HomePage", "lineno": 15, "in_app": true }
                        ]
                    }
                }]
            }
        });
        let event_ssr = json!({
            "exception": {
                "values": [{
                    "type": "Error",
                    "stacktrace": {
                        "frames": [
                            { "filename": "webpack-internal:///(rsc)/./src/app/page.tsx", "function": "HomePage", "lineno": 15, "in_app": true }
                        ]
                    }
                }]
            }
        });
        assert_eq!(
            compute_fingerprint(&event_client),
            compute_fingerprint(&event_ssr)
        );
    }

    #[test]
    fn rust_hash_recompilation_produces_same_fingerprint() {
        let event_build_1 = json!({
            "platform": "native",
            "exception": {
                "values": [{
                    "type": "Panic",
                    "stacktrace": {
                        "frames": [
                            { "filename": "crates/server/src/worker.rs", "function": "epure_server::worker::run::h1111222233334444", "lineno": 40, "in_app": true }
                        ]
                    }
                }]
            }
        });
        let event_build_2 = json!({
            "platform": "native",
            "exception": {
                "values": [{
                    "type": "Panic",
                    "stacktrace": {
                        "frames": [
                            { "filename": "crates/server/src/worker.rs", "function": "epure_server::worker::run::h5555666677778888", "lineno": 40, "in_app": true }
                        ]
                    }
                }]
            }
        });
        assert_eq!(
            compute_fingerprint(&event_build_1),
            compute_fingerprint(&event_build_2)
        );
    }

    #[test]
    fn dotnet_fallback_to_module_without_pdb_filename() {
        let event = json!({
            "platform": "csharp",
            "exception": {
                "values": [{
                    "type": "System.NullReferenceException",
                    "stacktrace": {
                        "frames": [
                            { "module": "Microsoft.AspNetCore.Mvc.Core", "function": "Execute", "lineno": 0 },
                            { "module": "Acme.Shop.Api", "function": "OrderController.Checkout", "lineno": 0 }
                        ]
                    }
                }]
            }
        });
        let fp = compute_fingerprint(&event);
        assert!(!fp.is_empty());
        // Should use Acme.Shop.Api as module since Microsoft frame is framework
        let expected = hash_string(&format!(
            "{}\0{}",
            "system.nullreferenceexception", "Acme.Shop.Api:ordercontroller.checkout:0"
        ));
        assert_eq!(fp, expected);
    }
}
