//! Multi-resolution fingerprints for grouping and spike coalescing.
//!
//! One cryptographic hash cannot both identify an exact event and recognize
//! the same crash reached through a different caller, a deeper retry, or a
//! message that embeds a fresh id. Epure keeps three 64-bit signatures:
//!
//! - `h_exact` — folded stack plus templated message (tier-1 duplicate valve)
//! - `h_locus` — exception type plus the innermost in-app throw site
//!   (issue identity and the causal spike valve)
//! - `h_sim` — position-weighted simhash (near-duplicate lookup)
//!
//! The stored issue key is a SHA-256 of the locus, not of the full stack.
//! Call-path, recursion depth, chunk hashes, closure counters, and dynamic
//! tokens therefore land on one issue. Simhash only attaches an event to an
//! existing issue when the throw site is the same function and the line
//! bucket is the same or an adjacent 8-line window.

use crate::frames::{clean_frame_filename, demangle_rust_symbol, is_framework_frame};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use smallvec::SmallVec;
use uuid::Uuid;

const PRIME64_1: u64 = 0x9E37_79B1_85EB_CA87;
const PRIME64_2: u64 = 0xC2B2_AE3D_27D4_EB4F;
const PRIME64_3: u64 = 0x1656_67B1_9E37_79F9;
const PRIME64_4: u64 = 0x85EB_CA77_C2B2_AE63;
const PRIME64_5: u64 = 0x27D4_EB2F_1656_67C5;

const TEMPLATE_LIMIT: usize = 512;
const MAX_CYCLE: usize = 8;
const SIMHASH_HAMMING: u32 = 3;
const BANDS: usize = 4;
const BAND_BITS: u32 = 16;
const MAX_CANDIDATES_PER_BAND: usize = 32;
const MAX_INDEX_ISSUES: usize = 5_000;

/// Stable XXH64. Fingerprints are persisted, so this must not follow `std::hash`.
pub fn xxh64(input: &[u8], seed: u64) -> u64 {
    let mut offset = 0usize;
    let mut h64 = if input.len() >= 32 {
        let mut v1 = seed.wrapping_add(PRIME64_1).wrapping_add(PRIME64_2);
        let mut v2 = seed.wrapping_add(PRIME64_2);
        let mut v3 = seed;
        let mut v4 = seed.wrapping_sub(PRIME64_1);
        while offset + 32 <= input.len() {
            v1 = xxh64_round(v1, read_u64(input, offset));
            v2 = xxh64_round(v2, read_u64(input, offset + 8));
            v3 = xxh64_round(v3, read_u64(input, offset + 16));
            v4 = xxh64_round(v4, read_u64(input, offset + 24));
            offset += 32;
        }
        let mut mixed = v1
            .rotate_left(1)
            .wrapping_add(v2.rotate_left(7))
            .wrapping_add(v3.rotate_left(12))
            .wrapping_add(v4.rotate_left(18));
        mixed = xxh64_merge_round(mixed, v1);
        mixed = xxh64_merge_round(mixed, v2);
        mixed = xxh64_merge_round(mixed, v3);
        xxh64_merge_round(mixed, v4)
    } else {
        seed.wrapping_add(PRIME64_5)
    };

    h64 = h64.wrapping_add(input.len() as u64);

    while offset + 8 <= input.len() {
        let k1 = xxh64_round(0, read_u64(input, offset));
        h64 ^= k1;
        h64 = h64
            .rotate_left(27)
            .wrapping_mul(PRIME64_1)
            .wrapping_add(PRIME64_4);
        offset += 8;
    }
    if offset + 4 <= input.len() {
        h64 ^= (read_u32(input, offset) as u64).wrapping_mul(PRIME64_1);
        h64 = h64
            .rotate_left(23)
            .wrapping_mul(PRIME64_2)
            .wrapping_add(PRIME64_3);
        offset += 4;
    }
    while offset < input.len() {
        h64 ^= (input[offset] as u64).wrapping_mul(PRIME64_5);
        h64 = h64.rotate_left(11).wrapping_mul(PRIME64_1);
        offset += 1;
    }
    xxh64_avalanche(h64)
}

fn xxh64_round(mut acc: u64, input: u64) -> u64 {
    acc = acc.wrapping_add(input.wrapping_mul(PRIME64_2));
    acc = acc.rotate_left(31);
    acc.wrapping_mul(PRIME64_1)
}

fn xxh64_merge_round(mut acc: u64, val: u64) -> u64 {
    let val = xxh64_round(0, val);
    acc ^= val;
    acc.rotate_left(27)
        .wrapping_mul(PRIME64_1)
        .wrapping_add(PRIME64_4)
}

fn xxh64_avalanche(mut hash: u64) -> u64 {
    hash ^= hash >> 33;
    hash = hash.wrapping_mul(PRIME64_2);
    hash ^= hash >> 29;
    hash = hash.wrapping_mul(PRIME64_3);
    hash ^= hash >> 32;
    hash
}

fn read_u64(input: &[u8], offset: usize) -> u64 {
    u64::from_le_bytes(input[offset..offset + 8].try_into().expect("8 bytes"))
}

fn read_u32(input: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes(input[offset..offset + 4].try_into().expect("4 bytes"))
}

