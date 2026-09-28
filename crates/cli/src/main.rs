use std::io::{self, Write};
use std::process::ExitCode;

use clap::{Parser, Subcommand};
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use reqwest::Client;
use serde_json::Value;

#[derive(Parser)]
#[command(name = "epure-cli", about = "Epure Agent API client")]
struct Cli {
    #[arg(long, env = "EPURE_URL", default_value = "http://localhost:8080")]
    url: String,
    #[arg(long, env = "EPURE_TOKEN")]
    token: Option<String>,
    #[arg(long, global = true, default_value = "json")]
    output: OutputFormat,
    #[command(subcommand)]
    command: Commands,
}

#[derive(Clone, Copy, Default, clap::ValueEnum)]
enum OutputFormat {
    #[default]
    Json,
    Table,
}

#[derive(Subcommand)]
enum Commands {
    Queue {
        #[arg(long)]
        project: Option<String>,
        #[arg(long)]
        env: Option<String>,
        #[arg(long, default_value = "20")]
        limit: i64,
        #[arg(long)]
        q: Option<String>,
    },
    Context {
        issue_id: String,
        #[arg(long, default_value = "markdown")]
        format: String,
        #[arg(long)]
        out: Option<String>,
    },
    Issue {
        #[command(subcommand)]
        command: IssueCommands,
    },
    Triage {
        #[command(subcommand)]
        command: TriageCommands,
    },
    Auth {
        #[command(subcommand)]
        command: AuthCommands,
    },
    /// Raw /api/v1 call (full product surface via PAT).
    Api {
        method: String,
        path: String,
        #[arg(long)]
        body: Option<String>,
    },
    Alerts {
        #[arg(long, default_value = "unread")]
        view: String,
        #[arg(long)]
        project: Option<String>,
        #[arg(long)]
        limit: Option<i64>,
    },
}

#[derive(Subcommand)]
enum IssueCommands {
    Show { issue_id: String },
}

#[derive(Subcommand)]
enum TriageCommands {
    Resolve {
        issue_id: String,
        #[arg(long)]
        release: Option<String>,
    },
    Ignore {
        issue_id: String,
    },
    Reopen {
        issue_id: String,
    },
    Snooze {
        issue_id: String,
        #[arg(long, default_value = "hours")]
        mode: String,
    },
}

#[derive(Subcommand)]
enum AuthCommands {
    Whoami,
}

#[tokio::main]
async fn main() -> ExitCode {
    if let Err(message) = run().await {
        eprintln!("{message}");
        return ExitCode::from(1);
    }
    ExitCode::SUCCESS
}

