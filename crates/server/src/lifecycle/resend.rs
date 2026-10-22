use epure_storage::{issues, PgPool};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use uuid::Uuid;

pub const DEFAULT_RESEND_FROM: &str = "Epure Alerts <alerts@alert.epure.sh>";
pub const RESEND_API_URL: &str = "https://api.resend.com/emails";

pub fn resend_api_key() -> Option<String> {
    std::env::var("RESEND_API_KEY")
        .ok()
        .filter(|s| !s.trim().is_empty())
}

pub fn resend_from_email() -> String {
    std::env::var("RESEND_FROM_EMAIL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_RESEND_FROM.to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResendEmailPayload {
    pub from: String,
    pub to: Vec<String>,
    pub subject: String,
    pub html: String,
    pub text: String,
}

#[derive(Debug, Deserialize)]
pub struct ResendSuccessResponse {
    pub id: String,
}

/// Send an email directly using Resend's REST API (`POST https://api.resend.com/emails`).
pub async fn send_resend_email(
    to: Vec<String>,
    subject: String,
    html: String,
    text: String,
) -> Result<String, String> {
    if to.is_empty() {
        return Err("No recipients specified".to_string());
    }

    let Some(api_key) = resend_api_key() else {
        return Err("RESEND_API_KEY environment variable is not configured".to_string());
    };
    let from = resend_from_email();

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("failed to build reqwest client: {e}"))?;

    let payload = ResendEmailPayload {
        from,
        to,
        subject,
        html,
        text,
    };

    let response = client
        .post(RESEND_API_URL)
        .bearer_auth(&api_key)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("HTTP request to Resend failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Resend API returned status {status}: {body}"));
    }

    let result: ResendSuccessResponse = response
        .json()
        .await
        .map_err(|e| format!("failed to deserialize Resend response: {e}"))?;

    Ok(result.id)
}

/// Format subject line for alert email
pub fn format_alert_subject(kind: &str, title: &str, release: Option<&str>) -> String {
    match kind {
        "regression" => {
            if let Some(rel) = release {
                format!("[Regression] {title} (reopened in {rel})")
            } else {
                format!("[Regression] {title} (reopened)")
            }
        }
        "velocity_spike" => format!("[Spike Alert] High error spike on: {title}"),
        "critical" => format!("[Critical Alert] {title}"),
        _ => format!("[Epure Alert] {kind}: {title}"),
    }
}