pub fn hash_string(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

/// Bit-preserving cast for PostgreSQL `BIGINT`.
pub fn hash_to_i64(hash: u64) -> i64 {
    hash as i64
}

pub fn hash_from_i64(hash: i64) -> u64 {
    hash as u64
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MultiFingerprint {
    /// Issue key. Locus hash for automatic grouping, SDK hash when overridden.
    pub fingerprint: String,
    pub h_exact: u64,
    pub h_locus: u64,
    pub h_sim: u64,
    pub exception_type: String,
    pub templated_value: String,
    pub throw_file: String,
    pub throw_function: String,
    pub line_bucket: u32,
    pub col_bucket: u32,
    /// `exact_stack`, `crash_site`, `cycle_folded`, `message_template`, `custom`, or `raw`.
    pub merge_reason: &'static str,
    pub cycle_folded: bool,
    pub call_path_count: u16,
    pub custom: bool,
    /// Short sample stored on the parent issue when callers or messages vary.
    pub variant_label: String,
}

impl MultiFingerprint {
    pub fn anchor_json(&self) -> serde_json::Value {
        serde_json::json!({
            "file": self.throw_file,
            "function": self.throw_function,
            "line_bucket": self.line_bucket,
            "col_bucket": self.col_bucket,
            "exception_type": self.exception_type,
            "template": self.templated_value,
        })
    }

    pub fn band(&self, index: usize) -> u16 {
        band_of(self.h_sim, index)
    }
}

pub fn band_of(hash: u64, index: usize) -> u16 {
    ((hash >> (index * BAND_BITS as usize)) & 0xFFFF) as u16
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct GroupingMeta {
    pub matched_by: String, // "exact" | "locus" | "wrapper_elided" | "simhash_lsh" | "fallback"
    pub causal_frame_index: Option<usize>,
    pub elided_wrapper_frames: Vec<usize>,
    pub locus_distance: Option<u32>,
    pub decoded_framework_error: Option<String>,
    pub wire_hash: Option<u64>,
    pub h_locus: Option<u64>,
    pub h_sim: Option<u64>,
}

/// Preserves error codes during template sanitization:
/// - `#\d+` (e.g. `Minified React error #418`, `#310`)
/// - `\bE\d{2,6}\b` (e.g. Rust `E0382`, syscall codes)
/// - HTTP 4xx/5xx status codes (`400`-`599`)
/// - 5-character alphanumeric SQLSTATE codes (`23505`, `42P01`, `40001`).
pub fn is_preserved_error_code(token: &str, prev_token: Option<&str>) -> bool {
    // 1. Minified React / framework invariant error codes: #418, #310
    if token.starts_with('#') && token.len() >= 2 && token[1..].chars().all(|c| c.is_ascii_digit())
    {
        return true;
    }

    // 2. Rust/compiler/syscall codes: E0382, E0502, E0499 (starts with E/e followed by 2 to 6 digits)
    if (token.starts_with('E') || token.starts_with('e'))
        && token.len() >= 3
        && token.len() <= 7
        && token[1..].chars().all(|c| c.is_ascii_digit())
    {
        return true;
    }

    // 3. HTTP status codes: 400-599
    if token.len() == 3
        && (token.starts_with('4') || token.starts_with('5'))
        && token.chars().all(|c| c.is_ascii_digit())
    {
        if let Some(prev) = prev_token {
            let p = prev.to_ascii_lowercase();
            if p == "http" || p == "status" || p == "code" || p == "error" || p == "response" {
                return true;
            }
        }
        match token {
            "400" | "401" | "402" | "403" | "404" | "405" | "408" | "409" | "410" | "418"
            | "422" | "429" | "500" | "501" | "502" | "503" | "504" | "505" => return true,
            _ => {}
        }
    }

    // 4. SQLSTATE codes: 5-character alphanumeric codes with standard class
    if token.len() == 5 && token.chars().all(|c| c.is_ascii_alphanumeric()) {
        let is_upper_or_digit = token
            .chars()
            .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit());
        let has_digit = token.chars().any(|c| c.is_ascii_digit());
        let common_classes = ["23", "42", "40", "08", "28", "22", "25", "57", "58"];
        if is_upper_or_digit && has_digit && common_classes.iter().any(|cls| token.starts_with(cls))
        {
            return true;
        }
    }

    false
}

/// Decode top React minified invariant error codes into human-readable descriptions.
pub fn decode_react_invariant(code: &str) -> Option<&'static str> {
    match code.trim_start_matches('#') {
        "130" => Some("Element type is invalid: expected a string or a class/function but got undefined/object."),
        "185" => Some("Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate."),
        "300" => Some("Rendered fewer hooks than expected. This may be caused by an accidental early return statement."),
        "301" => Some("Too many re-renders. React limits the number of renders to prevent an infinite loop."),
        "310" => Some("Rendered more hooks than during the previous render."),
        "321" => Some("Invalid hook call. Hooks can only be called inside of the body of a function component."),
        "418" => Some("Hydration failed because the initial UI does not match what was rendered on the server."),
        "419" => Some("The server could not finish this Suspense boundary, likely due to an error during SSR."),
        "421" => Some("This Suspense boundary received an update before it finished hydrating."),
        "422" => Some("There was an error while hydrating this Suspense boundary."),
        "423" => Some("There was an error while hydrating but React was able to recover by rendering at the client root instead."),
        "425" => Some("Text content does not match server-rendered HTML."),
        "426" => Some("A tree hydrated but some attributes of the server rendered HTML didn't match the client properties."),
        _ => None,
    }
}

pub fn extract_decoded_framework_error(msg: &str) -> Option<String> {
    if let Some(idx) = msg.find("Minified React error #") {
        let rest = &msg[idx + "Minified React error #".len()..];
        let code_digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
        if !code_digits.is_empty() {
            if let Some(decoded) = decode_react_invariant(&code_digits) {
                return Some(format!("React Error #{code_digits}: {decoded}"));
            }
        }
    }
    if let Some(idx) = msg.find("react.dev/errors/") {
        let rest = &msg[idx + "react.dev/errors/".len()..];
        let code_digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
        if !code_digits.is_empty() {
            if let Some(decoded) = decode_react_invariant(&code_digits) {
                return Some(format!("React Error #{code_digits}: {decoded}"));
            }
        }
    }
    None
}

/// Stage 1 Wire Signature (< 2µs edge check before demangling).
pub fn compute_wire_hash(event: &Value) -> u64 {
    let ex_type = exception_type(event);
    let msg = exception_message(event).unwrap_or_default();
    let templated = normalize_exception_value(&truncate_chars(&msg, 128));

    let mut buf = Vec::with_capacity(256);
    buf.extend_from_slice(ex_type.as_bytes());
    buf.push(0);
    buf.extend_from_slice(templated.as_bytes());
    buf.push(0);

    for frame in exception_frames(event).into_iter().rev().take(5) {
        let file = frame
            .get("filename")
            .or_else(|| frame.get("abs_path"))
            .and_then(Value::as_str)
            .unwrap_or("");
        let func = frame
            .get("function")
            .or_else(|| frame.get("symbol"))
            .and_then(Value::as_str)
            .unwrap_or("");
        let line = frame.get("lineno").and_then(Value::as_u64).unwrap_or(0);
        let col = frame.get("colno").and_then(Value::as_u64).unwrap_or(0);

        buf.extend_from_slice(file.as_bytes());
        buf.push(b':');
        buf.extend_from_slice(func.as_bytes());
        buf.push(b':');
        buf.extend_from_slice(&line.to_le_bytes());
        buf.push(b':');
        buf.extend_from_slice(&col.to_le_bytes());
        buf.push(0);
    }

    xxh64(&buf, 42)
}

/// Drain-style single pass. Dynamic tokens become typed placeholders.
pub fn normalize_exception_value(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len().min(TEMPLATE_LIMIT));
    let mut chars = raw.chars().peekable();
    let mut prev_token: Option<String> = None;

    while let Some(ch) = chars.next() {
        if out.len() >= TEMPLATE_LIMIT {
            break;
        }
        if ch == '\'' || ch == '"' {
            let quote = ch;
            for next in chars.by_ref() {
                if next == quote {
                    break;
                }
            }
            out.push_str("<QUOTED>");
            prev_token = None;
            continue;
        }
        // Preserve #\d+ exemption (e.g. Minified React error #418, #310)
        if ch == '#' && chars.peek().is_some_and(|c| c.is_ascii_digit()) {
            let mut code = String::new();
            code.push('#');
            while let Some(next) = chars.peek().copied() {
                if !next.is_ascii_digit() {
                    break;
                }
                code.push(next);
                chars.next();
            }
            out.push_str(&code);
            prev_token = Some(code);
            continue;
        }
        if is_delimiter(ch) {
            out.push(ch);
            continue;
        }
        let mut token = String::new();
        token.push(ch);
        while let Some(next) = chars.peek().copied() {
            if is_delimiter(next) || next == '\'' || next == '"' {
                break;
            }
            token.push(next);
            chars.next();
        }

        if is_preserved_error_code(&token, prev_token.as_deref()) {
            for lower in token.chars() {
                if out.len() >= TEMPLATE_LIMIT {
                    break;
                }
                out.push(lower.to_ascii_lowercase());
            }
            prev_token = Some(token);
        } else if let Some(placeholder) = placeholder_for(&token) {
            out.push_str(placeholder);
            prev_token = None;
        } else {
            for lower in token.chars() {
                if out.len() >= TEMPLATE_LIMIT {
                    break;
                }
                out.push(lower.to_ascii_lowercase());
            }
            prev_token = Some(token);
        }
    }
    out
}

