use serde_json::{json, Value};

#[derive(Debug, Clone, PartialEq)]
pub struct Breadcrumb {
    pub category: Option<String>,
    pub timestamp: Option<f64>,
    pub level: Option<String>,
    pub message: Option<String>,
    pub data: Option<Value>,
}

/// Extract breadcrumb trail from a Sentry event payload.
pub fn extract_breadcrumbs(event: &Value) -> Vec<Breadcrumb> {
    let values = event
        .pointer("/breadcrumbs/values")
        .and_then(Value::as_array)
        .cloned()
        .or_else(|| event.get("breadcrumbs").and_then(Value::as_array).cloned())
        .unwrap_or_default();

    values
        .into_iter()
        .filter_map(|entry| {
            if !entry.is_object() {
                return None;
            }
            Some(Breadcrumb {
                category: entry
                    .get("category")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                timestamp: entry.get("timestamp").and_then(Value::as_f64),
                level: entry
                    .get("level")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                message: entry
                    .get("message")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                data: entry.get("data").cloned(),
            })
        })
        .collect()
}

pub fn breadcrumbs_to_json(breadcrumbs: &[Breadcrumb]) -> Value {
    Value::Array(
        breadcrumbs
            .iter()
            .map(|crumb| {
                json!({
                    "category": crumb.category,
                    "timestamp": crumb.timestamp,
                    "level": crumb.level,
                    "message": crumb.message,
                    "data": crumb.data,
                })
            })
            .collect(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn extracts_breadcrumb_values() {
        let event = json!({
            "breadcrumbs": {
                "values": [
                    {
                        "category": "console",
                        "timestamp": 1_700_000_000.0,
                        "level": "info",
                        "message": "clicked"
                    }
                ]
            }
        });
        let crumbs = extract_breadcrumbs(&event);
        assert_eq!(crumbs.len(), 1);
        assert_eq!(crumbs[0].category.as_deref(), Some("console"));
        assert_eq!(crumbs[0].message.as_deref(), Some("clicked"));
    }
}
