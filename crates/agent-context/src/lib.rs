//! Sanitized fix context for agents — parity with `web/src/features/issues/export-markdown.ts`.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use uuid::Uuid;

const BREADCRUMB_LIMIT: usize = 8;
const APP_STACK_LIMIT: usize = 12;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssueSnapshot {
    pub id: Uuid,
    pub title: Option<String>,
    pub status: String,
    pub level: Option<String>,
    pub event_count: i64,
    pub unique_user_count: i32,
    pub environment: Option<String>,
    pub release: Option<String>,
    pub first_seen_at: Option<DateTime<Utc>>,
    pub last_seen_at: Option<DateTime<Utc>>,
    pub resolved_in_release: Option<String>,
    pub snoozed: bool,
    pub snooze_until: Option<DateTime<Utc>>,
    pub snooze_until_count: Option<i32>,
    pub snooze_until_users: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventSnapshot {
    pub id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub environment: Option<String>,
    pub release: Option<String>,
    pub platform: Option<String>,
    pub runtime_name: Option<String>,
    pub runtime_version: Option<String>,
    pub browser_name: Option<String>,
    pub os_name: Option<String>,
    pub user_id: Option<String>,
    pub user_email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StackFrame {
    pub filename: Option<String>,
    pub function: Option<String>,
    pub lineno: Option<i64>,
    pub colno: Option<i64>,
    pub context_line: Option<String>,
    pub pre_context: Option<Vec<String>>,
    pub post_context: Option<Vec<String>>,
    pub in_app: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentContextJson {
    pub issue: IssueSnapshot,
    pub event: Option<EventSnapshot>,
    pub exception_text: String,
    pub culprit: Option<StackFrame>,
    pub user_journey: String,
    pub request: Option<String>,
    pub lifecycle_notes: Vec<String>,
    pub app_stack: Vec<StackFrame>,
    pub breadcrumbs: Vec<String>,
    pub runtime_tags: String,
    pub custom_tags: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload_json: Option<Value>,
}

#[derive(Debug, Clone, Copy)]
pub struct RenderOptions {
    pub include_payload: bool,
    pub include_user: bool,
}

impl Default for RenderOptions {
    fn default() -> Self {
        Self {
            include_payload: false,
            include_user: false,
        }
    }
}

pub fn build_context(
    issue: IssueSnapshot,
    event: Option<(EventSnapshot, Value, Option<Value>, Option<Value>)>,
    options: RenderOptions,
) -> AgentContextJson {
    let (event_snap, payload, stack_raw, crumbs_raw) = match event {
        Some((snap, payload, stack, crumbs)) => (Some(snap), payload, stack, crumbs),
        None => (None, Value::Object(Default::default()), None, None),
    };

    let frames = as_stack_frames(stack_raw.as_ref());
    let breadcrumbs = as_breadcrumbs(crumbs_raw.as_ref());
    let exception_text = exception_summary(&payload);
    let lifecycle_notes = issue_lifecycle_notes(&issue);
    let culprit = find_culprit_frame(&frames);
    let journey = infer_user_journey(&breadcrumbs, &exception_text);
    let request = request_context(&payload);
    let app_stack: Vec<StackFrame> = frames
        .iter()
        .filter(|f| !is_vendor_frame(f))
        .take(APP_STACK_LIMIT)
        .cloned()
        .collect();
    let breadcrumb_lines: Vec<String> = breadcrumbs
        .iter()
        .rev()
        .take(BREADCRUMB_LIMIT)
        .rev()
        .enumerate()
        .map(|(i, c)| format_breadcrumb(c, i))
        .collect();

    let mut event_out = event_snap;
    if let Some(ref mut ev) = event_out {
        if !options.include_user {
            if ev.user_email.is_some() {
                ev.user_email = ev.user_email.as_ref().map(|email| hash_user_email(email));
            }
            if ev.user_id.is_some() {
                ev.user_id = ev.user_id.as_ref().map(|id| hash_user_email(id));
            }
        }
    }

    let runtime = runtime_tags(event_out.as_ref());

    AgentContextJson {
        issue,
        event: event_out,
        exception_text,
        culprit,
        user_journey: journey,
        request,
        lifecycle_notes,
        app_stack,
        breadcrumbs: breadcrumb_lines,
        runtime_tags: runtime,
        custom_tags: payload_tags(&payload),
        payload_json: if options.include_payload {
            Some(payload)
        } else {
            None
        },
    }
}

pub fn render_markdown(ctx: &AgentContextJson) -> String {
    let title = ctx
        .issue
        .title
        .clone()
        .unwrap_or_else(|| ctx.exception_text.clone());
    let culprit_section = ctx
        .culprit
        .as_ref()
        .map(format_culprit_frame)
        .unwrap_or_else(|| {
            "_No culprit frame identified — use the application stack below_".into()
        });

    let prompt = build_ai_prompt(&title, ctx, &culprit_section);
    let export = build_export_markdown(ctx);
    format!("{prompt}\n\n{export}")
}

fn build_ai_prompt(title: &str, ctx: &AgentContextJson, culprit_section: &str) -> String {
    let mut lines = vec![
        "# Fix this production exception (one-shot)".into(),
        String::new(),
        "You are a senior engineer debugging from error monitoring telemetry. Deliver a complete fix in **one response** — no clarifying questions, no exploration loops.".into(),
        String::new(),
        "## Required output (use these headings exactly)".into(),
        String::new(),
        "### Root cause".into(),
        "1–2 sentences: what failed, why, and what user action or request triggered it.".into(),
        String::new(),
        "### Culprit".into(),
        "File, function, and line. Quote the exact failing line.".into(),
        String::new(),
        "### Patch".into(),
        "Minimal unified diff or full function replacement. No drive-by refactors.".into(),
        String::new(),
        "### Regression guard".into(),
        "One test, assertion, or runtime check that would have caught this.".into(),
        String::new(),
        "## How to work".into(),
        String::new(),
        "1. Start with **Likely fault location** and **User journey** — they are pre-ranked.".into(),
        "2. Prefer **in-app frames** over vendor/node_modules frames.".into(),
        "3. Use breadcrumbs to reconstruct intent; the last HTTP/navigation/console steps matter most.".into(),
        "4. If context is incomplete, state assumptions and still propose the safest fix.".into(),
        "5. Keep the change minimal and preserve behavior outside the bug.".into(),
        String::new(),
        "## Issue snapshot".into(),
        String::new(),
        format!("- **Title:** {title}"),
        format!("- **Status:** {}", ctx.issue.status),
        format!(
            "- **Level:** {}",
            ctx.issue.level.as_deref().unwrap_or("unknown")
        ),
        format!("- **Occurrences:** {}", ctx.issue.event_count),
    ];

    if ctx.issue.unique_user_count >= 1 {
        lines.push(format!(
            "- **Users affected:** {}",
            ctx.issue.unique_user_count
        ));
    }

    lines.push(format!(
        "- **Environment:** {}",
        ctx.event
            .as_ref()
            .and_then(|e| e.environment.clone())
            .or_else(|| ctx.issue.environment.clone())
            .unwrap_or_else(|| "unknown".into())
    ));
    lines.push(format!(
        "- **Release:** {}",
        ctx.event
            .as_ref()
            .and_then(|e| e.release.clone())
            .or_else(|| ctx.issue.release.clone())
            .unwrap_or_else(|| "unknown".into())
    ));
    lines.push(format!(
        "- **First seen:** {}",
        format_iso(ctx.issue.first_seen_at)
    ));
    lines.push(format!(
        "- **Last seen:** {}",
        format_iso(
            ctx.issue
                .last_seen_at
                .or_else(|| ctx.event.as_ref().map(|e| e.occurred_at))
        )
    ));
    if let Some(ev) = &ctx.event {
        lines.push(format!(
            "- **This occurrence:** {}",
            format_iso(Some(ev.occurred_at))
        ));
    }
    if !ctx.lifecycle_notes.is_empty() {
        lines.push(format!(
            "- **Lifecycle:** {}",
            ctx.lifecycle_notes.join("; ")
        ));
    }
    if let Some(req) = &ctx.request {
        lines.push(format!("- **Request:** {req}"));
    }

    lines.extend([
        String::new(),
        "## Exception".into(),
        String::new(),
        ctx.exception_text.clone(),
        String::new(),
        "## User journey".into(),
        String::new(),
        ctx.user_journey.clone(),
        String::new(),
        "## Likely fault location (start here)".into(),
        String::new(),
        culprit_section.to_string(),
        String::new(),
        "---".into(),
        String::new(),
        "Full diagnostic export follows below.".into(),
    ]);

    lines.join("\n")
}

fn build_export_markdown(ctx: &AgentContextJson) -> String {
    let title = ctx
        .issue
        .title
        .clone()
        .unwrap_or_else(|| "Untitled issue".into());
    let vendor_count = ctx.app_stack.len(); // simplified — app_stack already filtered
    let app_count = ctx.app_stack.len();

    let mut lines = vec![
        format!("# {title}"),
        String::new(),
        format!("**Status:** {}", ctx.issue.status),
        format!(
            "**Level:** {}",
            ctx.issue.level.as_deref().unwrap_or("unknown")
        ),
        format!("**Events:** {}", ctx.issue.event_count),
    ];
    if ctx.issue.unique_user_count >= 1 {
        lines.push(format!(
            "**Users affected:** {}",
            ctx.issue.unique_user_count
        ));
    }
    lines.push(format!(
        "**First seen:** {}",
        format_iso(ctx.issue.first_seen_at)
    ));
    lines.push(format!(
        "**Last seen:** {}",
        format_iso(
            ctx.issue
                .last_seen_at
                .or_else(|| ctx.event.as_ref().map(|e| e.occurred_at))
        )
    ));
    lines.extend([
        String::new(),
        "## Exception".into(),
        ctx.exception_text.clone(),
        String::new(),
        "## Application stack (in-app frames)".into(),
        format!("_{app_count} in-app, {vendor_count} vendor frames omitted_"),
        String::new(),
        format_app_stack(&ctx.app_stack),
        String::new(),
        "## Breadcrumbs (last events before crash)".into(),
        format_breadcrumbs_list(&ctx.breadcrumbs),
        String::new(),
        "## Runtime".into(),
        ctx.runtime_tags.clone(),
        String::new(),
        "## Tags".into(),
        ctx.custom_tags.clone(),
    ]);
    if let Some(req) = &ctx.request {
        lines.push(format!("**Request context:** {req}"));
    }
    lines.join("\n")
}

fn format_app_stack(frames: &[StackFrame]) -> String {
    if frames.is_empty() {
        return "_No in-app frames — inspect vendor stack in full export below_".into();
    }
    frames
        .iter()
        .enumerate()
        .map(|(index, frame)| {
            let fn_name = frame.function.as_deref().unwrap_or("<anonymous>");
            let location = frame_location(frame);
            let source = format_source_block(frame);
            let has_context = source != "_No source context captured_";
            if has_context {
                format!(
                    "### {}. `{fn_name}` at `{location}`\n```\n{source}\n```",
                    index + 1
                )
            } else {
                format!("### {}. `{fn_name}` at `{location}`", index + 1)
            }
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn format_breadcrumbs_list(lines: &[String]) -> String {
    if lines.is_empty() {
        "_No breadcrumbs captured before the crash_".into()
    } else {
        lines.join("\n")
    }
}

fn as_stack_frames(value: Option<&Value>) -> Vec<StackFrame> {
    let Some(value) = value else {
        return Vec::new();
    };
    let arr = value.as_array().cloned().unwrap_or_default();
    arr.into_iter()
        .filter_map(|v| serde_json::from_value(v).ok())
        .collect()
}

fn as_breadcrumbs(value: Option<&Value>) -> Vec<Breadcrumb> {
    let Some(value) = value else {
        return Vec::new();
    };
    if let Some(arr) = value.as_array() {
        return arr
            .iter()
            .filter_map(|v| serde_json::from_value(v.clone()).ok())
            .collect();
    }
    value
        .get("values")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| serde_json::from_value(v.clone()).ok())
                .collect()
        })
        .unwrap_or_default()
}

#[derive(Debug, Clone, Deserialize)]
struct Breadcrumb {
    category: Option<String>,
    message: Option<String>,
    level: Option<String>,
    #[serde(rename = "type")]
    ty: Option<String>,
    data: Option<Value>,
}

fn is_vendor_frame(frame: &StackFrame) -> bool {
    if frame.in_app == Some(true) {
        return false;
    }
    if frame.in_app == Some(false) {
        return true;
    }
    let filename = frame.filename.as_deref().unwrap_or("").to_lowercase();
    if filename.contains("node_modules") {
        return true;
    }
    let looks_like_app = filename.contains("/src/")
        || filename.contains("/app/")
        || filename.contains("/lib/")
        || filename.contains("/components/")
        || filename.contains("/hooks/");
    if looks_like_app {
        return false;
    }
    filename.contains("webpack-internal://")
        || (filename.contains("webpack") && !looks_like_app)
        || (filename.contains("vite") && filename.contains("deps"))
}

fn has_source_context(frame: &StackFrame) -> bool {
    frame
        .context_line
        .as_ref()
        .is_some_and(|l| !l.trim().is_empty())
        || frame
            .pre_context
            .as_ref()
            .is_some_and(|lines| !lines.is_empty())
        || frame
            .post_context
            .as_ref()
            .is_some_and(|lines| !lines.is_empty())
}

fn find_culprit_frame(frames: &[StackFrame]) -> Option<StackFrame> {
    for frame in frames.iter().rev() {
        if !is_vendor_frame(frame) && has_source_context(frame) {
            return Some(frame.clone());
        }
    }
    for frame in frames.iter().rev() {
        if !is_vendor_frame(frame) {
            return Some(frame.clone());
        }
    }
    frames.last().cloned()
}

fn exception_summary(payload: &Value) -> String {
    if let Some(values) = payload
        .pointer("/exception/values")
        .and_then(|v| v.as_array())
    {
        if !values.is_empty() {
            return values
                .iter()
                .map(|entry| {
                    let ty = entry
                        .get("type")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Error");
                    let msg = entry.get("value").and_then(|v| v.as_str()).unwrap_or("");
                    format!("{ty}: {msg}").trim().to_string()
                })
                .collect::<Vec<_>>()
                .join(" → ");
        }
    }
    payload
        .get("message")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("Unknown exception")
        .to_string()
}

fn frame_location(frame: &StackFrame) -> String {
    format!(
        "{}:{}:{}",
        frame.filename.as_deref().unwrap_or("?"),
        frame.lineno.unwrap_or(0),
        frame.colno.unwrap_or(0)
    )
}

fn format_source_block(frame: &StackFrame) -> String {
    let mut lines: Vec<String> = Vec::new();
    for line in frame.pre_context.iter().flatten() {
        lines.push(format!("  {line}"));
    }
    if let Some(ctx) = &frame.context_line {
        lines.push(format!("> {ctx}"));
    }
    for line in frame.post_context.iter().flatten() {
        lines.push(format!("  {line}"));
    }
    if lines.is_empty() {
        "_No source context captured_".into()
    } else {
        lines.join("\n")
    }
}

fn format_culprit_frame(frame: &StackFrame) -> String {
    let fn_name = frame.function.as_deref().unwrap_or("<anonymous>");
    format!(
        "**Function:** `{fn_name}`\n**Location:** `{}`\n\n```\n{}\n```",
        frame_location(frame),
        format_source_block(frame)
    )
}

fn format_breadcrumb(crumb: &Breadcrumb, index: usize) -> String {
    let category = crumb
        .category
        .as_deref()
        .or(crumb.ty.as_deref())
        .unwrap_or("default");
    let level = crumb.level.as_deref().unwrap_or("info");
    let message = crumb.message.as_deref().unwrap_or("").trim();
    let mut data_bits = Vec::new();
    if let Some(data) = &crumb.data {
        for key in ["method", "url", "status_code", "label", "status"] {
            if let Some(value) = data.get(key) {
                let s = value.to_string();
                if !s.trim().is_empty() {
                    data_bits.push(format!("{key}={s}"));
                }
            }
        }
    }
    let suffix = if data_bits.is_empty() {
        String::new()
    } else {
        format!(" ({})", data_bits.join(", "))
    };
    format!("{}. [{category}/{level}] {message}{suffix}", index + 1)
}

fn infer_user_journey(crumbs: &[Breadcrumb], exception_text: &str) -> String {
    if crumbs.is_empty() {
        return format!("The app crashed with: {exception_text}");
    }
    let recent: Vec<_> = crumbs.iter().rev().take(BREADCRUMB_LIMIT).rev().collect();
    let steps: Vec<String> = recent
        .iter()
        .filter_map(|crumb| {
            let category = crumb
                .category
                .as_deref()
                .or(crumb.ty.as_deref())
                .unwrap_or("event");
            let message = crumb.message.as_deref()?.trim();
            if message.is_empty() {
                return None;
            }
            if category.contains("navigation") {
                let dest = message
                    .strip_prefix("Navigated to ")
                    .or_else(|| message.strip_prefix("navigated to "))
                    .unwrap_or(message);
                Some(format!("navigated to {dest}"))
            } else if category.contains("click") || category == "ui" {
                Some(format!("clicked {message}"))
            } else if category.contains("fetch") || category.contains("http") || category == "xhr" {
                let method = crumb
                    .data
                    .as_ref()
                    .and_then(|d| d.get("method"))
                    .map(|v| v.to_string())
                    .unwrap_or_else(|| "HTTP".into());
                let url = crumb
                    .data
                    .as_ref()
                    .and_then(|d| d.get("url"))
                    .map(|v| v.to_string())
                    .unwrap_or_else(|| message.to_string());
                let status = crumb.data.as_ref().and_then(|d| d.get("status_code"));
                Some(if status.is_some() {
                    format!("{method} {url} → {}", status.unwrap())
                } else {
                    format!("{method} {url}")
                })
            } else if category.contains("console") {
                Some(format!("console: {message}"))
            } else {
                Some(format!("{category}: {message}"))
            }
        })
        .collect();
    if steps.is_empty() {
        format!("The app crashed with: {exception_text}")
    } else {
        format!(
            "User flow before crash: {} → **{exception_text}**",
            steps.join(" → ")
        )
    }
}

fn runtime_tags(event: Option<&EventSnapshot>) -> String {
    let Some(event) = event else {
        return "_No runtime tags_".into();
    };
    let mut tags = Vec::new();
    if let Some(v) = &event.platform {
        tags.push(format!("platform={v}"));
    }
    if let Some(v) = &event.runtime_name {
        tags.push(format!("runtime={v}"));
    }
    if let Some(v) = &event.runtime_version {
        tags.push(format!("runtime_version={v}"));
    }
    if let Some(v) = &event.browser_name {
        tags.push(format!("browser={v}"));
    }
    if let Some(v) = &event.os_name {
        tags.push(format!("os={v}"));
    }
    if let Some(v) = &event.environment {
        tags.push(format!("env={v}"));
    }
    if let Some(v) = &event.release {
        tags.push(format!("release={v}"));
    }
    if let Some(v) = &event.user_id {
        tags.push(format!("user_id={v}"));
    }
    if let Some(v) = &event.user_email {
        tags.push(format!("user_email={v}"));
    }
    if tags.is_empty() {
        "_No runtime tags_".into()
    } else {
        tags.join(", ")
    }
}

fn payload_tags(payload: &Value) -> String {
    let Some(tags) = payload.get("tags").and_then(|v| v.as_object()) else {
        return "_No custom tags_".into();
    };
    if tags.is_empty() {
        return "_No custom tags_".into();
    }
    tags.iter()
        .map(|(k, v)| format!("{k}={v}"))
        .collect::<Vec<_>>()
        .join(", ")
}

fn request_context(payload: &Value) -> Option<String> {
    let mut bits = Vec::new();
    if let Some(tx) = payload.get("transaction").and_then(|v| v.as_str()) {
        bits.push(format!("transaction={tx}"));
    }
    if let Some(req) = payload.get("request").and_then(|v| v.as_object()) {
        if let Some(url) = req.get("url") {
            bits.push(format!("url={url}"));
        }
        if let Some(method) = req.get("method") {
            bits.push(format!("method={method}"));
        }
    }
    if bits.is_empty() {
        None
    } else {
        Some(bits.join(", "))
    }
}

fn issue_lifecycle_notes(issue: &IssueSnapshot) -> Vec<String> {
    let mut notes = Vec::new();
    if issue.status == "regression" {
        if let Some(rel) = &issue.resolved_in_release {
            notes.push(format!(
                "Regression: previously resolved in `{rel}`, now firing again"
            ));
        }
    } else if let Some(rel) = &issue.resolved_in_release {
        notes.push(format!("Resolved in release `{rel}`"));
    }
    if issue.snoozed {
        let mut parts = vec!["Snoozed".to_string()];
        if let Some(until) = issue.snooze_until {
            parts.push(format!("until {}", format_iso(Some(until))));
        }
        if let Some(count) = issue.snooze_until_count {
            parts.push(format!("or {count} more events"));
        }
        if let Some(users) = issue.snooze_until_users {
            parts.push(format!("or {users} more users"));
        }
        notes.push(parts.join(" "));
    }
    notes
}

fn format_iso(value: Option<DateTime<Utc>>) -> String {
    value
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_else(|| "unknown".into())
}

fn hash_user_email(email: &str) -> String {
    let digest = Sha256::digest(email.as_bytes());
    format!("u_{}", hex::encode(&digest[..4]))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exception_summary_from_message() {
        let payload = serde_json::json!({ "message": "boom" });
        assert_eq!(exception_summary(&payload), "boom");
    }

    #[test]
    fn redacts_user_fields_by_default() {
        let issue = IssueSnapshot {
            id: Uuid::new_v4(),
            title: Some("t".into()),
            status: "unresolved".into(),
            level: None,
            event_count: 1,
            unique_user_count: 1,
            environment: None,
            release: None,
            first_seen_at: None,
            last_seen_at: None,
            resolved_in_release: None,
            snoozed: false,
            snooze_until: None,
            snooze_until_count: None,
            snooze_until_users: None,
        };
        let event = EventSnapshot {
            id: Uuid::new_v4(),
            occurred_at: Utc::now(),
            environment: None,
            release: None,
            platform: None,
            runtime_name: None,
            runtime_version: None,
            browser_name: None,
            os_name: None,
            user_id: Some("user-42".into()),
            user_email: Some("a@b.co".into()),
        };
        let ctx = build_context(
            issue,
            Some((event, Value::Object(Default::default()), None, None)),
            RenderOptions::default(),
        );
        let ev = ctx.event.expect("event");
        assert!(ev.user_email.as_deref().unwrap().starts_with("u_"));
        assert!(ev.user_id.as_deref().unwrap().starts_with("u_"));
        assert_ne!(ev.user_email.as_deref(), Some("a@b.co"));
    }

    #[test]
    fn vendor_frame_detection() {
        let frame = StackFrame {
            filename: Some("webpack:///./node_modules/foo.js".into()),
            in_app: None,
            function: None,
            lineno: None,
            colno: None,
            context_line: None,
            pre_context: None,
            post_context: None,
        };
        assert!(is_vendor_frame(&frame));
    }
}
