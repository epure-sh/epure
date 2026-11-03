use super::*;
use std::sync::LazyLock;
pub static REGISTRY: LazyLock<Value> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../registry.json")).expect("generated MCP registry")
});
pub fn operation(name: &str, args: &Value) -> Option<Value> {
    let id = if name == "epure_action" {
        args["operation"].as_str()?
    } else {
        return REGISTRY["operations"]
            .as_array()?
            .iter()
            .find(|o| {
                format!(
                    "epure_{}",
                    o["id"].as_str().unwrap_or("").replace(['.', '-'], "_")
                ) == name
            })
            .cloned();
    };
    REGISTRY["operations"]
        .as_array()?
        .iter()
        .find(|o| o["id"].as_str() == Some(id))
        .cloned()
}
pub fn request_spec(name: &str, args: &Value) -> Result<(String, String, Value), String> {
    if name == "epure_api" {
        let method = args["method"].as_str().unwrap_or("GET").to_string();
        let path = args["path"].as_str().ok_or("path is required")?;
        if !path.starts_with("/api/v1/")
            || ["..", "?", "#", "\\", "%"].iter().any(|s| path.contains(s))
        {
            return Err("Use an exact API path from epure_api_catalog".into());
        }
        if !REGISTRY["catalog"]
            .as_array()
            .unwrap()
            .iter()
            .any(|o| o["method"] == method && path_matches(o["path"].as_str().unwrap_or(""), path))
        {
            return Err("Unknown or excluded API operation".into());
        }
        if (method == "DELETE"
            || [
                "erase",
                "strip-identifiers",
                "rotate-secret",
                "revoke",
                "rotate",
                "merge",
                "split",
            ]
            .contains(&path.rsplit('/').next().unwrap_or("")))
            && args["confirm"] != true
        {
            return Err("Destructive action requires confirm=true".into());
        }
        let values = if method == "GET" {
            args.get("query")
        } else {
            args.get("body")
        }
        .cloned()
        .unwrap_or(json!({}));
        return Ok((method, path.into(), values));
    }
    let op = operation(name, args).ok_or("Unknown tool or operation")?;
    let mut values = if name == "epure_action" {
        args["arguments"].clone()
    } else {
        args.clone()
    };
    if op["destructive"] == true {
        if args["confirm"] != true {
            return Err("Destructive action requires confirm=true".into());
        }
        if name != "epure_action" {
            values
                .as_object_mut()
                .ok_or("arguments must be an object")?
                .remove("confirm");
        }
    }
    validate(&op["inputSchema"], &values)?;
    if op["id"] == "channels.create"
        && values.get("project_id").is_none()
        && values["project_ids"]
            .as_array()
            .is_none_or(|a| a.is_empty())
    {
        return Err("Provide project_id or non-empty project_ids".into());
    }
    let mut url = reqwest::Url::parse("https://epure.invalid").unwrap();
    {
        let mut segments = url.path_segments_mut().unwrap();
        segments.clear();
        for part in op["path"].as_str().unwrap().split('/').skip(1) {
            if part.starts_with('{') && part.ends_with('}') {
                let key = &part[1..part.len() - 1];
                let value = values
                    .as_object_mut()
                    .unwrap()
                    .remove(key)
                    .ok_or("Missing resource identifier")?;
                segments.push(value.as_str().ok_or("Resource ID must be a string")?);
            } else {
                segments.push(part);
            }
        }
    }
    if op["id"] == "issues.list" && values.get("limit").is_none() {
        values["limit"] = json!(20);
    }
    if op["id"] == "issues.context" && values.get("format").is_none() {
        values["format"] = json!("json");
    }
    if let Some(fixed) = op["fixed"].as_object() {
        for (k, v) in fixed {
            values[k] = v.clone();
        }
    }
    Ok((
        op["method"].as_str().unwrap().into(),
        url.path().into(),
        values,
    ))
}
fn path_matches(template: &str, path: &str) -> bool {
    let a: Vec<_> = template.split('/').collect();
    let b: Vec<_> = path.split('/').collect();
    a.len() == b.len()
        && a.iter()
            .zip(b)
            .all(|(x, y)| *x == y || (x.starts_with('{') && x.ends_with('}') && !y.is_empty()))
}
fn validate(schema: &Value, value: &Value) -> Result<(), String> {
    let invalid = || {
        Err(
            "Arguments do not match the tool schema; use epure_discover with include_schema=true"
                .to_string(),
        )
    };
    if schema["enum"]
        .as_array()
        .is_some_and(|items| !items.contains(value))
    {
        return invalid();
    }
    match schema["type"].as_str() {
        Some("object") => {
            let Some(obj) = value.as_object() else {
                return invalid();
            };
            if schema["required"].as_array().is_some_and(|items| {
                items
                    .iter()
                    .any(|k| !obj.contains_key(k.as_str().unwrap_or("")))
            }) {
                return invalid();
            }
            for (k, v) in obj {
                if let Some(s) = schema["properties"].get(k) {
                    validate(s, v)?;
                } else if schema["additionalProperties"] == false {
                    return invalid();
                }
            }
        }
        Some("array") => {
            let Some(items) = value.as_array() else {
                return invalid();
            };
            for v in items {
                validate(&schema["items"], v)?;
            }
        }
        Some("string") if value.as_str().is_none_or(|s| s.trim().is_empty()) => return invalid(),
        Some("boolean") if !value.is_boolean() => return invalid(),
        Some("integer") if !value.is_i64() && !value.is_u64() => return invalid(),
        Some("number") if !value.is_number() => return invalid(),
        _ => {}
    }
    if let Some(number) = value.as_f64() {
        if schema["minimum"].as_f64().is_some_and(|min| number < min)
            || schema["maximum"].as_f64().is_some_and(|max| number > max)
        {
            return invalid();
        }
    }
    Ok(())
}
pub fn result(data: Value, error: bool) -> Value {
    let object = if data.is_object() {
        data
    } else {
        json!({"data":data})
    };
    let serialized = object.to_string();
    if serialized.len() > 65536 {
        return json!({"isError":true,"content":[{"type":"text","text":"Response exceeds 64 KiB. Narrow the project, search, time window or list limit; fetch a selected issue's context."}],"structuredContent":{"error":{"code":"RESPONSE_TOO_LARGE","message":"Narrow the query before retrying."}}});
    }
    json!({"content":[{"type":"text","text":serialized}],"structuredContent":object,"isError":error})
}
pub async fn call(handler: &McpHandler, name: &str, args: &Value) -> Value {
    if name == "epure_discover" || name == "epure_api_catalog" {
        let words: Vec<String> = args["search"]
            .as_str()
            .unwrap_or("")
            .split_whitespace()
            .map(str::to_lowercase)
            .collect();
        let source = REGISTRY[if name == "epure_discover" {
            "operations"
        } else {
            "catalog"
        }]
        .as_array()
        .unwrap();
        let mut found: Vec<_> = source
            .iter()
            .filter(|o| {
                args["resource"].as_str().is_none_or(|r| {
                    o["resource"] == r
                        || o["path"].as_str().unwrap_or("").contains(&format!("/{r}"))
                })
            })
            .map(|o| {
                let text = o.to_string().to_lowercase();
                let score = words.iter().filter(|w| text.contains(w.as_str())).count();
                (score, o)
            })
            .filter(|(score, _)| words.is_empty() || *score > 0)
            .collect();
        found.sort_by_key(|(score, o)| (std::cmp::Reverse(*score), o["id"].as_str().unwrap_or("")));
        let offset = args["offset"].as_u64().unwrap_or(0) as usize;
        let limit = args["limit"].as_u64().unwrap_or(20).clamp(1, 50) as usize;
        let items:Vec<Value>=found.iter().skip(offset).take(limit).map(|(_,o)|if name=="epure_api_catalog"{(*o).clone()}else{let id=o["id"].as_str().unwrap();let mut v=json!({"id":id,"tool":format!("epure_{}",id.replace(['.','-'],"_")),"description":o["description"],"method":o["method"],"resource":o["resource"]});if args["include_schema"]==true{v["inputSchema"]=REGISTRY["tools"].as_array().unwrap().iter().find(|t|t["name"]==v["tool"]).unwrap()["inputSchema"].clone();}v}).collect();
        let key = if name == "epure_discover" {
            "operations"
        } else {
            "routes"
        };
        let mut data = json!({"total":found.len(),"next_offset":if offset+limit<found.len(){Some(offset+limit)}else{None}});
        data[key] = json!(items);
        return result(data, false);
    }
    let (method, path, values) = match request_spec(name, args) {
        Ok(v) => v,
        Err(message) => {
            return result(
                json!({"error":{"code":"INVALID_ARGUMENT","message":message}}),
                true,
            )
        }
    };
    let mut request = handler
        .client
        .request(
            reqwest::Method::from_bytes(method.as_bytes()).unwrap(),
            format!("{}{path}", handler.base_url),
        )
        .bearer_auth(&handler.token)
        .header("accept", "application/json");
    if method == "GET" {
        let query: Vec<_> = values
            .as_object()
            .unwrap()
            .iter()
            .map(|(k, v)| {
                (
                    k.clone(),
                    v.as_str()
                        .map(str::to_string)
                        .unwrap_or_else(|| v.to_string()),
                )
            })
            .collect();
        request = request.query(&query);
    } else {
        request = request.json(&values);
    }
    match request.send().await {
        Ok(reply) => {
            let status = reply.status();
            let data = reply.json::<Value>().await.unwrap_or(Value::Null);
            if !status.is_success() {
                return result(
                    json!({"error":{"code":format!("HTTP_{}",status.as_u16()),"message":"Epure rejected this request. Check the resource ID, scope and workspace role.","status":status.as_u16()}}),
                    true,
                );
            }
            result(data, false)
        }
        Err(_) => result(
            json!({"error":{"code":"NETWORK_ERROR","message":"Request failed. Check connectivity before retrying a write."}}),
            true,
        ),
    }
}
