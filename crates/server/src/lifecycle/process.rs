use epure_storage::{alert_rules, alerts, issues, PgPool};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use super::{
    milestones, regression, snooze,
    velocity::{VelocityTracker, SPIKE_RATIO},
    webhooks::{dispatch_event, dispatch_event_to_webhooks, WebhookContext},
};

pub async fn after_issue_event(
    pool: &PgPool,
    velocity_tracker: &Arc<VelocityTracker>,
    prior: Option<issues::IssueLifecycleState>,
    org_id: Uuid,
    issue_id: Uuid,
    incoming_release: Option<String>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if issues::wake_issue_if_expired(pool, org_id, issue_id)
        .await
        .is_err()
    {
        tracing::warn!("wake_issue_if_expired failed");
    }

    let issue = issues::get_issue_by_id(pool, org_id, issue_id)
        .await?
        .ok_or("issue missing after upsert")?;

    let is_new = prior.is_none();
    let snoozed = snooze::is_snoozed(&issue);
    let custom_rules = alert_rules::list_enabled_for_project_ingest(pool, org_id, issue.project_id)
        .await
        .unwrap_or_default();

    if !is_new && regression::should_mark_regression(&issue, incoming_release.as_deref()) {
        issues::mark_regression(pool, org_id, issue_id).await?;
        let issue = issues::get_issue_by_id(pool, org_id, issue_id)
            .await?
            .ok_or("issue missing after regression")?;

        if !snoozed {
            emit_built_in_alert(
                pool,
                &issue,
                "regression",
                json!({
                    "title": issue.title,
                    "release": incoming_release,
                    "resolved_in_release": issue.resolved_in_release,
                }),
                Some("regression"),
                incoming_release.clone(),
            )
            .await?;
            emit_custom_matches(
                pool,
                &issue,
                &custom_rules,
                "regression",
                incoming_release.clone(),
                None,
                false,
            )
            .await?;
        }
    } else if is_new && !snoozed {
        emit_built_in_alert(
            pool,
            &issue,
            "new_issue",
            json!({
                "title": issue.title,
                "release": incoming_release,
            }),
            Some("issue_created"),
            incoming_release.clone(),
        )
        .await?;
        emit_custom_matches(
            pool,
            &issue,
            &custom_rules,
            "issue_created",
            incoming_release.clone(),
            None,
            true,
        )
        .await?;
    }

    if let Some(prior_state) = prior {
        let issue = issues::get_issue_by_id(pool, org_id, issue_id)
            .await?
            .ok_or("issue missing after milestone check")?;

        if !snooze::is_snoozed(&issue) {
            if let Some(threshold) =
                milestones::crossed_event_milestone(prior_state.event_count, issue.event_count)
            {
                emit_built_in_alert(
                    pool,
                    &issue,
                    "event_milestone",
                    json!({
                        "title": issue.title,
                        "threshold": threshold,
                        "event_count": issue.event_count,
                    }),
                    None,
                    incoming_release.clone(),
                )
                .await?;
            }
        }
    }

    if let Some(snap) = velocity_tracker.snapshot(issue_id) {
        let issue = issues::get_issue_by_id(pool, org_id, issue_id)
            .await?
            .ok_or("issue missing after velocity check")?;

        if !snooze::is_snoozed(&issue) {
            if snap.ratio > SPIKE_RATIO {
                emit_built_in_alert(
                    pool,
                    &issue,
                    "velocity_spike",
                    json!({
                        "title": issue.title,
                        "current_window": snap.current_window,
                        "previous_window": snap.previous_window,
                        "ratio": snap.ratio,
                    }),
                    Some("velocity_spike"),
                    incoming_release.clone(),
                )
                .await?;
            }
            emit_custom_matches(
                pool,
                &issue,
                &custom_rules,
                "velocity_spike",
                incoming_release.clone(),
                Some(snap.ratio),
                false,
            )
            .await?;
        }
    }

    Ok(())
}

pub async fn after_unique_user_recorded(
    pool: &PgPool,
    org_id: Uuid,
    issue_id: Uuid,
    prior_user_count: i32,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if issues::wake_issue_if_expired(pool, org_id, issue_id)
        .await
        .is_err()
    {
        tracing::warn!("wake_issue_if_expired failed");
    }

    let issue = issues::get_issue_by_id(pool, org_id, issue_id)
        .await?
        .ok_or("issue missing after unique user record")?;

    if snooze::is_snoozed(&issue) {
        return Ok(());
    }

    if let Some(threshold) =
        milestones::crossed_user_milestone(prior_user_count, issue.unique_user_count)
    {
        emit_built_in_alert(
            pool,
            &issue,
            "users_affected",
            json!({
                "title": issue.title,
                "threshold": threshold,
                "unique_user_count": issue.unique_user_count,
            }),
            None,
            None,
        )
        .await?;
    }

    Ok(())
}

async fn emit_built_in_alert(
    pool: &PgPool,
    issue: &issues::IssueLifecycleState,
    kind: &str,
    payload_json: serde_json::Value,
    webhook_event: Option<&'static str>,
    release: Option<String>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let inserted = alerts::insert_alert_unless_suppressed(
        pool,
        alerts::InsertAlertParams {
            org_id: issue.org_id,
            project_id: issue.project_id,
            issue_id: Some(issue.id),
            kind: kind.to_string(),
            payload_json,
        },
    )
    .await?;

    if inserted.is_some() {
        if kind == "regression" || kind == "velocity_spike" {
            super::resend::dispatch_alert_email(
                pool,
                issue.org_id,
                issue,
                kind,
                release.as_deref(),
            )
            .await;
        }

        if let Some(event) = webhook_event {
            dispatch_event(
                pool,
                issue.org_id,
                event,
                &WebhookContext {
                    project_id: issue.project_id,
                    issue_id: issue.id,
                    title: issue.title.clone(),
                    status: issue.status.clone(),
                    release,
                    event_count: issue.event_count,
                },
            )
            .await;
        }
    }

    Ok(())
}