fn is_delimiter(ch: char) -> bool {
    matches!(
        ch,
        ' ' | '\t'
            | '\n'
            | '\r'
            | ':'
            | '='
            | ','
            | '('
            | ')'
            | '['
            | ']'
            | '{'
            | '}'
            | ';'
            | '?'
            | '&'
            | '#'
            | '|'
            | '<'
            | '>'
    )
}

fn placeholder_for(token: &str) -> Option<&'static str> {
    if token.contains('@') {
        return Some("<EMAIL>");
    }
    if token.contains('/') || token.contains('\\') {
        return Some("<PATH>");
    }
    // IP address: 4 octets separated by dots
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() == 4
        && parts
            .iter()
            .all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()))
    {
        return Some("<IP>");
    }
    let hex_digits = token
        .bytes()
        .filter(|byte| byte.is_ascii_hexdigit())
        .count();
    if hex_digits >= 6
        && token
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() || byte == b'-')
    {
        if token.len() == 36 && token.bytes().filter(|b| *b == b'-').count() == 4 {
            return Some("<UUID>");
        }
        return Some("<HEX>");
    }
    if !token.bytes().any(|byte| byte.is_ascii_digit()) {
        return None;
    }
    let stripped = strip_unit_suffix(token);
    let numeric = stripped
        .bytes()
        .all(|byte| byte.is_ascii_digit() || matches!(byte, b'.' | b',' | b'+' | b'-'))
        && stripped.bytes().any(|byte| byte.is_ascii_digit());
    if numeric {
        Some("<NUM>")
    } else {
        Some("<ID>")
    }
}

fn strip_unit_suffix(token: &str) -> &str {
    const UNITS: &[&str] = &["ms", "ns", "us", "kb", "mb", "gb", "s", "%"];
    let lower = token.to_ascii_lowercase();
    for unit in UNITS {
        if let Some(prefix) = lower.strip_suffix(unit) {
            if prefix.bytes().any(|byte| byte.is_ascii_digit()) {
                let cut = token.len().saturating_sub(unit.len());
                return &token[..cut];
            }
        }
    }
    token
}

/// Collapse immediate tandem repeats so a retry at depth 2 and depth 500 match.
pub fn fold_stack_cycles(frame_hashes: &[u64]) -> (Vec<u64>, bool) {
    let mut folded = Vec::with_capacity(frame_hashes.len());
    let mut folded_any = false;
    for &frame_hash in frame_hashes {
        folded.push(frame_hash);
        for cycle_len in 1..=MAX_CYCLE {
            if folded.len() < cycle_len * 2 {
                continue;
            }
            let end = folded.len();
            let mid = end - cycle_len;
            let start = mid - cycle_len;
            if folded[start..mid] == folded[mid..end] {
                folded.truncate(mid);
                folded_any = true;
                break;
            }
        }
    }
    (folded, folded_any)
}

#[derive(Clone)]
struct NormFrame {
    file: String,
    function: String,
    line_bucket: u32,
    col_bucket: u32,
    hash: u64,
    context: Option<String>,
    context_line: Option<String>,
}

pub fn compute_multi_fingerprint(event: &Value) -> MultiFingerprint {
    compute_canonical_grouping(event, Uuid::nil(), None, None, None).0
}

pub fn preview_multi_fingerprint(payload: &[u8]) -> MultiFingerprint {
    if let Ok(value) = serde_json::from_slice::<Value>(payload) {
        return compute_multi_fingerprint(&value);
    }
    let fingerprint = hash_string(&hex::encode(payload));
    let mixed = xxh64(payload, 11);
    MultiFingerprint {
        fingerprint,
        h_exact: mixed,
        h_locus: mixed,
        h_sim: mixed,
        exception_type: "unknown".to_string(),
        templated_value: String::new(),
        throw_file: String::new(),
        throw_function: String::new(),
        line_bucket: 0,
        col_bucket: 0,
        merge_reason: "raw",
        cycle_folded: false,
        call_path_count: 0,
        custom: true,
        variant_label: String::new(),
    }
}

fn simhash(
    exception_type: &str,
    throw_file: &str,
    throw_function: &str,
    line_bucket: u32,
    active_innermost_first: &[NormFrame],
    templated: &str,
) -> u64 {
    let mut weights = [0i32; 64];
    let mut add = |hash: u64, weight: i32| {
        for (bit, slot) in weights.iter_mut().enumerate() {
            if (hash >> bit) & 1 == 1 {
                *slot += weight;
            } else {
                *slot -= weight;
            }
        }
    };

    // Throw site and exception type dominate. Caller and message weights stay
    // below the anchor margin so they cannot flip a bit on their own.
    add(xxh64(exception_type.as_bytes(), 1), 12);
    if !throw_file.is_empty() {
        add(xxh64(throw_file.as_bytes(), 2), 12);
    }
    if !throw_function.is_empty() {
        add(xxh64(throw_function.as_bytes(), 3), 12);
    }
    add(xxh64(&line_bucket.to_le_bytes(), 8), 4);

    for (index, frame) in active_innermost_first.iter().skip(1).take(6).enumerate() {
        let weight = if index == 0 { 2 } else { 1 };
        add(frame.hash, weight);
    }
    for token in templated.split_whitespace().take(8) {
        add(xxh64(token.as_bytes(), 4), 1);
    }

    let mut sim = 0u64;
    for (bit, weight) in weights.iter().enumerate() {
        if *weight > 0 {
            sim |= 1u64 << bit;
        }
    }
    sim
}

fn custom_fingerprint(event: &Value) -> Option<String> {
    let custom = event.get("fingerprint")?.as_array()?;
    if custom.is_empty() {
        return None;
    }
    let joined = custom
        .iter()
        .filter_map(Value::as_str)
        .collect::<Vec<_>>()
        .join(":");
    if joined.is_empty() {
        None
    } else {
        Some(hash_string(&joined))
    }
}

fn exception_type(event: &Value) -> String {
    if let Some(values) = event.pointer("/exception/values").and_then(Value::as_array) {
        if let Some(first) = values.first() {
            if let Some(ty) = first.get("type").and_then(Value::as_str) {
                return normalize_token(ty);
            }
        }
    }
    if let Some(values) = event.get("exception").and_then(Value::as_array) {
        if let Some(first) = values.first() {
            if let Some(ty) = first.get("type").and_then(Value::as_str) {
                return normalize_token(ty);
            }
        }
    }
    if let Some(threads) = event.pointer("/threads/values").and_then(Value::as_array) {
        let crashed = threads
            .iter()
            .find(|t| t.get("crashed").and_then(Value::as_bool).unwrap_or(false))
            .or_else(|| {
                threads
                    .iter()
                    .find(|t| t.get("current").and_then(Value::as_bool).unwrap_or(false))
            })
            .or_else(|| threads.first());
        if let Some(thread) = crashed {
            if let Some(name) = thread.get("name").and_then(Value::as_str) {
                return normalize_token(name);
            }
        }
    }
    exception_message(event)
        .map(|message| normalize_token(&message))
        .unwrap_or_else(|| "unknown".to_string())
}

fn exception_message(event: &Value) -> Option<String> {
    if let Some(values) = event.pointer("/exception/values").and_then(Value::as_array) {
        if let Some(first) = values.first() {
            if let Some(message) = json_text(first.get("value")) {
                return Some(message);
            }
        }
    }
    if let Some(values) = event.get("exception").and_then(Value::as_array) {
        if let Some(first) = values.first() {
            if let Some(message) = json_text(first.get("value")) {
                return Some(message);
            }
        }
    }
    if let Some(message) = json_text(event.get("message")) {
        return Some(message);
    }
    json_text(event.pointer("/logentry/formatted"))
        .or_else(|| json_text(event.pointer("/logentry/message")))
}

