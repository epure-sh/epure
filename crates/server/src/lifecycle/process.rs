use epure_storage::{alert_rules, alerts, issues, PgPool};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use super::{
    milestones, regression, snooze,
    velocity::{VelocityTracker, SPIKE_RATIO},
    webhooks::{dispatch_event, WebhookContext},
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
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let environment = issue_environment(issue);
    for rule in rules.iter().filter(|rule| rule.kind == kind) {
        if !alert_rules::rule_matches_environment(rule, environment) {
            continue;
        }
        if kind == "velocity_spike" {
            let Some(ratio) = velocity_ratio else {
                continue;
            };
            if !alert_rules::velocity_ratio_exceeds(rule, ratio) {
                continue;
            }
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
            dispatch_event(
                pool,
                issue.org_id,
                "custom_rule",
                &WebhookContext {
                    project_id: issue.project_id,
                    issue_id: issue.id,
                    title: Some(rule.name.clone()),
                    status: issue.status.clone(),
                    release: release.clone(),
                    event_count: issue.event_count,
                },
            )
            .await;
        }
    }
    Ok(())
}

fn issue_environment(issue: &issues::IssueLifecycleState) -> Option<&str> {
    issue.environment.as_deref()
}
