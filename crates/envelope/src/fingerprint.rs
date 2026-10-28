use serde_json::Value;

use crate::grouping::{self, MultiFingerprint};

/// SHA-256 fingerprint for spike valve preview (raw event, no demangle).
pub fn preview_fingerprint(payload: &[u8]) -> String {
    grouping::preview_multi_fingerprint(payload).fingerprint
}

/// Issue key. SDK `fingerprint` overrides win. Otherwise this is the causal
/// locus: exception type plus the normalized innermost throw site.
pub fn compute_fingerprint(event: &Value) -> String {
    grouping::compute_multi_fingerprint(event).fingerprint
}

pub fn compute_multi_fingerprint(event: &Value) -> MultiFingerprint {
    grouping::compute_multi_fingerprint(event)
}

pub fn preview_multi_fingerprint(payload: &[u8]) -> MultiFingerprint {
    grouping::preview_multi_fingerprint(payload)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::grouping::hash_string;
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
        // Line 4 sits in bucket 0 (8-line windows). Column is absent, so bucket 0.
        let expected = hash_string("error\0app.js:main:0:0");
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
        let expected = hash_string(
            "system.nullreferenceexception\0Acme.Shop.Api:ordercontroller.checkout:0:0",
        );
        assert_eq!(fp, expected);
    }
}
