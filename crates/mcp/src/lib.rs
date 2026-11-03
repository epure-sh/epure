pub mod runtime;
use epure_agent_context::wrap_untrusted_data;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub const MCP_PROTOCOL_VERSION: &str = "2025-11-25";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: Option<Value>,
    pub method: String,
    pub params: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i64,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

pub struct McpHandler {
    client: Client,
    base_url: String,
    token: String,
}

impl McpHandler {
    pub fn new(base_url: String, token: String) -> Self {
        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .expect("HTTP client"),
            base_url: base_url.trim_end_matches('/').to_string(),
            token,
        }
    }

    pub fn tool_definitions() -> Value {
        runtime::REGISTRY["tools"].clone()
    }

    pub async fn handle_request(&self, req: JsonRpcRequest) -> JsonRpcResponse {
        let id = req.id.clone();
        match req.method.as_str() {
            "initialize" => JsonRpcResponse {
                jsonrpc: "2.0".into(),
                id,
                result: Some(json!({
                    "protocolVersion": req.params.as_ref().and_then(|p|p["protocolVersion"].as_str()).filter(|v|["2024-11-05","2025-03-26","2025-06-18","2025-11-25"].contains(v)).unwrap_or(MCP_PROTOCOL_VERSION),
                    "instructions":runtime::REGISTRY["instructions"],
                    "capabilities": {
                        "tools": {}, "resources":{}, "prompts":{}
                    },
                    "serverInfo": {
                        "name": "epure-mcp",
                        "title":"Epure",
                        "websiteUrl":"https://epure.sh",
                        "version": env!("CARGO_PKG_VERSION")
                    }
                })),
                error: None,
            },
            "ping" => JsonRpcResponse {
                jsonrpc: "2.0".into(),
                id,
                result: Some(json!({})),
                error: None,
            },
            "resources/list" => JsonRpcResponse {
                jsonrpc: "2.0".into(),
                id,
                result: Some(
                    json!({"resources":[{"uri":"epure://guide","name":"Epure monitoring guide","mimeType":"text/plain"}]}),
                ),
                error: None,
            },
            "resources/read"
                if req
                    .params
                    .as_ref()
                    .is_some_and(|p| p["uri"] == "epure://guide") =>
            {
                JsonRpcResponse {
                    jsonrpc: "2.0".into(),
                    id,
                    result: Some(
                        json!({"contents":[{"uri":"epure://guide","mimeType":"text/plain","text":runtime::REGISTRY["instructions"]}]}),
                    ),
                    error: None,
                }
            }
            "prompts/list" => JsonRpcResponse {
                jsonrpc: "2.0".into(),
                id,
                result: Some(json!({"prompts":runtime::REGISTRY["prompts"]})),
                error: None,
            },
            "prompts/get" => {
                let name = req
                    .params
                    .as_ref()
                    .and_then(|p| p["name"].as_str())
                    .unwrap_or("");
                let prompt = runtime::REGISTRY["prompts"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .find(|p| p["name"] == name);
                JsonRpcResponse{jsonrpc:"2.0".into(),id,result:prompt.map(|p|json!({"messages":[{"role":"user","content":{"type":"text","text":p["description"]}}]})),error:if prompt.is_none(){Some(JsonRpcError{code:-32602,message:"Unknown prompt".into(),data:None})}else{None}}
            }
            "tools/list" => JsonRpcResponse {
                jsonrpc: "2.0".into(),
                id,
                result: Some(json!({
                    "tools": Self::tool_definitions()
                })),
                error: None,
            },
            "tools/call" => {
                let params = req.params.unwrap_or(Value::Null);
                let tool_name = params.get("name").and_then(Value::as_str).unwrap_or("");
                let args = params.get("arguments").cloned().unwrap_or(json!({}));

                if runtime::operation(tool_name, &args).is_some()
                    || [
                        "epure_discover",
                        "epure_api_catalog",
                        "epure_api",
                        "epure_action",
                    ]
                    .contains(&tool_name)
                {
                    return JsonRpcResponse {
                        jsonrpc: "2.0".into(),
                        id,
                        result: Some(runtime::call(self, tool_name, &args).await),
                        error: None,
                    };
                }
                match self.dispatch_tool(tool_name, args).await {
                    Ok(content) => JsonRpcResponse {
                        jsonrpc: "2.0".into(),
                        id,
                        result: Some(json!({
                            "content": [
                                {
                                    "type": "text",
                                    "text": content
                                }
                            ]
                        })),
                        error: None,
                    },
                    Err(err) => JsonRpcResponse {
                        jsonrpc: "2.0".into(),
                        id,
                        result: None,
                        error: Some(JsonRpcError {
                            code: -32603,
                            message: err,
                            data: None,
                        }),
                    },
                }
            }
            _ => JsonRpcResponse {
                jsonrpc: "2.0".into(),
                id,
                result: None,
                error: Some(JsonRpcError {
                    code: -32601,
                    message: format!("Method not found: {}", req.method),
                    data: None,
                }),
            },
        }
    }

    async fn dispatch_tool(&self, name: &str, args: Value) -> Result<String, String> {
        match name {
            "list_issues" | "list_unresolved_issues" | "epure_list_issues" => {
                self.tool_list_unresolved_issues(args).await
            }
            "get_issue_detail" | "get_crash_context" | "epure_get_issue_context" => {
                self.tool_get_crash_context(args).await
            }
            "resolve_issue" | "mark_issue_resolved" | "epure_triage_issue" => {
                self.tool_mark_issue_resolved(args).await
            }
            "unresolve_issue" => self.tool_unresolve_issue(args).await,
            "snooze_issue" => self.tool_snooze_issue(args).await,
            "unsnooze_issue" => self.tool_unsnooze_issue(args).await,
            "list_releases" => self.tool_list_releases(args).await,
            _ => Err(format!("Unknown tool: {name}")),
        }
    }

    async fn tool_list_unresolved_issues(&self, args: Value) -> Result<String, String> {
        let limit = args.get("limit").and_then(Value::as_i64).unwrap_or(10);
        let mut url = format!("{}/api/v1/agent/queue?limit={limit}", self.base_url);
        if let Some(proj) = args.get("project").and_then(Value::as_str) {
            url.push_str(&format!("&project_id={proj}"));
        }

        let res = self
            .client
            .get(&url)
            .header(AUTHORIZATION, format!("Bearer {}", self.token))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !res.status().is_success() {
            return Err(format!("Epure API returned HTTP {}", res.status()));
        }

        let body: Value = res.json().await.map_err(|e| e.to_string())?;
        let queue = body.get("queue").and_then(Value::as_array);

        let mut lines = Vec::new();
        lines.push("# Unresolved Issues".to_string());
        if let Some(items) = queue {
            if items.is_empty() {
                lines.push("No unresolved issues in queue.".into());
            }
            for item in items {
                let score = item
                    .get("priority_score")
                    .and_then(Value::as_i64)
                    .unwrap_or(0);
                if let Some(issue) = item.get("issue") {
                    let id = issue.get("id").and_then(Value::as_str).unwrap_or("?");
                    let title = issue
                        .get("title")
                        .and_then(Value::as_str)
                        .unwrap_or("Untitled");
                    let count = issue
                        .get("event_count")
                        .and_then(Value::as_i64)
                        .unwrap_or(0);
                    lines.push(format!(
                        "- [{id}] (score: {score}, events: {count}) {title}"
                    ));
                }
            }
        }
        Ok(lines.join("\n"))
    }

    async fn tool_get_crash_context(&self, args: Value) -> Result<String, String> {
        let issue_id = args
            .get("issue_id")
            .and_then(Value::as_str)
            .ok_or_else(|| "issue_id is required".to_string())?;

        let url = format!(
            "{}/api/v1/agent/issues/{issue_id}/context?format=markdown",
            self.base_url
        );

        let res = self
            .client
            .get(&url)
            .header(AUTHORIZATION, format!("Bearer {}", self.token))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !res.status().is_success() {
            return Err(format!("Epure API returned HTTP {}", res.status()));
        }

        let markdown = res.text().await.map_err(|e| e.to_string())?;
        // Wrap output in Agentjacking security tags
        Ok(wrap_untrusted_data(&markdown))
    }

    async fn tool_mark_issue_resolved(&self, args: Value) -> Result<String, String> {
        let issue_id = args
            .get("issue_id")
            .and_then(Value::as_str)
            .ok_or_else(|| "issue_id is required".to_string())?;

        let mut payload = json!({ "status": "resolved" });
        if let Some(sha) = args.get("commit_sha").and_then(Value::as_str) {
            payload["resolved_in_release"] = Value::String(sha.to_string());
        }

        let url = format!("{}/api/v1/issues/{issue_id}", self.base_url);
        let res = self
            .client
            .patch(&url)
            .header(AUTHORIZATION, format!("Bearer {}", self.token))
            .header(CONTENT_TYPE, "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !res.status().is_success() {
            return Err(format!("Epure API returned HTTP {}", res.status()));
        }

        Ok(format!("Issue {issue_id} marked as resolved."))
    }

    async fn tool_unresolve_issue(&self, args: Value) -> Result<String, String> {
        let issue_id = args
            .get("issue_id")
            .and_then(Value::as_str)
            .ok_or_else(|| "issue_id is required".to_string())?;

        let payload = json!({ "status": "unresolved" });

        let url = format!("{}/api/v1/issues/{issue_id}", self.base_url);
        let res = self
            .client
            .patch(&url)
            .header(AUTHORIZATION, format!("Bearer {}", self.token))
            .header(CONTENT_TYPE, "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !res.status().is_success() {
            return Err(format!("Epure API returned HTTP {}", res.status()));
        }

        Ok(format!("Issue {issue_id} marked as unresolved."))
    }

    async fn tool_snooze_issue(&self, args: Value) -> Result<String, String> {
        let issue_id = args
            .get("issue_id")
            .and_then(Value::as_str)
            .ok_or_else(|| "issue_id is required".to_string())?;

        let mode = args.get("mode").and_then(Value::as_str).unwrap_or("hours");
        let payload = json!({ "mode": mode });

        let url = format!("{}/api/v1/issues/{issue_id}/snooze", self.base_url);
        let res = self
            .client
            .post(&url)
            .header(AUTHORIZATION, format!("Bearer {}", self.token))
            .header(CONTENT_TYPE, "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !res.status().is_success() {
            return Err(format!("Epure API returned HTTP {}", res.status()));
        }

        Ok(format!(
            "Issue {issue_id} snoozed successfully (mode: {mode})."
        ))
    }

    async fn tool_unsnooze_issue(&self, args: Value) -> Result<String, String> {
        let issue_id = args
            .get("issue_id")
            .and_then(Value::as_str)
            .ok_or_else(|| "issue_id is required".to_string())?;

        let url = format!("{}/api/v1/issues/{issue_id}/unsnooze", self.base_url);
        let res = self
            .client
            .post(&url)
            .header(AUTHORIZATION, format!("Bearer {}", self.token))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !res.status().is_success() {
            return Err(format!("Epure API returned HTTP {}", res.status()));
        }

        Ok(format!("Issue {issue_id} unsnoozed successfully."))
    }

    async fn tool_list_releases(&self, args: Value) -> Result<String, String> {
        let project_id = args
            .get("project_id")
            .and_then(Value::as_str)
            .ok_or_else(|| "project_id is required".to_string())?;

        let url = format!("{}/api/v1/releases?project_id={project_id}", self.base_url);
        let res = self
            .client
            .get(&url)
            .header(AUTHORIZATION, format!("Bearer {}", self.token))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !res.status().is_success() {
            return Err(format!("Epure API returned HTTP {}", res.status()));
        }

        let body: Value = res.json().await.map_err(|e| e.to_string())?;
        let releases = body.get("releases").and_then(Value::as_array);

        let mut lines = Vec::new();
        lines.push(format!("# Releases for {project_id}"));
        if let Some(items) = releases {
            if items.is_empty() {
                lines.push("No releases found.".into());
            }
            for item in items {
                let version = item
                    .get("version")
                    .and_then(Value::as_str)
                    .unwrap_or("unknown");
                let count = item.get("event_count").and_then(Value::as_i64).unwrap_or(0);
                let first_seen = item
                    .get("first_seen_at")
                    .and_then(Value::as_str)
                    .unwrap_or("-");
                lines.push(format!(
                    "- [{version}] (events: {count}, first seen: {first_seen})"
                ));
            }
        }
        Ok(lines.join("\n"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn handles_initialize_request() {
        let handler = McpHandler::new("http://127.0.0.1:8080".into(), "dummy".into());
        let req = JsonRpcRequest {
            jsonrpc: "2.0".into(),
            id: Some(json!(1)),
            method: "initialize".into(),
            params: None,
        };

        let resp = handler.handle_request(req).await;
        assert_eq!(resp.jsonrpc, "2.0");
        assert_eq!(resp.id, Some(json!(1)));
        assert!(resp.error.is_none());

        let res = resp.result.unwrap();
        assert_eq!(res["protocolVersion"], MCP_PROTOCOL_VERSION);
        assert_eq!(res["serverInfo"]["name"], "epure-mcp");
    }

    #[tokio::test]
    async fn handles_tools_list_including_aliases() {
        let handler = McpHandler::new("http://127.0.0.1:8080".into(), "dummy".into());
        let req = JsonRpcRequest {
            jsonrpc: "2.0".into(),
            id: Some(json!(2)),
            method: "tools/list".into(),
            params: None,
        };

        let resp = handler.handle_request(req).await;
        assert!(resp.error.is_none());
        let tools = resp.result.unwrap()["tools"].as_array().unwrap().clone();
        let tool_names: Vec<&str> = tools.iter().filter_map(|t| t["name"].as_str()).collect();

        for name in [
            "epure_issues_list",
            "epure_issues_context",
            "epure_issues_resolve",
            "epure_channels_create",
            "epure_monitors_create",
            "epure_discover",
        ] {
            assert!(tool_names.contains(&name));
        }
    }

    #[tokio::test]
    async fn handles_unknown_method() {
        let handler = McpHandler::new("http://127.0.0.1:8080".into(), "dummy".into());
        let req = JsonRpcRequest {
            jsonrpc: "2.0".into(),
            id: Some(json!(99)),
            method: "unknown/method".into(),
            params: None,
        };

        let resp = handler.handle_request(req).await;
        assert!(resp.result.is_none());
        let err = resp.error.unwrap();
        assert_eq!(err.code, -32601);
    }
}
