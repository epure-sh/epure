use memchr::memchr;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::borrow::Cow;
use thiserror::Error;

use crate::store::{decompress_store_payload, is_gzip, is_zlib};

#[derive(Debug, Error)]
pub enum EnvelopeError {
    #[error("envelope body is empty")]
    Empty,
    #[error("malformed envelope item header")]
    MalformedItemHeader,
    #[error("no event item found in envelope")]
    NoEvent,
    #[error("non-error envelope items absorbed")]
    NonErrorAbsorbed,
    #[error("envelope item length mismatch")]
    LengthMismatch,
    #[error("envelope decompression failed")]
    DecompressFailed,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CheckInItem {
    pub check_in_id: Option<String>,
    pub monitor_slug: String,
    pub status: String,
    pub duration: Option<f64>,
    pub schedule: Option<String>,
    pub environment: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ParsedEnvelope {
    pub event_payload: Vec<u8>,
    pub check_ins: Vec<CheckInItem>,
}

/// Zero-copy scan of a Sentry envelope; discards transaction items.
///
/// PHP / Laravel SDKs gzip the body by default (`http_compression`); accept that
/// the same way store ingest already does.
pub fn parse_envelope(body: &[u8]) -> Result<ParsedEnvelope, EnvelopeError> {
    let decoded = decode_envelope_body(body)?;
    parse_envelope_decoded(&decoded)
}

fn decode_envelope_body(body: &[u8]) -> Result<Cow<'_, [u8]>, EnvelopeError> {
    if body.is_empty() {
        return Err(EnvelopeError::Empty);
    }

    let decoded = if body.first() == Some(&b'{') {
        Cow::Borrowed(body)
    } else if is_gzip(body) || is_zlib(body) {
        let decoded =
            decompress_store_payload(body).map_err(|_| EnvelopeError::DecompressFailed)?;
        Cow::Owned(decoded)
    } else {
        return Err(EnvelopeError::MalformedItemHeader);
    };

    Ok(normalize_newlines(decoded))
}

/// Envelope wire format is `\n`-separated. Some SDKs / proxies emit `\r\n`.
fn normalize_newlines(body: Cow<'_, [u8]>) -> Cow<'_, [u8]> {
    if !body.contains(&b'\r') {
        return body;
    }
    let mut out = Vec::with_capacity(body.len());
    let mut i = 0;
    while i < body.len() {
        match body[i] {
            b'\r' if i + 1 < body.len() && body[i + 1] == b'\n' => {
                out.push(b'\n');
                i += 2;
            }
            b'\r' => {
                out.push(b'\n');
                i += 1;
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    Cow::Owned(out)
}

pub fn parse_check_in_payload(payload: &[u8]) -> Option<CheckInItem> {
    let val: Value = serde_json::from_slice(payload).ok()?;
    let monitor_slug = val
        .get("monitor_slug")
        .or_else(|| val.get("slug"))
        .and_then(Value::as_str)?
        .trim()
        .to_string();

    if monitor_slug.is_empty() {
        return None;
    }

    let check_in_id = val
        .get("check_in_id")
        .or_else(|| val.get("id"))
        .and_then(Value::as_str)
        .map(|s| s.to_string());

    let status = val
        .get("status")
        .and_then(Value::as_str)
        .map(|s| s.to_string())
        .unwrap_or_else(|| "ok".to_string());

    let duration = val
        .get("duration")
        .and_then(Value::as_f64)
        .filter(|d| d.is_finite() && *d >= 0.0);

    let schedule = val
        .get("monitor_config")
        .and_then(|c| {
            if let Some(s) = c.get("schedule") {
                if let Some(sched_str) = s.as_str() {
                    return Some(sched_str.to_string());
                }
                if let Some(val_str) = s.get("value").and_then(Value::as_str) {
                    return Some(val_str.to_string());
                }
                if let (Some(val_num), Some(unit)) = (
                    s.get("value").and_then(Value::as_i64),
                    s.get("unit").and_then(Value::as_str),
                ) {
                    return Some(format!("every {val_num} {unit}"));
                }
            }
            None
        })
        .or_else(|| {
            val.get("schedule")
                .and_then(Value::as_str)
                .map(|s| s.to_string())
        });

    let environment = val
        .get("environment")
        .and_then(Value::as_str)
        .map(|s| s.to_string());

    Some(CheckInItem {
        check_in_id,
        monitor_slug,
        status,
        duration,
        schedule,
        environment,
    })
}

fn parse_envelope_decoded(body: &[u8]) -> Result<ParsedEnvelope, EnvelopeError> {
    let mut offset = next_line_end(body, 0)
        .map(|end| end + 1)
        .unwrap_or(body.len());
    let mut event_payload = None;
    let mut check_ins = Vec::new();
    let mut has_non_error_items = false;

    while offset < body.len() {
        let line_end = next_line_end(body, offset).ok_or(EnvelopeError::MalformedItemHeader)?;
        let header_line = trim_bytes(&body[offset..line_end]);
        if header_line.is_empty() {
            offset = line_end + 1;
            continue;
        }

        let item_type = item_type(header_line)?;
        let payload_len = item_length(header_line)?;
        offset = line_end + 1;

        let payload_end = if let Some(len) = payload_len {
            if offset + len > body.len() {
                return Err(EnvelopeError::LengthMismatch);
            }
            offset + len
        } else {
            next_item_offset(body, offset)
        };

        let payload = body[offset..payload_end].to_vec();
        offset = payload_end;
        // Item payloads are followed by a newline (`\n` or `\r\n`).
        if offset < body.len() && body[offset] == b'\r' {
            offset += 1;
        }
        if offset < body.len() && body[offset] == b'\n' {
            offset += 1;
        }

        match item_type.as_deref() {
            Some("event") => event_payload = Some(payload),
            Some("check_in") => {
                if let Some(ci) = parse_check_in_payload(&payload) {
                    check_ins.push(ci);
                } else {
                    has_non_error_items = true;
                }
            }
            Some("transaction")
            | Some("session")
            | Some("client_report")
            | Some("replay_event")
            | Some("statsd") => {
                has_non_error_items = true;
            }
            _ => {
                has_non_error_items = true;
            }
        }
    }

    if let Some(event_payload) = event_payload {
        Ok(ParsedEnvelope {
            event_payload,
            check_ins,
        })
    } else if !check_ins.is_empty() {
        Ok(ParsedEnvelope {
            event_payload: Vec::new(),
            check_ins,
        })
    } else if has_non_error_items {
        Err(EnvelopeError::NonErrorAbsorbed)
    } else {
        Err(EnvelopeError::NoEvent)
    }
}

fn next_line_end(body: &[u8], start: usize) -> Option<usize> {
    memchr(b'\n', &body[start..]).map(|idx| start + idx)
}

fn item_type(header_line: &[u8]) -> Result<Option<String>, EnvelopeError> {
    let value: Value =
        serde_json::from_slice(header_line).map_err(|_| EnvelopeError::MalformedItemHeader)?;
    Ok(value
        .get("type")
        .and_then(Value::as_str)
        .map(str::to_string))
}

fn item_length(header_line: &[u8]) -> Result<Option<usize>, EnvelopeError> {
    let value: Value =
        serde_json::from_slice(header_line).map_err(|_| EnvelopeError::MalformedItemHeader)?;
    Ok(value
        .get("length")
        .and_then(Value::as_u64)
        .and_then(|len| usize::try_from(len).ok()))
}

/// When `length` is omitted (common in live @sentry/* SDK envelopes), read until the next item header.
fn next_item_offset(body: &[u8], payload_start: usize) -> usize {
    let mut i = payload_start;
    while i < body.len() {
        if i > payload_start && body[i] == b'\n' {
            let line_start = i + 1;
            if line_start < body.len() && body[line_start] == b'{' {
                if let Some(line_end) = next_line_end(body, line_start) {
                    let header_line = trim_bytes(&body[line_start..line_end]);
                    if item_type(header_line).ok().flatten().is_some() {
                        return i;
                    }
                }
            }
        }
        i += 1;
    }
    body.len()
}

fn trim_bytes(bytes: &[u8]) -> &[u8] {
    let mut start = 0usize;
    let mut end = bytes.len();
    while start < end && bytes[start].is_ascii_whitespace() {
        start += 1;
    }
    while end > start && bytes[end - 1].is_ascii_whitespace() {
        end -= 1;
    }
    &bytes[start..end]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::preview_fingerprint;
    use flate2::write::{GzEncoder, ZlibEncoder};
    use flate2::Compression;
    use std::fs;
    use std::io::Write;
    use std::path::PathBuf;

    const ENVELOPE_LANGUAGES: &[&str] = &[
        "browser", "node", "go", "ruby", "php", "java", "dotnet", "python", "rust", "nextjs",
    ];

    fn fixture_path(language: &str, name: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../fixtures/sentry")
            .join(language)
            .join(name)
    }

    fn gzip_bytes(raw: &[u8]) -> Vec<u8> {
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(raw).expect("gzip write");
        encoder.finish().expect("gzip finish")
    }

    fn zlib_bytes(raw: &[u8]) -> Vec<u8> {
        let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(raw).expect("zlib write");
        encoder.finish().expect("zlib finish")
    }

    fn assert_parsed_event(language: &str, body: &[u8]) {
        let parsed =
            parse_envelope(body).unwrap_or_else(|err| panic!("parse {language} envelope: {err:?}"));
        assert!(
            parsed.event_payload.starts_with(b"{"),
            "{language} event payload should be JSON object"
        );
        serde_json::from_slice::<serde_json::Value>(&parsed.event_payload).unwrap_or_else(|err| {
            panic!("{language} event payload must be valid JSON: {err}");
        });
        assert_eq!(
            preview_fingerprint(&parsed.event_payload).len(),
            64,
            "{language} fingerprint should be sha-256 hex"
        );
    }

    #[test]
    fn parses_browser_fixture_event() {
        let body = fs::read(fixture_path("browser", "envelope.txt")).expect("browser fixture");
        assert_parsed_event("browser", &body);
    }

    #[test]
    fn parses_all_language_envelope_fixtures_raw() {
        for language in ENVELOPE_LANGUAGES {
            let body = fs::read(fixture_path(language, "envelope.txt"))
                .unwrap_or_else(|err| panic!("read {language} fixture: {err}"));
            assert!(
                body.first() == Some(&b'{'),
                "{language} fixture must be uncompressed JSON envelope"
            );
            assert_parsed_event(language, &body);
        }
    }

    #[test]
    fn parses_all_language_envelope_fixtures_gzip() {
        for language in ENVELOPE_LANGUAGES {
            let raw = fs::read(fixture_path(language, "envelope.txt"))
                .unwrap_or_else(|err| panic!("read {language} fixture: {err}"));
            let compressed = gzip_bytes(&raw);
            assert_ne!(
                compressed.first(),
                Some(&b'{'),
                "{language} gzip body must not look like JSON"
            );
            assert_parsed_event(&format!("{language}/gzip"), &compressed);
        }
    }

    #[test]
    fn parses_all_language_envelope_fixtures_zlib() {
        for language in ENVELOPE_LANGUAGES {
            let raw = fs::read(fixture_path(language, "envelope.txt"))
                .unwrap_or_else(|err| panic!("read {language} fixture: {err}"));
            let compressed = zlib_bytes(&raw);
            assert_ne!(
                compressed.first(),
                Some(&b'{'),
                "{language} zlib body must not look like JSON"
            );
            assert_parsed_event(&format!("{language}/zlib"), &compressed);
        }
    }

    #[test]
    fn parses_event_item_without_length() {
        let body = concat!(
            "{\"event_id\":\"550e8400-e29b-41d4-a716-446655440000\"}\n",
            "{\"type\":\"event\"}\n",
            "{\"level\":\"error\",\"exception\":{\"values\":[{\"type\":\"Error\",\"value\":\"boom\"}]}}\n"
        );
        let parsed = parse_envelope(body.as_bytes()).expect("parse length-less envelope");
        assert!(parsed.event_payload.starts_with(b"{\"level\":\"error\""));
    }

    #[test]
    fn parses_length_less_event_when_gzip_compressed() {
        let body = concat!(
            "{\"event_id\":\"550e8400-e29b-41d4-a716-446655440000\"}\n",
            "{\"type\":\"event\"}\n",
            "{\"level\":\"error\",\"exception\":{\"values\":[{\"type\":\"Error\",\"value\":\"boom\"}]}}\n"
        );
        let compressed = gzip_bytes(body.as_bytes());
        let parsed = parse_envelope(&compressed).expect("parse gzip length-less envelope");
        assert!(parsed.event_payload.starts_with(b"{\"level\":\"error\""));
    }

    #[test]
    fn discards_transaction_items() {
        let body = concat!(
            "{\"event_id\":\"550e8400-e29b-41d4-a716-446655440000\"}\n",
            "{\"type\":\"transaction\",\"length\":2}\n",
            "{}\n",
            "{\"type\":\"event\",\"length\":17}\n",
            "{\"level\":\"error\"}\n"
        );
        let parsed = parse_envelope(body.as_bytes()).expect("parse mixed envelope");
        assert_eq!(parsed.event_payload, br#"{"level":"error"}"#);
    }

    /// Laravel / sentry-php often prepend session or client_report items before the event.
    #[test]
    fn extracts_event_after_session_and_client_report_items() {
        let session = r#"{"sid":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","status":"ok"}"#;
        let report = r#"{"timestamp":"2026-10-01T00:00:00Z","discarded_events":[]}"#;
        let event =
            r#"{"level":"error","exception":{"values":[{"type":"Error","value":"laravel boom"}]}}"#;
        let session_header = format!(r#"{{"type":"session","length":{}}}"#, session.len());
        let report_header = format!(r#"{{"type":"client_report","length":{}}}"#, report.len());
        let event_header = format!(r#"{{"type":"event","length":{}}}"#, event.len());
        let body = format!(
            "{}\n{}\n{}\n{}\n{}\n{}\n{}\n",
            r#"{"event_id":"550e8400-e29b-41d4-a716-446655440099","sent_at":"2026-10-01T00:00:00Z"}"#,
            session_header,
            session,
            report_header,
            report,
            event_header,
            event,
        );
        let parsed = parse_envelope(body.as_bytes()).expect("parse multi-item envelope");
        assert_eq!(parsed.event_payload, event.as_bytes());

        let compressed = gzip_bytes(body.as_bytes());
        let parsed_gz =
            parse_envelope(&compressed).expect("parse gzip multi-item envelope (Laravel-like)");
        assert_eq!(parsed_gz.event_payload, event.as_bytes());
    }

    #[test]
    fn parses_crlf_separated_envelope() {
        let body = concat!(
            "{\"event_id\":\"550e8400-e29b-41d4-a716-446655440000\"}\r\n",
            "{\"type\":\"event\",\"length\":17}\r\n",
            "{\"level\":\"error\"}\r\n"
        );
        let parsed = parse_envelope(body.as_bytes()).expect("parse CRLF envelope");
        assert_eq!(parsed.event_payload, br#"{"level":"error"}"#);

        let compressed = gzip_bytes(body.as_bytes());
        let parsed_gz = parse_envelope(&compressed).expect("parse gzip CRLF envelope");
        assert_eq!(parsed_gz.event_payload, br#"{"level":"error"}"#);
    }

    #[test]
    fn extracts_event_after_binary_attachment_item() {
        // Attachment payload contains `{` and newlines that must not be treated as headers.
        let attachment = "not-json\n{\"fake\":\"header\"}\nmore-bytes";
        let event = r#"{"level":"error","exception":{"values":[{"type":"Error","value":"after attachment"}]}}"#;
        let attachment_header = format!(r#"{{"type":"attachment","length":{}}}"#, attachment.len());
        let event_header = format!(r#"{{"type":"event","length":{}}}"#, event.len());
        let body = format!(
            "{}\n{}\n{}\n{}\n{}\n",
            r#"{"event_id":"550e8400-e29b-41d4-a716-446655440088"}"#,
            attachment_header,
            attachment,
            event_header,
            event,
        );
        let parsed = parse_envelope(body.as_bytes()).expect("parse attachment+event");
        assert_eq!(parsed.event_payload, event.as_bytes());
        let parsed_gz =
            parse_envelope(&gzip_bytes(body.as_bytes())).expect("gzip attachment+event");
        assert_eq!(parsed_gz.event_payload, event.as_bytes());
    }

    #[test]
    fn rejects_empty_and_non_envelope_binary() {
        assert!(matches!(parse_envelope(b""), Err(EnvelopeError::Empty)));
        assert!(matches!(
            parse_envelope(b"\x00\x01not-an-envelope"),
            Err(EnvelopeError::MalformedItemHeader)
        ));
    }

    #[test]
    fn absorbs_session_and_transaction_only_envelopes() {
        let session = r#"{"sid":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","status":"ok"}"#;
        let session_header = format!(r#"{{"type":"session","length":{}}}"#, session.len());
        let body = format!(
            "{}\n{}\n{}\n",
            r#"{"event_id":"550e8400-e29b-41d4-a716-446655440099"}"#, session_header, session,
        );
        assert!(matches!(
            parse_envelope(body.as_bytes()),
            Err(EnvelopeError::NonErrorAbsorbed)
        ));
    }

    #[test]
    fn parses_check_in_envelope() {
        let check_in = r#"{"check_in_id":"c123","monitor_slug":"nightly-backup","status":"ok","duration":14.5,"monitor_config":{"schedule":{"type":"crontab","value":"0 0 * * *"}},"environment":"production"}"#;
        let check_in_header = format!(r#"{{"type":"check_in","length":{}}}"#, check_in.len());
        let body = format!(
            "{}\n{}\n{}\n",
            r#"{"event_id":"550e8400-e29b-41d4-a716-446655440099"}"#, check_in_header, check_in,
        );

        let parsed = parse_envelope(body.as_bytes()).expect("parse check_in envelope");
        assert_eq!(parsed.check_ins.len(), 1);
        let item = &parsed.check_ins[0];
        assert_eq!(item.monitor_slug, "nightly-backup");
        assert_eq!(item.check_in_id.as_deref(), Some("c123"));
        assert_eq!(item.status, "ok");
        assert_eq!(item.duration, Some(14.5));
        assert_eq!(item.schedule.as_deref(), Some("0 0 * * *"));
        assert_eq!(item.environment.as_deref(), Some("production"));
    }

    #[test]
    fn parses_check_in_interval_schedule_and_duration_filter() {
        let payload = br#"{"slug":"worker-heartbeat","status":"in_progress","duration":-5.0,"monitor_config":{"schedule":{"type":"interval","value":10,"unit":"minute"}}}"#;
        let item = parse_check_in_payload(payload).expect("parsed check in");
        assert_eq!(item.monitor_slug, "worker-heartbeat");
        assert_eq!(item.check_in_id, None);
        assert_eq!(item.status, "in_progress");
        assert_eq!(item.duration, None); // Negative duration rejected
        assert_eq!(item.schedule.as_deref(), Some("every 10 minute"));
    }
}