/// Build HTML email content for an alert
#[allow(clippy::too_many_arguments)]
pub fn build_alert_html(
    kind: &str,
    title: &str,
    issue_id: Uuid,
    project_id: Uuid,
    event_count: i64,
    user_count: i32,
    release: Option<&str>,
    environment: Option<&str>,
    dashboard_url: &str,
) -> String {
    let badge_color = match kind {
        "regression" => "#e11d48",     // rose-600
        "velocity_spike" => "#d97706", // amber-600
        _ => "#4f46e5",                // indigo-600
    };

    let badge_text = match kind {
        "regression" => "ISSUE REGRESSION",
        "velocity_spike" => "VELOCITY SPIKE",
        "critical" => "CRITICAL EVENT",
        _ => "ALERT NOTIFICATION",
    };

    let release_label = release.unwrap_or("unknown");
    let env_label = environment.unwrap_or("production");
    let issue_url = format!("{dashboard_url}/p/{project_id}/issues?q=id:{issue_id}");

    format!(
        r##"<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Epure Alert</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0d0e; color: #f4f4f5; margin: 0; padding: 24px; }}
    .container {{ max-width: 580px; margin: 0 auto; background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; overflow: hidden; }}
    .header {{ padding: 20px 24px; border-bottom: 1px solid #27272a; display: flex; align-items: center; justify-content: space-between; }}
    .brand {{ font-size: 15px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em; }}
    .content {{ padding: 28px 24px; }}
    .badge {{ display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #ffffff; background-color: {badge_color}; padding: 4px 10px; border-radius: 9999px; margin-bottom: 16px; }}
    .title {{ font-size: 18px; font-weight: 600; line-height: 1.4; color: #ffffff; margin: 0 0 16px 0; }}
    .meta-table {{ width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }}
    .meta-table td {{ padding: 8px 12px; border: 1px solid #27272a; }}
    .meta-table td.label {{ color: #a1a1aa; width: 140px; background-color: #121215; }}
    .meta-table td.value {{ color: #e4e4e7; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }}
    .btn {{ display: inline-block; background-color: #ffffff; color: #09090b; font-size: 13px; font-weight: 600; text-decoration: none; padding: 10px 20px; border-radius: 6px; }}
    .footer {{ padding: 16px 24px; background-color: #121215; border-top: 1px solid #27272a; font-size: 12px; color: #71717a; text-align: center; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="brand">EPURE // ALERTS</span>
    </div>
    <div class="content">
      <span class="badge">{badge_text}</span>
      <h1 class="title">{title}</h1>
      <table class="meta-table">
        <tr>
          <td class="label">Status</td>
          <td class="value">{kind}</td>
        </tr>
        <tr>
          <td class="label">Release</td>
          <td class="value">{release_label}</td>
        </tr>
        <tr>
          <td class="label">Environment</td>
          <td class="value">{env_label}</td>
        </tr>
        <tr>
          <td class="label">Total Events</td>
          <td class="value">{event_count}</td>
        </tr>
        <tr>
          <td class="label">Unique Users</td>
          <td class="value">{user_count}</td>
        </tr>
      </table>
      <a href="{issue_url}" class="btn" target="_blank">Investigate Issue &rarr;</a>
    </div>
    <div class="footer">
      Sent via Resend from alert.epure.sh &bull; Epure Autonomous Error Ingestion & Triage
    </div>
  </div>
</body>
</html>"##
    )
}

/// Build plaintext email content for an alert
#[allow(clippy::too_many_arguments)]
pub fn build_alert_text(
    kind: &str,
    title: &str,
    issue_id: Uuid,
    project_id: Uuid,
    event_count: i64,
    release: Option<&str>,
    environment: Option<&str>,
    dashboard_url: &str,
) -> String {
    let issue_url = format!("{dashboard_url}/p/{project_id}/issues?q=id:{issue_id}");
    format!(
        "EPURE ALERT: [{kind}]\n\n\
         Issue: {title}\n\
         Release: {rel}\n\
         Environment: {env}\n\
         Total Events: {event_count}\n\n\
         View in dashboard: {issue_url}\n\n\
         --\n\
         Sent from alert.epure.sh via Resend",
        kind = kind.to_uppercase(),
        title = title,
        rel = release.unwrap_or("unknown"),
        env = environment.unwrap_or("production"),
        event_count = event_count,
        issue_url = issue_url,
    )
}

/// Dispatch alert email according to project settings (defaults to org members).
pub async fn dispatch_alert_email(
    pool: &PgPool,
    org_id: Uuid,
    issue: &issues::IssueLifecycleState,
    kind: &str,
    release: Option<&str>,
) {
    // Only dispatch for regressions or critical spikes
    if kind != "regression" && kind != "velocity_spike" && kind != "critical" {
        return;
    }

    // Check project-specific email alert settings
    let settings = sqlx::query_as::<_, (bool, Option<Vec<String>>, bool, bool)>(
        "SELECT email_alerts_enabled, email_alert_recipients, email_alert_on_regression, email_alert_on_spike FROM ingest_get_project_email_alert_settings($1, $2)",
    )
    .bind(issue.project_id)
    .bind(org_id)
    .fetch_optional(pool)
    .await;

    let (enabled, custom_recipients, on_regression, on_spike) = match settings {
        Ok(Some((enabled, rec, on_reg, on_spk))) => (enabled, rec, on_reg, on_spk),
        _ => (true, None, true, true),
    };

    if !enabled {
        tracing::debug!(
            "Email alerts disabled for project {}; skipping",
            issue.project_id
        );
        return;
    }

    if kind == "regression" && !on_regression {
        tracing::debug!(
            "Regression email alerts disabled for project {}; skipping",
            issue.project_id
        );
        return;
    }

    if kind == "velocity_spike" && !on_spike {
        tracing::debug!(
            "Spike email alerts disabled for project {}; skipping",
            issue.project_id
        );
        return;
    }

    let recipients: Vec<String> = if let Some(custom) = custom_recipients.filter(|c| !c.is_empty())
    {
        custom
    } else {
        match sqlx::query_scalar::<_, String>("SELECT email FROM ingest_get_org_member_emails($1)")
            .bind(org_id)
            .fetch_all(pool)
            .await
        {
            Ok(emails) => emails,
            Err(err) => {
                tracing::warn!("Failed to query organization member emails for alert: {err}");
                return;
            }
        }
    };

    if recipients.is_empty() {
        tracing::debug!("No recipients found for alert in org {org_id}; skipping email");
        return;
    }

    let public_url = epure_storage::epure_public_url();
    let issue_title = issue
        .title
        .clone()
        .unwrap_or_else(|| "Untitled issue".to_string());
    let subject = format_alert_subject(kind, &issue_title, release);
    let html = build_alert_html(
        kind,
        &issue_title,
        issue.id,
        issue.project_id,
        issue.event_count,
        issue.unique_user_count,
        release,
        issue.environment.as_deref(),
        &public_url,
    );
    let text = build_alert_text(
        kind,
        &issue_title,
        issue.id,
        issue.project_id,
        issue.event_count,
        release,
        issue.environment.as_deref(),
        &public_url,
    );

    // Asynchronous non-blocking dispatch via tokio::spawn
    tokio::spawn(async move {
        match send_resend_email(recipients.clone(), subject, html, text).await {
            Ok(id) => {
                tracing::info!(
                    "Dispatched Resend email alert {id} to {} recipients for org {org_id}",
                    recipients.len()
                );
            }
            Err(err) => {
                tracing::warn!("Failed to dispatch Resend email alert: {err}");
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_alert_subject_regression() {
        let subject = format_alert_subject("regression", "NullPointerException", Some("v2.1.0"));
        assert_eq!(
            subject,
            "[Regression] NullPointerException (reopened in v2.1.0)"
        );

        let subject_no_rel = format_alert_subject("regression", "NullPointerException", None);
        assert_eq!(
            subject_no_rel,
            "[Regression] NullPointerException (reopened)"
        );
    }

    #[test]
    fn test_format_alert_subject_spike() {
        let subject = format_alert_subject("velocity_spike", "DB timeout", None);
        assert_eq!(subject, "[Spike Alert] High error spike on: DB timeout");
    }

    #[test]
    fn test_build_alert_html() {
        let html = build_alert_html(
            "regression",
            "ZeroDivisionError",
            Uuid::nil(),
            Uuid::nil(),
            42,
            5,
            Some("v1.0.0"),
            Some("production"),
            "https://app.epure.sh",
        );
        assert!(html.contains("ISSUE REGRESSION"));
        assert!(html.contains("ZeroDivisionError"));
        assert!(html.contains("alert.epure.sh"));
        assert!(html.contains("https://app.epure.sh/p/"));
    }

    #[test]
    fn test_default_config() {
        assert_eq!(DEFAULT_RESEND_FROM, "Epure Alerts <alerts@alert.epure.sh>");
        assert_eq!(resend_from_email(), DEFAULT_RESEND_FROM);
    }
}
