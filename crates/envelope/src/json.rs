use serde_json::Value;

/// PostgreSQL JSONB cannot store U+0000 even though JSON permits it. Preserve
/// binary-parser exception messages by replacing NUL values with U+FFFD before
/// accepting the event. Reject NUL keys instead of risking key collisions.
pub fn storage_safe_json(payload: &[u8]) -> Result<Vec<u8>, &'static str> {
    let mut value: Value =
        serde_json::from_slice(payload).map_err(|_| "Event must be valid JSON")?;
    if !value.is_object() {
        return Err("Event must be a JSON object");
    }
    fn clean(value: &mut Value) -> Result<bool, &'static str> {
        let mut changed = false;
        match value {
            Value::String(s) if s.contains('\0') => {
                *s = s.replace('\0', "\u{fffd}");
                changed = true;
            }
            Value::Array(items) => {
                for item in items {
                    changed |= clean(item)?;
                }
            }
            Value::Object(items) => {
                for (key, value) in items {
                    if key.contains('\0') {
                        return Err("JSON keys cannot contain NUL characters");
                    }
                    changed |= clean(value)?;
                }
            }
            _ => {}
        }
        Ok(changed)
    }
    if clean(&mut value)? {
        serde_json::to_vec(&value).map_err(|_| "Invalid event JSON")
    } else {
        Ok(payload.to_vec())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn normalizes_values_without_corrupting_literal_escape_sequences() {
        let payload = br#"{"exception":{"value":"binary\u0000input"},"extra":["literal\\u0000"]}"#;
        let bytes = storage_safe_json(payload).unwrap();
        let value: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(value["exception"]["value"], "binary\u{fffd}input");
        assert_eq!(value["extra"][0], "literal\\u0000");
        assert!(storage_safe_json(br#"{"bad\u0000key":"value"}"#).is_err());
        assert!(storage_safe_json(b"{broken").is_err());
        assert!(storage_safe_json(b"[]").is_err());
    }
}