async fn run() -> Result<(), String> {
    let cli = Cli::parse();
    let token = cli
        .token
        .ok_or("EPURE_TOKEN is required (epure_pat_… from workspace settings)")?;
    let base = cli.url.trim_end_matches('/').to_string();
    let client = Client::new();

    match cli.command {
        Commands::Queue {
            project,
            env,
            limit,
            q,
        } => {
            let mut url = format!("{base}/api/v1/agent/queue?limit={limit}");
            if let Some(project_id) = project {
                url.push_str(&format!("&project_id={project_id}"));
            }
            if let Some(environment) = env {
                url.push_str(&format!("&environment={environment}"));
            }
            if let Some(query) = q {
                url.push_str(&format!("&q={}", urlencoding::encode(&query)));
            }
            let body = get_json(&client, &token, &url).await?;
            print_output(&cli.output, &body, print_queue_table)?;
        }
        Commands::Context {
            issue_id,
            format,
            out,
        } => {
            let url = format!("{base}/api/v1/agent/issues/{issue_id}/context?format={format}");
            if format == "markdown" {
                let text = get_text(&client, &token, &url).await?;
                if let Some(path) = out {
                    std::fs::write(&path, &text).map_err(|err| err.to_string())?;
                } else {
                    print!("{text}");
                }
            } else {
                let body = get_json(&client, &token, &url).await?;
                if let Some(path) = out {
                    std::fs::write(&path, serde_json::to_string_pretty(&body).unwrap())
                        .map_err(|err| err.to_string())?;
                } else {
                    print_output(&cli.output, &body, |_| Ok(()))?;
                }
            }
        }
        Commands::Issue { command } => match command {
            IssueCommands::Show { issue_id } => {
                let url = format!("{base}/api/v1/agent/issues/{issue_id}");
                let body = get_json(&client, &token, &url).await?;
                print_output(&cli.output, &body, |_| Ok(()))?;
            }
        },
        Commands::Triage { command } => match command {
            TriageCommands::Resolve { issue_id, release } => {
                let url = format!("{base}/api/v1/issues/{issue_id}");
                let mut payload = serde_json::json!({ "status": "resolved" });
                if let Some(rel) = release {
                    payload["resolved_in_release"] = Value::String(rel);
                }
                let body = patch_json(&client, &token, &url, &payload).await?;
                print_output(&cli.output, &body, |_| Ok(()))?;
            }
            TriageCommands::Ignore { issue_id } => {
                let url = format!("{base}/api/v1/issues/{issue_id}");
                let body = patch_json(
                    &client,
                    &token,
                    &url,
                    &serde_json::json!({ "status": "ignored" }),
                )
                .await?;
                print_output(&cli.output, &body, |_| Ok(()))?;
            }
            TriageCommands::Reopen { issue_id } => {
                let url = format!("{base}/api/v1/issues/{issue_id}");
                let body = patch_json(
                    &client,
                    &token,
                    &url,
                    &serde_json::json!({ "status": "unresolved" }),
                )
                .await?;
                print_output(&cli.output, &body, |_| Ok(()))?;
            }
            TriageCommands::Snooze { issue_id, mode } => {
                let url = format!("{base}/api/v1/issues/{issue_id}/snooze");
                let body =
                    post_json(&client, &token, &url, &serde_json::json!({ "mode": mode })).await?;
                print_output(&cli.output, &body, |_| Ok(()))?;
            }
        },
        Commands::Api { method, path, body } => {
            let path = normalize_api_path(&path)?;
            let url = format!("{base}{path}");
            let method = method.to_uppercase();
            let payload = body
                .as_deref()
                .map(|raw| serde_json::from_str(raw).map_err(|e| e.to_string()))
                .transpose()?;
            let response = api_call(&client, &token, &method, &url, payload.as_ref()).await?;
            if response.is_string() {
                println!("{response}");
            } else {
                print_output(&cli.output, &response, |_| Ok(()))?;
            }
        }
        Commands::Alerts {
            view,
            project,
            limit,
        } => {
            let mut url = format!("{base}/api/v1/alerts?view={view}");
            if let Some(project_id) = project {
                url.push_str(&format!("&project_id={project_id}"));
            }
            if let Some(n) = limit {
                url.push_str(&format!("&limit={n}"));
            }
            let body = get_json(&client, &token, &url).await?;
            print_output(&cli.output, &body, |_| Ok(()))?;
        }
        Commands::Auth { command } => match command {
            AuthCommands::Whoami => {
                let url = format!("{base}/api/v1/agent/whoami");
                let body = get_json(&client, &token, &url).await?;
                print_output(&cli.output, &body, |_| Ok(()))?;
            }
        },
    }

    Ok(())
}

async fn get_json(client: &Client, token: &str, url: &str) -> Result<Value, String> {
    let response = client
        .get(url)
        .header(AUTHORIZATION, format!("Bearer {token}"))
        .send()
        .await
        .map_err(|err| err.to_string())?;
    parse_response(response).await
}

async fn get_text(client: &Client, token: &str, url: &str) -> Result<String, String> {
    let response = client
        .get(url)
        .header(AUTHORIZATION, format!("Bearer {token}"))
        .send()
        .await
        .map_err(|err| err.to_string())?;
    if !response.status().is_success() {
        return Err(api_error(response).await);
    }
    response.text().await.map_err(|err| err.to_string())
}

