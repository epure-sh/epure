use memchr::memchr;
use serde_json::Value;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum EnvelopeError {
    #[error("envelope body is empty")]
    Empty,
    #[error("malformed envelope item header")]
    MalformedItemHeader,
    #[error("no event item found in envelope")]
    NoEvent,
    #[error("envelope item length mismatch")]
    LengthMismatch,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedEnvelope {
    pub event_payload: Vec<u8>,
}

/// Zero-copy scan of a Sentry envelope; discards transaction items.
pub fn parse_envelope(body: &[u8]) -> Result<ParsedEnvelope, EnvelopeError> {
    if body.is_empty() {
        return Err(EnvelopeError::Empty);
    }

    let mut offset = next_line_end(body, 0).map(|end| end + 1).unwrap_or(body.len());
    let mut event_payload = None;

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

        if offset + payload_len > body.len() {
            return Err(EnvelopeError::LengthMismatch);
        }

        let payload = body[offset..offset + payload_len].to_vec();
        offset += payload_len;
        if offset < body.len() && body[offset] == b'\n' {
            offset += 1;
        }

        match item_type.as_deref() {
            Some("event") => event_payload = Some(payload),
            Some("transaction") => {}
            _ => {}
        }
    }

    event_payload
        .map(|event_payload| ParsedEnvelope { event_payload })
        .ok_or(EnvelopeError::NoEvent)
}

fn next_line_end(body: &[u8], start: usize) -> Option<usize> {
    memchr(b'\n', &body[start..]).map(|idx| start + idx)
}

fn item_type(header_line: &[u8]) -> Result<Option<String>, EnvelopeError> {
    let value: Value = serde_json::from_slice(header_line).map_err(|_| EnvelopeError::MalformedItemHeader)?;
    Ok(value
        .get("type")
        .and_then(Value::as_str)
        .map(str::to_string))
}

fn item_length(header_line: &[u8]) -> Result<usize, EnvelopeError> {
    let value: Value = serde_json::from_slice(header_line).map_err(|_| EnvelopeError::MalformedItemHeader)?;
    value
        .get("length")
        .and_then(Value::as_u64)
        .and_then(|len| usize::try_from(len).ok())
        .ok_or(EnvelopeError::MalformedItemHeader)
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
    use std::fs;
    use std::path::PathBuf;

    fn fixture_path(language: &str, name: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../fixtures/sentry")
            .join(language)
            .join(name)
    }

    #[test]
    fn parses_browser_fixture_event() {
        let body = fs::read(fixture_path("browser", "envelope.txt")).expect("browser fixture");
        let parsed = parse_envelope(&body).expect("parse browser envelope");
        assert!(parsed.event_payload.starts_with(b"{"));
        assert_eq!(preview_fingerprint(&parsed.event_payload).len(), 64);
    }

    #[test]
    fn parses_node_fixture_event() {
        let body = fs::read(fixture_path("node", "envelope.txt")).expect("node fixture");
        let parsed = parse_envelope(&body).expect("parse node envelope");
        assert!(parsed.event_payload.starts_with(b"{"));
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
}