fn json_text(value: Option<&Value>) -> Option<String> {
    let value = value?;
    match value {
        Value::String(text) => Some(text.clone()),
        Value::Object(map) => map
            .get("formatted")
            .and_then(Value::as_str)
            .or_else(|| map.get("message").and_then(Value::as_str))
            .map(str::to_string),
        other => Some(other.to_string()),
    }
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
    if let Some(values) = event.get("exception").and_then(Value::as_array) {
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
    if let Some(threads) = event.pointer("/threads/values").and_then(Value::as_array) {
        let crashed = threads
            .iter()
            .find(|t| t.get("crashed").and_then(Value::as_bool).unwrap_or(false))
            .or_else(|| {
                threads
                    .iter()
                    .find(|t| t.get("current").and_then(Value::as_bool).unwrap_or(false))
            })
            .or_else(|| threads.first());
        if let Some(thread) = crashed {
            if let Some(frames) = thread
                .pointer("/stacktrace/frames")
                .and_then(Value::as_array)
            {
                return frames.clone();
            }
        }
    }
    Vec::new()
}

fn frame_is_in_app(frame: &Value, platform: Option<&str>) -> bool {
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
    !is_framework_frame(filename, module, package, function, platform)
}

fn normalize_frame(frame: &Value, platform: Option<&str>) -> NormFrame {
    let raw_file = ["filename", "abs_path", "module", "package"]
        .iter()
        .find_map(|key| {
            frame
                .get(*key)
                .and_then(Value::as_str)
                .filter(|s| !s.is_empty())
        })
        .unwrap_or("unknown");
    let raw_function = ["function", "symbol"]
        .iter()
        .find_map(|key| {
            frame
                .get(*key)
                .and_then(Value::as_str)
                .filter(|s| !s.is_empty())
        })
        .unwrap_or("unknown");
    let file = mask_content_hashes(&clean_frame_filename(raw_file));
    let function = canonicalize_function(raw_function, platform);
    let line_bucket = frame
        .get("lineno")
        .and_then(Value::as_u64)
        .unwrap_or(0)
        .min(u64::from(u32::MAX)) as u32
        >> 3;
    let col_bucket = frame
        .get("colno")
        .and_then(Value::as_u64)
        .unwrap_or(0)
        .min(u64::from(u32::MAX)) as u32
        >> 3;
    let material = format!("{file}\0{function}\0{line_bucket}\0{col_bucket}");
    let context = frame
        .get("context")
        .and_then(Value::as_str)
        .map(str::to_string);
    let context_line = frame
        .get("context_line")
        .and_then(Value::as_str)
        .map(str::to_string);
    NormFrame {
        file,
        function,
        line_bucket,
        col_bucket,
        hash: xxh64(material.as_bytes(), 2),
        context,
        context_line,
    }
}

fn canonicalize_function(raw: &str, _platform: Option<&str>) -> String {
    let demangled = demangle_rust_symbol(raw);
    let mut name = demangled.trim().to_string();
    if let Some(index) = name.find("{{closure}}#") {
        name.truncate(index + "{{closure}}".len());
    }
    if name.contains("$$Lambda$") || name.contains("$Lambda$") {
        return "<lambda>".to_string();
    }
    if name.contains("<anonymous>") || name.eq_ignore_ascii_case("anonymous") {
        return "<anonymous>".to_string();
    }
    name.to_ascii_lowercase()
}

fn mask_content_hashes(path: &str) -> String {
    let mut out = String::with_capacity(path.len());
    let mut hex_run = String::new();
    let flush_hex = |hex_run: &mut String, out: &mut String| {
        if hex_run.len() >= 5 {
            out.push_str("<HEX>");
        } else {
            out.push_str(hex_run);
        }
        hex_run.clear();
    };
    for ch in path.chars() {
        if ch.is_ascii_hexdigit() {
            hex_run.push(ch);
            continue;
        }
        if !hex_run.is_empty() {
            flush_hex(&mut hex_run, &mut out);
        }
        out.push(ch);
    }
    if !hex_run.is_empty() {
        flush_hex(&mut hex_run, &mut out);
    }
    out
}

fn normalize_token(token: &str) -> String {
    demangle_rust_symbol(token).trim().to_ascii_lowercase()
}

fn has_concrete_throw_site(file: &str, function: &str) -> bool {
    let file_known = !file.is_empty() && file != "unknown";
    let function_known = !function.is_empty() && function != "unknown";
    file_known || function_known
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}

#[derive(Debug, Clone)]
struct IndexedIssue {
    fingerprint: String,
    h_sim: u64,
    exception_type: String,
    file: String,
    function: String,
    line_bucket: u32,
}

/// In-memory pigeonhole index. A Hamming distance of at most 3 on a 64-bit
/// hash split into four 16-bit bands always leaves at least one band identical.
#[derive(Debug, Default)]
pub struct ProjectGroupingIndex {
    exact_to_issue: std::collections::HashMap<u64, String>,
    locus_to_issue: std::collections::HashMap<u64, String>,
    bands: [std::collections::HashMap<u16, Vec<IndexedIssue>>; BANDS],
    issue_count: usize,
}

impl ProjectGroupingIndex {
    pub fn resolve(&self, fp: &MultiFingerprint) -> Option<String> {
        if fp.custom {
            return None;
        }
        if let Some(hit) = self.exact_to_issue.get(&fp.h_exact) {
            return Some(hit.clone());
        }
        if let Some(hit) = self.locus_to_issue.get(&fp.h_locus) {
            return Some(hit.clone());
        }
        // Without a real throw site, message text is the identity. Simhash
        // weights cannot see that difference, so do not fuzzy-merge.
        if !has_concrete_throw_site(&fp.throw_file, &fp.throw_function) {
            return None;
        }
        for (band_index, band) in self.bands.iter().enumerate() {
            let chunk = fp.band(band_index);
            let Some(candidates) = band.get(&chunk) else {
                continue;
            };
            for candidate in candidates {
                if candidate.exception_type != fp.exception_type {
                    continue;
                }
                if !has_concrete_throw_site(&candidate.file, &candidate.function) {
                    continue;
                }
                if candidate.file != fp.throw_file || candidate.function != fp.throw_function {
                    continue;
                }
                if candidate.line_bucket.abs_diff(fp.line_bucket) > 1 {
                    continue;
                }
                if (candidate.h_sim ^ fp.h_sim).count_ones() <= SIMHASH_HAMMING {
                    return Some(candidate.fingerprint.clone());
                }
            }
        }
        None
    }

    pub fn observe(&mut self, fp: &MultiFingerprint, issue_fingerprint: &str) {
        if fp.custom || issue_fingerprint.is_empty() {
            return;
        }
        if self.issue_count >= MAX_INDEX_ISSUES && !self.exact_to_issue.contains_key(&fp.h_exact) {
            return;
        }
        let is_new_exact = !self.exact_to_issue.contains_key(&fp.h_exact);
        self.exact_to_issue
            .insert(fp.h_exact, issue_fingerprint.to_string());
        self.locus_to_issue
            .entry(fp.h_locus)
            .or_insert_with(|| issue_fingerprint.to_string());
        if is_new_exact {
            self.issue_count = self.issue_count.saturating_add(1);
            self.insert_bands(fp, issue_fingerprint);
        }
    }

    pub fn load_seed(&mut self, seed: &GroupingSeed) {
        let fp = MultiFingerprint {
            fingerprint: seed.fingerprint.clone(),
            h_exact: seed.h_exact,
            h_locus: seed.h_locus,
            h_sim: seed.h_sim,
            exception_type: seed.exception_type.clone(),
            templated_value: String::new(),
            throw_file: seed.file.clone(),
            throw_function: seed.function.clone(),
            line_bucket: seed.line_bucket,
            col_bucket: seed.col_bucket,
            merge_reason: "exact_stack",
            cycle_folded: false,
            call_path_count: 1,
            custom: false,
            variant_label: String::new(),
        };
        self.observe(&fp, &seed.fingerprint);
    }

    fn insert_bands(&mut self, fp: &MultiFingerprint, issue_fingerprint: &str) {
        let candidate = IndexedIssue {
            fingerprint: issue_fingerprint.to_string(),
            h_sim: fp.h_sim,
            exception_type: fp.exception_type.clone(),
            file: fp.throw_file.clone(),
            function: fp.throw_function.clone(),
            line_bucket: fp.line_bucket,
        };
        for (band_index, band) in self.bands.iter_mut().enumerate() {
            let chunk = fp.band(band_index);
            let bucket = band.entry(chunk).or_default();
            if bucket.len() >= MAX_CANDIDATES_PER_BAND {
                bucket.remove(0);
            }
            bucket.push(candidate.clone());
        }
    }
}

#[derive(Debug, Clone)]
pub struct GroupingSeed {
    pub fingerprint: String,
    pub h_exact: u64,
    pub h_locus: u64,
    pub h_sim: u64,
    pub exception_type: String,
    pub file: String,
    pub function: String,
    pub line_bucket: u32,
    pub col_bucket: u32,
}

/// Force in_app = false for vendor bundles, internal runtimes, and anonymous blocks
/// unless explicitly matching project in_app_include.
pub fn is_forced_not_in_app(filename: &str, in_app_include: Option<&[String]>) -> bool {
    let lower = filename.to_ascii_lowercase();
    if in_app_include.is_some_and(|includes| {
        includes
            .iter()
            .any(|inc| !inc.is_empty() && lower.contains(&inc.to_ascii_lowercase()))
    }) {
        return false;
    }
    if lower.contains("node_modules/") {
        if let Some(includes) = in_app_include {
            for inc in includes {
                if lower.contains(&inc.to_ascii_lowercase()) {
                    return false;
                }
            }
        }
        return true;
    }
    lower.contains("webpack/")
        || lower.contains("turbopack/")
        || lower.contains("next/dist/")
        || lower.contains("node:internal/")
        || lower.contains("internal/")
        || lower.contains("<anonymous>")
        || lower.contains("[native code]")
}

/// Transparent utility wrappers: file path matching utils, helpers, http, client, interceptors, logger,
/// or function names matching fetch*, request*, unwrap*, assert*, handleError*, createError*, log*.
pub fn is_utility_wrapper(filename: &str, function: &str) -> bool {
    let file = filename.to_ascii_lowercase();
    let func = function.to_ascii_lowercase();

    let path_wrapper = file.contains("/utils/")
        || file.contains("/helpers/")
        || file.contains("/http")
        || file.contains("/client")
        || file.contains("/api-client")
        || file.contains("/interceptors/")
        || file.contains("/logger");

    let func_wrapper = func.starts_with("fetch")
        || func.starts_with("request")
        || func.starts_with("unwrap")
        || func.starts_with("assert")
        || func.starts_with("handleerror")
        || func.starts_with("createerror")
        || func.starts_with("log");

    path_wrapper || func_wrapper
}

/// Dynamic tracker for high fan-in frames: if an innermost (file, function) has been seen with > 8
/// distinct caller frames in the project, it is treated as a wrapper.
#[derive(Debug, Default)]
pub struct FrameFanInTracker {
    callers: DashMap<(Uuid, String, String), std::collections::HashSet<(String, String)>>,
}

impl FrameFanInTracker {
    pub fn new() -> Self {
        Self {
            callers: DashMap::new(),
        }
    }

    pub fn record_and_check_is_wrapper(
        &self,
        project_id: Uuid,
        file: &str,
        func: &str,
        caller_file: Option<&str>,
        caller_func: Option<&str>,
    ) -> bool {
        let key = (project_id, file.to_string(), func.to_string());
        let mut entry = self.callers.entry(key).or_default();
        if let (Some(cf), Some(cfunc)) = (caller_file, caller_func) {
            if entry.len() < 32 {
                entry.insert((cf.to_string(), cfunc.to_string()));
            }
        }
        entry.len() > 8
    }

    pub fn is_high_fan_in(&self, project_id: Uuid, file: &str, func: &str) -> bool {
        let key = (project_id, file.to_string(), func.to_string());
        if let Some(entry) = self.callers.get(&key) {
            entry.len() > 8
        } else {
            false
        }
    }
}

/// Active 4-Band 16-Bit SimHash LSH Index
type LshBand = DashMap<(Uuid, u16), SmallVec<[(u64, u64, u64, u32); 8]>>;

#[derive(Debug, Default)]
pub struct SimHashLshRouter {
    pub bands: [LshBand; 4],
}

impl SimHashLshRouter {
    pub fn new() -> Self {
        Self {
            bands: [
                DashMap::new(),
                DashMap::new(),
                DashMap::new(),
                DashMap::new(),
            ],
        }
    }

    pub fn query_or_insert(
        &self,
        project_id: Uuid,
        scope_key_hash: u64,
        h_sim: u64,
        h_locus: u64,
    ) -> (u64, bool) {
        self.query_or_insert_guarded(project_id, scope_key_hash, h_sim, h_locus, 0)
    }

    pub fn query_or_insert_guarded(
        &self,
        project_id: Uuid,
        scope_key_hash: u64,
        h_sim: u64,
        h_locus: u64,
        line_bucket: u32,
    ) -> (u64, bool) {
        for (band_idx, band_map) in self.bands.iter().enumerate() {
            let band_val = band_of(h_sim, band_idx);
            let key = (project_id, band_val);
            if let Some(candidates) = band_map.get(&key) {
                for &(cand_scope, cand_sim, cand_locus, cand_line) in candidates.iter() {
                    if cand_scope == scope_key_hash
                        && cand_line.abs_diff(line_bucket) <= 1
                        && (cand_sim ^ h_sim).count_ones() <= 3
                    {
                        return (cand_locus, true);
                    }
                }
            }
        }

        for (band_idx, band_map) in self.bands.iter().enumerate() {
            let band_val = band_of(h_sim, band_idx);
            let key = (project_id, band_val);
            let mut bucket = band_map.entry(key).or_default();
            if bucket.len() >= 8 {
                bucket.remove(0); // FIFO replacement
            }
            bucket.push((scope_key_hash, h_sim, h_locus, line_bucket));
        }

        (h_locus, false)
    }
}

/// Stage 2 Post-Demangle Multi-Resolution Grouping with Wrapper Elision and 4-Band LSH.
pub fn compute_canonical_grouping(
    event: &Value,
    project_id: Uuid,
    in_app_include: Option<&[String]>,
    fan_in_tracker: Option<&FrameFanInTracker>,
    lsh_router: Option<&SimHashLshRouter>,
) -> (MultiFingerprint, GroupingMeta) {
    let mut meta = GroupingMeta {
        wire_hash: Some(compute_wire_hash(event)),
        matched_by: "fallback".to_string(),
        ..Default::default()
    };

    if let Some(msg) = exception_message(event) {
        meta.decoded_framework_error = extract_decoded_framework_error(&msg);
    }

    if let Some(custom) = custom_fingerprint(event) {
        let templated = exception_message(event)
            .map(|message| normalize_exception_value(&message))
            .unwrap_or_default();
        let mixed = xxh64(custom.as_bytes(), 9);
        meta.matched_by = "exact".to_string();
        meta.h_locus = Some(mixed);
        meta.h_sim = Some(mixed);
        return (
            MultiFingerprint {
                fingerprint: custom,
                h_exact: mixed,
                h_locus: mixed,
                h_sim: mixed,
                exception_type: exception_type(event),
                templated_value: templated,
                throw_file: String::new(),
                throw_function: String::new(),
                line_bucket: 0,
                col_bucket: 0,
                merge_reason: "custom",
                cycle_folded: false,
                call_path_count: 0,
                custom: true,
                variant_label: String::new(),
            },
            meta,
        );
    }

    let root_cause_type = exception_type(event);
    let outer_type = event
        .pointer("/exception/values")
        .and_then(Value::as_array)
        .and_then(|v| v.first())
        .and_then(|f| f.get("type"))
        .and_then(Value::as_str)
        .map(normalize_token)
        .unwrap_or_else(|| root_cause_type.clone());

    let templated = exception_message(event)
        .map(|message| normalize_exception_value(&message))
        .unwrap_or_default();
    let platform = event.get("platform").and_then(Value::as_str);

    let raw_frames = exception_frames(event);
    let mut in_app_frames = Vec::new();
    let mut other_frames = Vec::new();

    for frame in raw_frames.into_iter().rev() {
        let mut norm = normalize_frame(&frame, platform);
        if let Some(ctx) = frame.get("context_line").and_then(Value::as_str) {
            norm.context_line = Some(ctx.to_string());
        }
        if let Some(ctx) = frame.get("context").and_then(Value::as_str) {
            norm.context = Some(ctx.to_string());
        }

        let is_forced_off = is_forced_not_in_app(&norm.file, in_app_include);
        let in_app_effective = if is_forced_off {
            false
        } else {
            frame_is_in_app(&frame, platform)
        };

        if in_app_effective {
            in_app_frames.push(norm);
        } else {
            other_frames.push(norm);
        }
    }

    let weak_stack = in_app_frames.is_empty();
    let active_frames = if weak_stack {
        other_frames
    } else {
        in_app_frames
    };

    if active_frames.is_empty() {
        let locus_material = format!("{root_cause_type}\0no-frame\0{templated}");
        let h_locus = xxh64(locus_material.as_bytes(), 7);
        let h_exact =
            xxh64(root_cause_type.as_bytes(), 1) ^ xxh64(templated.as_bytes(), 6) ^ h_locus;
        let h_sim = h_locus;
        meta.matched_by = "fallback".to_string();
        meta.h_locus = Some(h_locus);
        meta.h_sim = Some(h_sim);

        return (
            MultiFingerprint {
                fingerprint: hash_string(&locus_material),
                h_exact,
                h_locus,
                h_sim,
                exception_type: root_cause_type,
                templated_value: templated,
                throw_file: String::new(),
                throw_function: String::new(),
                line_bucket: 0,
                col_bucket: 0,
                merge_reason: "message_template",
                cycle_folded: false,
                call_path_count: 0,
                custom: false,
                variant_label: String::new(),
            },
            meta,
        );
    }

    // Utility wrapper elision
    let mut causal_idx = 0;
    let mut elided_wrapper_frames = Vec::new();
    let innermost = &active_frames[0];
    let innermost_is_wrapper = is_utility_wrapper(&innermost.file, &innermost.function)
        || fan_in_tracker
            .is_some_and(|t| t.is_high_fan_in(project_id, &innermost.file, &innermost.function));

    if innermost_is_wrapper && !weak_stack {
        for (idx, cand) in active_frames.iter().enumerate().take(4).skip(1) {
            let cand_is_wrapper = is_utility_wrapper(&cand.file, &cand.function)
                || fan_in_tracker
                    .is_some_and(|t| t.is_high_fan_in(project_id, &cand.file, &cand.function));
            if !cand_is_wrapper {
                causal_idx = idx;
                elided_wrapper_frames = (0..idx).collect();
                break;
            }
        }
    }

    if !elided_wrapper_frames.is_empty() {
        meta.matched_by = "wrapper_elided".to_string();
    } else {
        meta.matched_by = "locus".to_string();
    }
    meta.causal_frame_index = Some(causal_idx);
    meta.elided_wrapper_frames = elided_wrapper_frames;

    let causal_frame = &active_frames[causal_idx];
    let immediate_caller = active_frames.get(causal_idx + 1);

    if let Some(tracker) = fan_in_tracker {
        tracker.record_and_check_is_wrapper(
            project_id,
            &causal_frame.file,
            &causal_frame.function,
            immediate_caller.map(|c| c.file.as_str()),
            immediate_caller.map(|c| c.function.as_str()),
        );
    }

    let hashes: Vec<u64> = active_frames[causal_idx..].iter().map(|f| f.hash).collect();
    let (folded, cycle_folded) = fold_stack_cycles(&hashes);
    let call_path_count = u16::try_from(folded.len()).unwrap_or(u16::MAX);

    // Scope-Relative h_locus
    let ctx_line = causal_frame
        .context_line
        .as_deref()
        .or(causal_frame.context.as_deref());
    let has_concrete = !causal_frame.function.is_empty()
        && causal_frame.function != "<anonymous>"
        && causal_frame.function != "anonymous"
        && causal_frame.function != "unknown";

    let locus_material = if has_concrete || ctx_line.is_some() {
        let ctx_hash = ctx_line
            .map(|l| xxh64(l.trim().as_bytes(), 42))
            .unwrap_or(0);
        let location = if ctx_line.is_some() {
            0
        } else {
            causal_frame.line_bucket
        };
        format!(
            "{root_cause_type}\0{outer_type}\0{}\0{}\0{ctx_hash}\0{location}\0{templated}",
            causal_frame.file, causal_frame.function
        )
    } else {
        format!(
            "{root_cause_type}\0{outer_type}\0{}\0{}\0{}\0{}\0{templated}",
            causal_frame.file,
            causal_frame.function,
            causal_frame.line_bucket,
            causal_frame.col_bucket
        )
    };

    let h_locus = xxh64(locus_material.as_bytes(), 7);
    let h_sim = simhash(
        &root_cause_type,
        &causal_frame.file,
        &causal_frame.function,
        causal_frame.line_bucket,
        &active_frames[causal_idx..],
        &templated,
    );

    let mut h_exact = xxh64(root_cause_type.as_bytes(), 1) ^ xxh64(templated.as_bytes(), 6);
    for frame_hash in &folded {
        h_exact = h_exact.rotate_left(11) ^ frame_hash;
    }

    // Active 4-Band LSH Routing
    let scope_key_hash = xxh64(
        format!(
            "{root_cause_type}\0{outer_type}\0{}\0{}\0{templated}",
            causal_frame.file, causal_frame.function
        )
        .as_bytes(),
        0,
    );
    let final_h_locus = if let Some(router) = lsh_router {
        let (routed_locus, matched_sim) = router.query_or_insert_guarded(
            project_id,
            scope_key_hash,
            h_sim,
            h_locus,
            causal_frame.line_bucket,
        );
        if matched_sim && meta.matched_by != "wrapper_elided" {
            meta.matched_by = "simhash_lsh".to_string();
        }
        routed_locus
    } else {
        h_locus
    };

    meta.h_locus = Some(final_h_locus);
    meta.h_sim = Some(h_sim);

    let merge_reason = if weak_stack {
        "message_template"
    } else if meta.matched_by == "wrapper_elided" {
        "wrapper_elided"
    } else if cycle_folded {
        "cycle_folded"
    } else if call_path_count > 1 {
        "crash_site"
    } else {
        "exact_stack"
    };

    let variant_label = match immediate_caller {
        Some(frame) => format!("{}:{} | {templated}", frame.file, frame.function),
        None if !templated.is_empty() => templated.clone(),
        None => String::new(),
    };
    let variant_label = truncate_chars(&variant_label, 180);

    let issue_fingerprint = hash_string(&format!("{root_cause_type}\0{final_h_locus}"));

    (
        MultiFingerprint {
            fingerprint: issue_fingerprint,
            h_exact,
            h_locus: final_h_locus,
            h_sim,
            exception_type: root_cause_type,
            templated_value: templated,
            throw_file: causal_frame.file.clone(),
            throw_function: causal_frame.function.clone(),
            line_bucket: causal_frame.line_bucket,
            col_bucket: causal_frame.col_bucket,
            merge_reason,
            cycle_folded,
            call_path_count,
            custom: false,
            variant_label,
        },
        meta,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn event(ty: &str, message: &str, frames: serde_json::Value) -> Value {
        json!({
            "exception": {
                "values": [{
                    "type": ty,
                    "value": message,
                    "stacktrace": { "frames": frames }
                }]
            }
        })
    }

    fn frame(file: &str, function: &str, line: u64, in_app: bool) -> Value {
        json!({
            "filename": file,
            "function": function,
            "lineno": line,
            "in_app": in_app
        })
    }

    #[test]
    fn xxh64_matches_empty_reference_vector() {
        assert_eq!(xxh64(b"", 0), 0xEF46_DB37_51D8_E999);
    }

    #[test]
    fn templates_timeouts_and_ids() {
        let left = normalize_exception_value("timed out after 3004ms");
        let right = normalize_exception_value("timed out after 3009ms");
        assert_eq!(left, right);
        assert!(left.contains("<NUM>"));

        let key = normalize_exception_value("KeyError: 'user_session_98a7f_temp'");
        assert!(key.contains("<QUOTED>"));
        assert!(!key.contains("98a7f"));
    }

    #[test]
    fn masks_chunk_hashes_in_filenames() {
        assert_eq!(mask_content_hashes("app.8f92a1.js"), "app.<HEX>.js");
        assert_eq!(mask_content_hashes("chunk-8f92a.js"), "chunk-<HEX>.js");
        assert_eq!(mask_content_hashes("src/app/page.tsx"), "src/app/page.tsx");
    }

    #[test]
    fn fold_collapses_retry_depth() {
        let cycle = [1u64, 2, 1, 2, 1, 2, 3];
        let (folded, did) = fold_stack_cycles(&cycle);
        assert!(did);
        assert_eq!(folded, vec![1, 2, 3]);
    }

    #[test]
    fn dynamic_messages_share_a_crash_site() {
        let frames = json!([
            frame("src/routes/billing.ts", "charge", 10, true),
            frame("src/db.ts", "query", 40, true)
        ]);
        let left = compute_multi_fingerprint(&event(
            "TimeoutError",
            "timed out after 3004ms",
            frames.clone(),
        ));
        let right =
            compute_multi_fingerprint(&event("TimeoutError", "timed out after 9999ms", frames));
        assert_eq!(left.fingerprint, right.fingerprint);
        assert_eq!(left.h_locus, right.h_locus);
        // Templating removes the latency, so the normalized event is exact.
        assert_eq!(left.h_exact, right.h_exact);
        assert!((left.h_sim ^ right.h_sim).count_ones() <= SIMHASH_HAMMING);
    }

    #[test]
    fn distinct_message_classes_at_same_site_remain_separate() {
        let frames = json!([frame("src/db.ts", "query", 40, true)]);
        let left =
            compute_multi_fingerprint(&event("Error", "connection reset by peer", frames.clone()));
        let right = compute_multi_fingerprint(&event("Error", "statement timeout", frames));
        assert_ne!(left.fingerprint, right.fingerprint);
        assert_ne!(left.h_exact, right.h_exact);
        assert!((left.h_sim ^ right.h_sim).count_ones() <= SIMHASH_HAMMING);
    }

    #[test]
    fn distinct_callers_share_the_throw_site() {
        let left = compute_multi_fingerprint(&event(
            "TypeError",
            "bad token",
            json!([
                frame("src/routes/a.ts", "getUser", 4, true),
                frame("src/auth.ts", "parseToken", 20, true)
            ]),
        ));
        let right = compute_multi_fingerprint(&event(
            "TypeError",
            "bad token",
            json!([
                frame("src/routes/b.ts", "getInvoice", 8, true),
                frame("src/auth.ts", "parseToken", 22, true)
            ]),
        ));
        assert_eq!(left.fingerprint, right.fingerprint);
        assert_eq!(left.merge_reason, "crash_site");
        assert_ne!(left.h_exact, right.h_exact);
        assert!((left.h_sim ^ right.h_sim).count_ones() <= SIMHASH_HAMMING);
    }

    #[test]
    fn different_throw_sites_stay_apart() {
        let left = compute_multi_fingerprint(&event(
            "TypeError",
            "bad",
            json!([frame("src/auth.ts", "parseToken", 20, true)]),
        ));
        let right = compute_multi_fingerprint(&event(
            "TypeError",
            "bad",
            json!([frame("src/auth.ts", "verifyToken", 20, true)]),
        ));
        assert_ne!(left.fingerprint, right.fingerprint);
        assert!((left.h_sim ^ right.h_sim).count_ones() > SIMHASH_HAMMING);
    }

    #[test]
    fn recursion_depth_does_not_split_the_issue() {
        let shallow = compute_multi_fingerprint(&event(
            "RangeError",
            "stack",
            json!([
                frame("src/app.ts", "run", 3, true),
                frame("src/app.ts", "retry", 8, true),
                frame("src/app.ts", "parse", 12, true)
            ]),
        ));
        let deep = compute_multi_fingerprint(&event(
            "RangeError",
            "stack",
            json!([
                frame("src/app.ts", "run", 3, true),
                frame("src/app.ts", "retry", 8, true),
                frame("src/app.ts", "retry", 8, true),
                frame("src/app.ts", "retry", 8, true),
                frame("src/app.ts", "parse", 12, true)
            ]),
        ));
        assert_eq!(shallow.fingerprint, deep.fingerprint);
        assert!(deep.cycle_folded);
        assert_eq!(shallow.h_exact, deep.h_exact);
    }

    #[test]
    fn line_bucket_absorbs_small_edits_and_splits_far_ones() {
        let line_4 = compute_multi_fingerprint(&event(
            "Error",
            "x",
            json!([frame("app.js", "main", 4, true)]),
        ));
        let line_7 = compute_multi_fingerprint(&event(
            "Error",
            "x",
            json!([frame("app.js", "main", 7, true)]),
        ));
        let line_16 = compute_multi_fingerprint(&event(
            "Error",
            "x",
            json!([frame("app.js", "main", 16, true)]),
        ));
        assert_eq!(line_4.fingerprint, line_7.fingerprint);
        assert_ne!(line_4.fingerprint, line_16.fingerprint);
    }

    #[test]
    fn chunk_hashes_and_closure_counters_collapse() {
        let left = compute_multi_fingerprint(&event(
            "TypeError",
            "x",
            json!([frame(
                "static/app.8f92a1.js",
                "main::{{closure}}#0",
                1,
                true
            )]),
        ));
        let right = compute_multi_fingerprint(&event(
            "TypeError",
            "x",
            json!([frame(
                "static/app.b71c2e.js",
                "main::{{closure}}#3",
                1,
                true
            )]),
        ));
        assert_eq!(left.fingerprint, right.fingerprint);
        assert_eq!(left.throw_function, "main::{{closure}}");
    }

    #[test]
    fn stackless_messages_group_by_template() {
        let left = compute_multi_fingerprint(&event("Error", "user 10 missing", json!([])));
        let right = compute_multi_fingerprint(&event("Error", "user 99 missing", json!([])));
        let other = compute_multi_fingerprint(&event("Error", "disk full", json!([])));
        assert_eq!(left.fingerprint, right.fingerprint);
        assert_ne!(left.fingerprint, other.fingerprint);
        assert_eq!(left.merge_reason, "message_template");
    }

    #[test]
    fn stackless_errors_do_not_simhash_merge() {
        let listen = compute_multi_fingerprint(&event("Error", "listen EADDRINUSE", json!([])));
        let missing =
            compute_multi_fingerprint(&event("Error", "Call to undefined function", json!([])));
        assert_ne!(listen.fingerprint, missing.fingerprint);
        let mut index = ProjectGroupingIndex::default();
        index.observe(&listen, &listen.fingerprint);
        assert!(index.resolve(&missing).is_none());
    }

    #[test]
    fn pigeonhole_finds_adjacent_line_buckets() {
        let first = compute_multi_fingerprint(&event(
            "Error",
            "x",
            json!([frame("app.js", "main", 4, true)]),
        ));
        let neighbor = compute_multi_fingerprint(&event(
            "Error",
            "x",
            json!([frame("app.js", "main", 8, true)]),
        ));
        let far = compute_multi_fingerprint(&event(
            "Error",
            "x",
            json!([frame("app.js", "main", 80, true)]),
        ));
        assert_ne!(first.fingerprint, neighbor.fingerprint);
        let mut index = ProjectGroupingIndex::default();
        index.observe(&first, &first.fingerprint);
        assert_eq!(
            index.resolve(&neighbor).as_deref(),
            Some(first.fingerprint.as_str())
        );
        assert!(index.resolve(&far).is_none());
    }

    #[test]
    fn hamming_within_three_shares_a_band() {
        let base = 0u64;
        let mutated = (1u64 << 1) | (1u64 << 17) | (1u64 << 33);
        assert_eq!((base ^ mutated).count_ones(), 3);
        let shared = (0..4).any(|band| band_of(base, band) == band_of(mutated, band));
        assert!(shared);
    }

    #[test]
    fn preserves_error_codes_during_sanitization() {
        // #418 preserved
        let react = normalize_exception_value("Minified React error #418; visit https://react.dev");
        assert!(react.contains("#418"), "Expected #418 in: {react}");

        // Rust code E0382 preserved
        let rust = normalize_exception_value("cannot borrow moved value E0382");
        assert!(rust.contains("e0382"), "Expected e0382 in: {rust}");

        // HTTP status codes preserved
        let http = normalize_exception_value("HTTP 500 Internal Server Error");
        assert!(http.contains("500"), "Expected 500 in: {http}");

        // SQLSTATE code 23505 preserved
        let sql = normalize_exception_value("duplicate key 23505 unique constraint violation");
        assert!(sql.contains("23505"), "Expected 23505 in: {sql}");

        // Standalone numbers and UUIDs replaced
        let nums = normalize_exception_value("order 987654 failed for user 4321");
        assert!(nums.contains("<NUM>"));
        assert!(!nums.contains("987654"));

        let uuid = normalize_exception_value("tx 550e8400-e29b-41d4-a716-446655440000");
        assert!(uuid.contains("<UUID>"));
    }

    #[test]
    fn decodes_react_minified_invariant() {
        let decoded_418 = decode_react_invariant("#418");
        assert!(decoded_418.is_some());
        assert!(decoded_418.unwrap().contains("Hydration failed"));

        let decoded_310 = decode_react_invariant("#310");
        assert!(decoded_310.is_some());
        assert!(decoded_310.unwrap().contains("Rendered more hooks"));

        let extracted = extract_decoded_framework_error(
            "Minified React error #418; visit https://react.dev/errors/418 for the full message",
        );
        assert!(extracted.is_some());
        assert!(extracted.unwrap().contains("Hydration failed"));
    }

    #[test]
    fn compute_wire_hash_is_fast_and_deterministic() {
        let ev = event(
            "TypeError",
            "cannot read properties of undefined",
            json!([
                frame("src/app.tsx", "render", 12, true),
                frame("src/utils/http.ts", "fetchData", 80, true)
            ]),
        );
        let h1 = compute_wire_hash(&ev);
        let h2 = compute_wire_hash(&ev);
        assert_eq!(h1, h2);
        assert_ne!(h1, 0);
    }

    #[test]
    fn wrapper_elision_selects_causal_caller() {
        let project_id = Uuid::new_v4();
        let ev = event(
            "Error",
            "network timeout",
            json!([
                // Causal caller
                frame("src/features/checkout.ts", "submitPayment", 100, true),
                // Intermediate wrapper
                frame("src/utils/http.ts", "request", 45, true),
                // Innermost wrapper throw site
                frame("src/utils/client.ts", "fetchWithTimeout", 12, true)
            ]),
        );

        let (fp, meta) = compute_canonical_grouping(&ev, project_id, None, None, None);
        assert_eq!(meta.matched_by, "wrapper_elided");
        assert_eq!(meta.causal_frame_index, Some(2)); // index 2 is submitPayment (reversed from frames)
        assert_eq!(meta.elided_wrapper_frames, vec![0, 1]);
        assert_eq!(fp.throw_file, "src/features/checkout.ts");
        assert_eq!(fp.throw_function, "submitpayment");
    }

    #[test]
    fn simhash_lsh_router_matches_near_duplicates() {
        let router = SimHashLshRouter::new();
        let project_id = Uuid::new_v4();
        let scope_key = 12345u64;

        let locus_orig = 999999u64;
        let sim_orig = 0b10101010_11001100_00110011_11110000_10101010_11001100_00110011_11110000u64;

        // First insert
        let (routed_1, matched_1) =
            router.query_or_insert(project_id, scope_key, sim_orig, locus_orig);
        assert_eq!(routed_1, locus_orig);
        assert!(!matched_1);

        // Near-duplicate with 2 bits flipped (within Hamming <= 3)
        let sim_near = sim_orig ^ (1 | (1 << 2));
        let locus_cand = 888888u64;
        let (routed_2, matched_2) =
            router.query_or_insert(project_id, scope_key, sim_near, locus_cand);
        assert_eq!(routed_2, locus_orig);
        assert!(matched_2);
    }

    #[test]
    fn is_forced_not_in_app_identifies_vendor_and_runtime_frames() {
        assert!(is_forced_not_in_app("node_modules/react/index.js", None));
        // Allowed when in in_app_include
        let includes = vec!["@org/core".to_string()];
        assert!(!is_forced_not_in_app(
            "node_modules/@org/core/index.js",
            Some(&includes)
        ));
        assert!(is_forced_not_in_app("webpack/runtime/bootstrap.js", None));
        assert!(is_forced_not_in_app("next/dist/client/index.js", None));
        assert!(is_forced_not_in_app(
            "node:internal/process/task_queues",
            None
        ));
    }
}