async fn patch_json(
    client: &Client,
    token: &str,
    url: &str,
    body: &Value,
) -> Result<Value, String> {
    api_call(client, token, "PATCH", url, Some(body)).await
}

async fn post_json(client: &Client, token: &str, url: &str, body: &Value) -> Result<Value, String> {
    api_call(client, token, "POST", url, Some(body)).await
}

async fn api_call(
    client: &Client,
    token: &str,
    method: &str,
    url: &str,
    body: Option<&Value>,
) -> Result<Value, String> {
    let mut request = client
        .request(
            reqwest::Method::from_bytes(method.as_bytes())
                .map_err(|_| format!("invalid HTTP method: {method}"))?,
            url,
        )
        .header(AUTHORIZATION, format!("Bearer {token}"));
    if let Some(payload) = body {
        request = request
            .header(CONTENT_TYPE, "application/json")
            .json(payload);
    }
    let response = request.send().await.map_err(|err| err.to_string())?;
    parse_response(response).await
}

async fn parse_response(response: reqwest::Response) -> Result<Value, String> {
    if response.status().is_success() {
        response.json().await.map_err(|err| err.to_string())
    } else {
        Err(api_error(response).await)
    }
}

async fn api_error(response: reqwest::Response) -> String {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if let Ok(json) = serde_json::from_str::<Value>(&body) {
        if let Some(error) = json.get("error").and_then(|v| v.as_str()) {
            return format!("HTTP {status}: {error}");
        }
    }
    format!("HTTP {status}: {body}")
}

fn print_output(
    format: &OutputFormat,
    body: &Value,
    table: impl FnOnce(&Value) -> Result<(), String>,
) -> Result<(), String> {
    match format {
        OutputFormat::Json => {
            println!("{}", serde_json::to_string_pretty(body).unwrap());
        }
        OutputFormat::Table => {
            table(body)?;
        }
    }
    Ok(())
}

fn normalize_api_path(path: &str) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() || trimmed.len() > 4096 {
        return Err("path length invalid".into());
    }
    if trimmed.contains("://") || trimmed.starts_with("//") {
        return Err("path must be relative to EPURE_URL, not an absolute URL".into());
    }
    if trimmed.contains("..") || trimmed.contains('\\') {
        return Err("path must not contain traversal segments".into());
    }
    let mut normalized = trimmed.to_string();
    if !normalized.starts_with('/') {
        normalized = format!("/{normalized}");
    }
    if !normalized.starts_with("/api/v1/") {
        if normalized.starts_with("/api/v1") {
            if normalized.len() == 7 {
                return Err("path must start with /api/v1/".into());
            }
        } else if normalized.starts_with('/') && !normalized.starts_with("/api/") {
            normalized = format!("/api/v1{normalized}");
        } else if !normalized.starts_with("/api/") {
            normalized = format!("/api/v1/{normalized}");
        } else {
            return Err("path must start with /api/v1/".into());
        }
    }
    if normalized.starts_with("/api/v1/auth") {
        return Err("auth routes cannot be called via epure-cli api".into());
    }
    Ok(normalized)
}

fn print_queue_table(body: &Value) -> Result<(), String> {
    let Some(queue) = body.get("queue").and_then(|v| v.as_array()) else {
        return Err("unexpected queue response".into());
    };
    if queue.is_empty() {
        println!("No issues in queue.");
        return Ok(());
    }
    for row in queue {
        let score = row
            .get("priority_score")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        let issue = row.get("issue").ok_or("missing issue")?;
        let id = issue.get("id").and_then(|v| v.as_str()).unwrap_or("?");
        let title = issue
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Untitled");
        let status = issue.get("status").and_then(|v| v.as_str()).unwrap_or("?");
        let reasons = row
            .get("reasons")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            })
            .unwrap_or_default();
        println!("{score:4}  [{status}]  {title}  ({id})");
        if !reasons.is_empty() {
            println!("       {reasons}");
        }
    }
    io::stdout().flush().ok();
    Ok(())
}
