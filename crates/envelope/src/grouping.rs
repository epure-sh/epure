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
use serde_json::Value;
use sha2::{Digest, Sha256};

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
        })
    }

    pub fn band(&self, index: usize) -> u16 {
        band_of(self.h_sim, index)
    }
}

pub fn band_of(hash: u64, index: usize) -> u16 {
    ((hash >> (index * BAND_BITS as usize)) & 0xFFFF) as u16
}

/// Drain-style single pass. Dynamic tokens become typed placeholders.
pub fn normalize_exception_value(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len().min(TEMPLATE_LIMIT));
    let mut chars = raw.chars().peekable();
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
        if let Some(placeholder) = placeholder_for(&token) {
            out.push_str(placeholder);
        } else {
            for lower in token.chars() {
                if out.len() >= TEMPLATE_LIMIT {
                    break;
                }
                out.push(lower.to_ascii_lowercase());
            }
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
    let hex_digits = token
        .bytes()
        .filter(|byte| byte.is_ascii_hexdigit())
        .count();
    if hex_digits >= 6
        && token
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() || byte == b'-')
    {
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
}

pub fn compute_multi_fingerprint(event: &Value) -> MultiFingerprint {
    if let Some(custom) = custom_fingerprint(event) {
        let templated = exception_message(event)
            .map(|message| normalize_exception_value(&message))
            .unwrap_or_default();
        let mixed = xxh64(custom.as_bytes(), 9);
        return MultiFingerprint {
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
        };
    }

    let exception_type = exception_type(event);
    let templated = exception_message(event)
        .map(|message| normalize_exception_value(&message))
        .unwrap_or_default();
    let platform = event.get("platform").and_then(Value::as_str);
    let (in_app, other) = split_frames(event, platform);
    let weak_stack = in_app.is_empty();
    let active = if weak_stack { other } else { in_app };
    let hashes: Vec<u64> = active.iter().map(|frame| frame.hash).collect();
    let (folded, cycle_folded) = fold_stack_cycles(&hashes);
    let call_path_count = u16::try_from(folded.len()).unwrap_or(u16::MAX);

    let throw = active.first();
    let throw_file = throw.map(|frame| frame.file.clone()).unwrap_or_default();
    let throw_function = throw
        .map(|frame| frame.function.clone())
        .unwrap_or_default();
    let line_bucket = throw.map(|frame| frame.line_bucket).unwrap_or(0);
    let col_bucket = throw.map(|frame| frame.col_bucket).unwrap_or(0);

    let locus_material = if throw.is_none() {
        format!("{exception_type}\0no-frame\0{templated}")
    } else if weak_stack {
        format!("{exception_type}\0{throw_file}:{throw_function}:{line_bucket}:{col_bucket}\0{templated}")
    } else {
        format!("{exception_type}\0{throw_file}:{throw_function}:{line_bucket}:{col_bucket}")
    };

    let mut h_exact = xxh64(exception_type.as_bytes(), 1) ^ xxh64(templated.as_bytes(), 6);
    if folded.is_empty() {
        h_exact ^= xxh64(locus_material.as_bytes(), 5);
    }
    for frame_hash in &folded {
        h_exact = h_exact.rotate_left(11) ^ frame_hash;
    }
    let h_locus = xxh64(locus_material.as_bytes(), 7);
    let h_sim = simhash(
        &exception_type,
        &throw_file,
        &throw_function,
        line_bucket,
        &active,
        &templated,
    );

    let merge_reason = if throw.is_none() || weak_stack {
        "message_template"
    } else if cycle_folded {
        "cycle_folded"
    } else if call_path_count > 1 {
        "crash_site"
    } else {
        "exact_stack"
    };

    let caller = active.get(1);
    let variant_label = match caller {
        Some(frame) => format!("{}:{} | {templated}", frame.file, frame.function),
        None if !templated.is_empty() => templated.clone(),
        None => String::new(),
    };
    let variant_label = truncate_chars(&variant_label, 180);

    MultiFingerprint {
        fingerprint: hash_string(&locus_material),
        h_exact,
        h_locus,
        h_sim,
        exception_type,
        templated_value: templated,
        throw_file,
        throw_function,
        line_bucket,
        col_bucket,
        merge_reason,
        cycle_folded,
        call_path_count,
        custom: false,
        variant_label,
    }
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

fn split_frames(event: &Value, platform: Option<&str>) -> (Vec<NormFrame>, Vec<NormFrame>) {
    let mut in_app = Vec::new();
    let mut other = Vec::new();
    for frame in exception_frames(event).into_iter().rev() {
        let norm = normalize_frame(&frame, platform);
        if frame_is_in_app(&frame, platform) {
            in_app.push(norm);
        } else {
            other.push(norm);
        }
    }
    (in_app, other)
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
    event
        .pointer("/stacktrace/frames")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
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
    let raw_file = frame
        .get("filename")
        .or_else(|| frame.get("abs_path"))
        .or_else(|| frame.get("module"))
        .or_else(|| frame.get("package"))
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let raw_function = frame
        .get("function")
        .or_else(|| frame.get("symbol"))
        .and_then(Value::as_str)
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
    NormFrame {
        file,
        function,
        line_bucket,
        col_bucket,
        hash: xxh64(material.as_bytes(), 2),
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
        for band_index in 0..BANDS {
            let chunk = fp.band(band_index);
            let Some(candidates) = self.bands[band_index].get(&chunk) else {
                continue;
            };
            for candidate in candidates {
                if candidate.exception_type != fp.exception_type {
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
        for band_index in 0..BANDS {
            let chunk = fp.band(band_index);
            let bucket = self.bands[band_index].entry(chunk).or_default();
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
    fn residual_message_words_keep_the_locus_and_split_exact() {
        let frames = json!([frame("src/db.ts", "query", 40, true)]);
        let left =
            compute_multi_fingerprint(&event("Error", "connection reset by peer", frames.clone()));
        let right = compute_multi_fingerprint(&event("Error", "statement timeout", frames));
        assert_eq!(left.fingerprint, right.fingerprint);
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
}
