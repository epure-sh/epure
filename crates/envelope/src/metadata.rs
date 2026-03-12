use serde_json::Value;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct EventMetadata {
    pub runtime_name: Option<String>,
    pub runtime_version: Option<String>,
    pub browser_name: Option<String>,
    pub os_name: Option<String>,
    pub device_name: Option<String>,
    pub environment: Option<String>,
    pub country_code: Option<String>,
    pub user_id: Option<String>,
    pub user_email: Option<String>,
}

pub fn normalize_metadata(
    event: &Value,
    user_agent: Option<&str>,
    client_ip: Option<&str>,
    country_hint: Option<&str>,
) -> EventMetadata {
    let runtime_name = pointer_string(event, "/contexts/runtime/name")
        .or_else(|| pointer_string(event, "/runtime/name"));
    let runtime_version = pointer_string(event, "/contexts/runtime/version")
        .or_else(|| pointer_string(event, "/runtime/version"));

    let browser_name =
        pointer_string(event, "/contexts/browser/name").or_else(|| user_agent_browser(user_agent));
    let os_name = pointer_string(event, "/contexts/os/name").or_else(|| user_agent_os(user_agent));
    let device_name = pointer_string(event, "/contexts/device/name")
        .or_else(|| pointer_string(event, "/contexts/device/model"))
        .or_else(|| user_agent_device(user_agent));

    let environment = event
        .get("environment")
        .and_then(Value::as_str)
        .map(str::to_string);

    let country_code = pointer_string(event, "/user/geo/country_code")
        .or_else(|| pointer_string(event, "/request/geo/country_code"))
        .or_else(|| country_from_hint(country_hint))
        .or_else(|| country_from_ip(client_ip));

    let user_id = event
        .pointer("/user/id")
        .and_then(Value::as_str)
        .map(str::to_string);
    let user_email = event
        .pointer("/user/email")
        .and_then(Value::as_str)
        .map(str::to_string);

    EventMetadata {
        runtime_name,
        runtime_version,
        browser_name,
        os_name,
        device_name,
        environment,
        country_code,
        user_id,
        user_email,
    }
}

fn pointer_string(value: &Value, pointer: &str) -> Option<String> {
    value
        .pointer(pointer)
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn user_agent_browser(user_agent: Option<&str>) -> Option<String> {
    let ua = user_agent?;
    if ua.contains("Chrome/") && !ua.contains("Edg/") {
        Some("Chrome".to_string())
    } else if ua.contains("Firefox/") {
        Some("Firefox".to_string())
    } else if ua.contains("Safari/") && !ua.contains("Chrome/") {
        Some("Safari".to_string())
    } else if ua.contains("Edg/") {
        Some("Edge".to_string())
    } else {
        None
    }
}

fn user_agent_os(user_agent: Option<&str>) -> Option<String> {
    let ua = user_agent?;
    if ua.contains("Windows NT") {
        Some("Windows".to_string())
    } else if ua.contains("Mac OS X") {
        Some("macOS".to_string())
    } else if ua.contains("Android") {
        Some("Android".to_string())
    } else if ua.contains("iPhone") || ua.contains("iPad") {
        Some("iOS".to_string())
    } else if ua.contains("Linux") {
        Some("Linux".to_string())
    } else {
        None
    }
}

fn user_agent_device(user_agent: Option<&str>) -> Option<String> {
    let ua = user_agent?;
    if ua.contains("iPhone") {
        Some("iPhone".to_string())
    } else if ua.contains("iPad") {
        Some("iPad".to_string())
    } else if ua.contains("Android") {
        Some("Android".to_string())
    } else {
        None
    }
}

fn country_from_hint(country_hint: Option<&str>) -> Option<String> {
    country_hint
        .map(str::trim)
        .filter(|code| code.len() == 2)
        .map(|code| code.to_ascii_uppercase())
}

fn country_from_ip(client_ip: Option<&str>) -> Option<String> {
    let ip = client_ip?;
    if ip.starts_with("127.") || ip.starts_with("10.") || ip.starts_with("192.168.") || ip == "::1"
    {
        return None;
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn extracts_device_and_country_hint() {
        let event = json!({
            "environment": "production",
            "contexts": {
                "device": { "name": "iPhone 15" }
            }
        });
        let metadata = normalize_metadata(&event, None, None, Some("fr"));
        assert_eq!(metadata.device_name.as_deref(), Some("iPhone 15"));
        assert_eq!(metadata.country_code.as_deref(), Some("FR"));
        assert_eq!(metadata.environment.as_deref(), Some("production"));
    }
}