async fn emit_custom_matches(
    pool: &PgPool,
    issue: &issues::IssueLifecycleState,
    rules: &[alert_rules::AlertRuleRow],
    kind: &str,
    release: Option<String>,
    velocity_ratio: Option<f64>,
    is_new_fingerprint: bool,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let environment = issue_environment(issue);
    for rule in rules
        .iter()
        .filter(|rule| alert_rules::sentence_listens(rule, kind))
    {
        if !alert_rules::rule_matches_environment(rule, environment) {
            continue;
        }
        if !alert_rules::rule_matches_filters(rule, is_new_fingerprint, issue.level.as_deref()) {
            continue;
        }
        if !rule.triggers.is_empty()
            && !alert_rules::sentence_matches(
                rule,
                &alert_rules::SentenceContext {
                    event: kind,
                    is_new: is_new_fingerprint,
                    level: issue.level.as_deref(),
                    environment: issue.environment.as_deref(),
                    title: issue.title.as_deref(),
                    release: issue.release.as_deref(),
                    platform: issue.platform.as_deref(),
                    culprit: issue.culprit.as_deref(),
                    exception_type: issue.exception_type.as_deref(),
                    priority: issue.priority.as_deref(),
                    unhandled: issue.is_unhandled,
                    event_count: issue.event_count,
                    user_count: issue.unique_user_count,
                    regressed_count: issue.regressed_count,
                    status: Some(issue.status.as_str()),
                },
            )
        {
            continue;
        }
        // Sentence rules compare their own count. The ratio gate is for legacy spike rows.
        if kind == "velocity_spike" && rule.triggers.is_empty() {
            let Some(ratio) = velocity_ratio else {
                continue;
            };
            if !alert_rules::velocity_ratio_exceeds(rule, ratio) {
                continue;
            }
        }

        if alert_rules::rule_in_cooldown(
            pool,
            issue.org_id,
            issue.project_id,
            rule.id,
            Some(issue.id),
            rule.cooldown_mins,
        )
        .await
        .unwrap_or(false)
        {
            continue;
        }

        let inserted = alerts::insert_alert_unless_suppressed(
            pool,
            alerts::InsertAlertParams {
                org_id: issue.org_id,
                project_id: issue.project_id,
                issue_id: Some(issue.id),
                kind: "custom".to_string(),
                payload_json: json!({
                    "title": issue.title,
                    "rule_id": rule.id,
                    "rule_name": rule.name,
                    "rule_kind": rule.kind,
                    "environment": rule.environment,
                    "threshold": rule.threshold,
                    "ratio": velocity_ratio,
                    "release": release,
                }),
            },
        )
        .await?;

        if inserted.is_some() {
            let ctx = WebhookContext {
                project_id: issue.project_id,
                issue_id: issue.id,
                title: Some(rule.name.clone()),
                status: issue.status.clone(),
                release: release.clone(),
                event_count: issue.event_count,
            };
            if rule.channel_ids.is_empty() {
                dispatch_event(pool, issue.org_id, "custom_rule", &ctx).await;
            } else {
                let channels =
                    alert_rules::get_channels_by_ids_ingest(pool, issue.org_id, &rule.channel_ids)
                        .await
                        .unwrap_or_default();
                let webhook_ids: Vec<Uuid> = channels
                    .iter()
                    .filter_map(|ch| alert_rules::channel_webhook_id(&ch.config.0))
                    .collect();
                dispatch_event_to_webhooks(pool, issue.org_id, "custom_rule", &ctx, &webhook_ids)
                    .await;

                let mut email_recipients: Vec<String> = Vec::new();
                for channel in channels.iter().filter(|ch| ch.provider == "email") {
                    for email in alert_rules::channel_email_recipients(&channel.config.0) {
                        if !email_recipients
                            .iter()
                            .any(|existing| existing.eq_ignore_ascii_case(&email))
                        {
                            email_recipients.push(email);
                        }
                    }
                }
                if !email_recipients.is_empty() {
                    let title = issue.title.clone().unwrap_or_else(|| rule.name.clone());
                    let subject = format!("[Epure Alert] {}", rule.name);
                    let html = format!(
                        "<p><strong>{}</strong></p><p>Rule <em>{}</em> matched on this issue.</p>",
                        title.replace('<', "&lt;"),
                        rule.name.replace('<', "&lt;")
                    );
                    let text = format!("Epure alert: {} — rule {}", title, rule.name);
                    let _ = super::resend::send_resend_email(email_recipients, subject, html, text)
                        .await;
                }

                let title = issue.title.clone().unwrap_or_else(|| rule.name.clone());
                let telegram_text = format!(
                    "Epure alert: {title}\nRule: {}\nEvents: {}",
                    rule.name, issue.event_count
                );
                for channel in channels.iter().filter(|ch| ch.provider == "telegram") {
                    if let Some((bot_token, chat_id)) =
                        alert_rules::channel_telegram_credentials(&channel.config.0)
                    {
                        let _ = super::telegram::send_telegram_message(
                            &bot_token,
                            &chat_id,
                            &telegram_text,
                        )
                        .await;
                    }
                }
            }
        }
    }
    Ok(())
}

fn issue_environment(issue: &issues::IssueLifecycleState) -> Option<&str> {
    issue.environment.as_deref()
}
