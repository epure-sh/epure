use epure_envelope::{compute_canonical_grouping, SimHashLshRouter};
use serde_json::{json, Value};
use uuid::Uuid;
fn event(message: &str, function: &str, line: u32) -> Value {
    json!({"platform":"javascript","exception":{"values":[{"type":"Error","value":message,"stacktrace":{"frames":[{"filename":"src/service.ts","function":function,"lineno":line,"in_app":true}]}}]}})
}
#[test]
fn independent_throws_in_same_function_stay_separate() {
    let p = Uuid::new_v4();
    let a = event("Permission denied", "processOrder", 16);
    let b = event("Payment declined", "processOrder", 160);
    assert_ne!(
        compute_canonical_grouping(&a, p, None, None, None)
            .0
            .fingerprint,
        compute_canonical_grouping(&b, p, None, None, None)
            .0
            .fingerprint
    );
}
#[test]
fn semantic_error_codes_stay_separate_at_same_site() {
    let p = Uuid::new_v4();
    let a = event("HTTP 401", "send", 16);
    let b = event("HTTP 503", "send", 16);
    assert_ne!(
        compute_canonical_grouping(&a, p, None, None, None)
            .0
            .fingerprint,
        compute_canonical_grouping(&b, p, None, None, None)
            .0
            .fingerprint
    );
}
#[test]
fn dynamic_values_group_without_lsh() {
    let p = Uuid::new_v4();
    let a = event("User 1234 missing", "lookup", 16);
    let b = event("User 9876 missing", "lookup", 16);
    assert_eq!(
        compute_canonical_grouping(&a, p, None, None, None)
            .0
            .fingerprint,
        compute_canonical_grouping(&b, p, None, None, None)
            .0
            .fingerprint
    );
}
#[test]
fn unrelated_function_is_not_near_duplicate() {
    let p = Uuid::new_v4();
    let router = SimHashLshRouter::new();
    let a = event("Failure", "authorize", 16);
    let b = event("Failure", "chargeCard", 160);
    assert_ne!(
        compute_canonical_grouping(&a, p, None, None, Some(&router))
            .0
            .fingerprint,
        compute_canonical_grouping(&b, p, None, None, Some(&router))
            .0
            .fingerprint
    );
}

#[test]
fn separate_throw_sites_stay_separate_with_lsh_enabled() {
    let p = Uuid::new_v4();
    let router = SimHashLshRouter::new();
    let a = event("Failure", "processOrder", 16);
    let b = event("Failure", "processOrder", 160);
    assert_ne!(
        compute_canonical_grouping(&a, p, None, None, Some(&router))
            .0
            .fingerprint,
        compute_canonical_grouping(&b, p, None, None, Some(&router))
            .0
            .fingerprint
    );
}
