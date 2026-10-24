use epure_agent_context::wrap_untrusted_data;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub const MCP_PROTOCOL_VERSION: &str = "2024-11-05";

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
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            token,
        }
    }

    pub fn tool_definitions() -> Value {
        json!([
            {
                "name": "list_issues",
                "description": "List top unresolved production issues ranked by priority score",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "project": { "type": "string", "description": "Project ID or slug" },
                        "limit": { "type": "integer", "description": "Max issues to return (default 10)", "default": 10 }
                    }
                }
            },
            {
                "name": "list_unresolved_issues",
                "description": "Alias for list_issues: list top unresolved production issues ranked by priority score",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "project": { "type": "string", "description": "Project ID or slug" },
                        "limit": { "type": "integer", "description": "Max issues to return (default 10)", "default": 10 }
                    }
                }
            },
            {
                "name": "epure_list_issues",
                "description": "Alias for list_issues: list unresolved production issues ranked by priority score",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "project": { "type": "string", "description": "Project ID or slug" },
                        "limit": { "type": "integer", "description": "Max issues to return (default 10)", "default": 10 }
                    }
                }
            },
            {
                "name": "get_issue_detail",
                "description": "Get detailed crash context, stack frames, breadcrumbs, and suspect code for an issue",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "issue_id": { "type": "string", "description": "Issue UUID" }
                    },
                    "required": ["issue_id"]
                }
            },
            {
                "name": "get_crash_context",
                "description": "Alias for get_issue_detail: get sanitized stack frames, source lines, and crumbs for an issue",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "issue_id": { "type": "string", "description": "Issue UUID" }
                    },
                    "required": ["issue_id"]
                }
            },
            {
                "name": "epure_get_issue_context",
                "description": "Alias for get_issue_detail: get sanitized stack frames and context for an issue",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "issue_id": { "type": "string", "description": "Issue UUID" }
                    },
                    "required": ["issue_id"]
                }
            },
            {
                "name": "resolve_issue",
                "description": "Mark an issue as resolved with optional commit SHA",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "issue_id": { "type": "string", "description": "Issue UUID" },
                        "commit_sha": { "type": "string", "description": "Optional Git commit hash" }
                    },
                    "required": ["issue_id"]
                }
            },
            {
                "name": "mark_issue_resolved",
                "description": "Alias for resolve_issue: mark an issue as resolved with optional commit SHA",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "issue_id": { "type": "string", "description": "Issue UUID" },
                        "commit_sha": { "type": "string", "description": "Optional Git commit hash" }
                    },
                    "required": ["issue_id"]
                }
            },
            {
                "name": "epure_triage_issue",
                "description": "Alias for resolve_issue: mark an issue as resolved with optional commit SHA",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "issue_id": { "type": "string", "description": "Issue UUID" },
                        "commit_sha": { "type": "string", "description": "Optional Git commit hash" }
                    },
                    "required": ["issue_id"]
                }
            },
            {
                "name": "unresolve_issue",
                "description": "Mark a previously resolved or ignored issue back as unresolved",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "issue_id": { "type": "string", "description": "Issue UUID" }
                    },
                    "required": ["issue_id"]
                }
            },
            {
                "name": "snooze_issue",
                "description": "Temporarily snooze/mute an issue until a deadline or occurrence/user threshold",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "issue_id": { "type": "string", "description": "Issue UUID" },
                        "mode": { "type": "string", "description": "Snooze duration mode: 'hours', 'occurrences', 'users' (default 'hours')" }
                    },
                    "required": ["issue_id"]
                }
            },
            {
                "name": "unsnooze_issue",
                "description": "Unsnooze/unmute a previously snoozed issue and restore active alerting",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "issue_id": { "type": "string", "description": "Issue UUID" }
                    },
                    "required": ["issue_id"]
                }
            },
            {
                "name": "list_releases",
                "description": "List deployment releases and tracking metadata for a project",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "project_id": { "type": "string", "description": "Project ID or slug" }
                    },
                    "required": ["project_id"]
                }
            }
        ])
    }

    pub async fn handle_request(&self, req: JsonRpcRequest) -> JsonRpcResponse {
        let id = req.id.clone();
        match req.method.as_str() {
            "initialize" => JsonRpcResponse {
                jsonrpc: "2.0".into(),
                id,
                result: Some(json!({
                    "protocolVersion": MCP_PROTOCOL_VERSION,
                    "capabilities": {
                        "tools": {}
                    },
                    "serverInfo": {
                        "name": "epure-mcp",
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

        Ok(format!("Issue {issue_id} snoozed successfully (mode: {mode})."))
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
                let version = item.get("version").and_then(Value::as_str).unwrap_or("unknown");
                let count = item.get("event_count").and_then(Value::as_i64).unwrap_or(0);
                let first_seen = item.get("first_seen_at").and_then(Value::as_str).unwrap_or("-");
                lines.push(format!("- [{version}] (events: {count}, first seen: {first_seen})"));
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

        assert!(tool_names.contains(&"list_issues"));
        assert!(tool_names.contains(&"list_unresolved_issues"));
        assert!(tool_names.contains(&"epure_list_issues"));
        assert!(tool_names.contains(&"get_issue_detail"));
        assert!(tool_names.contains(&"get_crash_context"));
        assert!(tool_names.contains(&"epure_get_issue_context"));
        assert!(tool_names.contains(&"resolve_issue"));
        assert!(tool_names.contains(&"mark_issue_resolved"));
        assert!(tool_names.contains(&"epure_triage_issue"));
        assert!(tool_names.contains(&"unresolve_issue"));
        assert!(tool_names.contains(&"snooze_issue"));
        assert!(tool_names.contains(&"unsnooze_issue"));
        assert!(tool_names.contains(&"list_releases"));
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
