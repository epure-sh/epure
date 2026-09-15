use epure_storage::{alerts, issues, PgPool};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use super::{
    milestones,
    regression,
    snooze,
    velocity::VelocityTracker,
    webhooks::{dispatch_event, WebhookContext},
};

pub async fn after_issue_event(
    pool: &PgPool,
    velocity_tracker: &Arc<VelocityTracker>,
    prior: Option<issues::IssueLifecycleState>,
    issue_id: Uuid,
    incoming_release: Option<String>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let issue = issues::get_issue_by_id(pool, issue_id)
        .await?
        .ok_or("issue missing after upsert")?;

    let is_new = prior.is_none();
    let snoozed = snooze::is_snoozed(&issue);

    if !is_new && regression::should_mark_regression(&issue, incoming_release.as_deref()) {
        issues::mark_regression(pool, issue_id).await?;
        let issue = issues::get_issue_by_id(pool, issue_id)
            .await?
            .ok_or("issue missing after regression")?;

        if !snoozed {
            alerts::insert_alert(
                pool,
                alerts::InsertAlertParams {
                    org_id: issue.org_id,
                    project_id: issue.project_id,
                    issue_id: Some(issue.id),
                    kind: "regression".to_string(),
                    payload_json: json!({
                        "title": issue.title,
                        "release": incoming_release,
                        "resolved_in_release": issue.resolved_in_release,
                    }),
                },
            )
            .await?;

            dispatch_event(
                pool,
                "regression",
                &WebhookContext {
                    project_id: issue.project_id,
                    issue_id: issue.id,
                    title: issue.title.clone(),
                    status: issue.status.clone(),
                    release: incoming_release.clone(),
                    event_count: issue.event_count,
                },
            )
            .await;
        }
    } else if is_new && !snoozed {
        alerts::insert_alert(
            pool,
            alerts::InsertAlertParams {
                org_id: issue.org_id,
                project_id: issue.project_id,
                issue_id: Some(issue.id),
                kind: "new_issue".to_string(),
                payload_json: json!({
                    "title": issue.title,
                    "release": incoming_release,
                }),
            },
        )
        .await?;

        dispatch_event(
            pool,
            "issue_created",
            &WebhookContext {
                project_id: issue.project_id,
                issue_id: issue.id,
                title: issue.title.clone(),
                status: issue.status.clone(),
                release: incoming_release.clone(),
                event_count: issue.event_count,
            },
        )
        .await;
    }

    if let Some(prior_state) = prior {
        let issue = issues::get_issue_by_id(pool, issue_id)
            .await?
            .ok_or("issue missing after milestone check")?;

        if !snooze::is_snoozed(&issue) {
            if let Some(threshold) =
                milestones::crossed_event_milestone(prior_state.event_count, issue.event_count)
            {
                alerts::insert_alert(
                    pool,
                    alerts::InsertAlertParams {
                        org_id: issue.org_id,
                        project_id: issue.project_id,
                        issue_id: Some(issue.id),
                        kind: "event_milestone".to_string(),
                        payload_json: json!({
                            "title": issue.title,
                            "threshold": threshold,
                            "event_count": issue.event_count,
                        }),
                    },
                )
                .await?;
            }
        }
    }

    if let Some(spike) = velocity_tracker.record(issue_id) {
        let issue = issues::get_issue_by_id(pool, issue_id)
            .await?
            .ok_or("issue missing after velocity check")?;

        if !snooze::is_snoozed(&issue) {
            alerts::insert_alert(
                pool,
                alerts::InsertAlertParams {
                    org_id: issue.org_id,
                    project_id: issue.project_id,
                    issue_id: Some(issue.id),
                    kind: "velocity_spike".to_string(),
                    payload_json: json!({
                        "title": issue.title,
                        "current_window": spike.current_window,
                        "previous_window": spike.previous_window,
                        "ratio": spike.ratio,
                    }),
                },
            )
            .await?;
        }
    }

    Ok(())
}

pub async fn after_unique_user_recorded(
    pool: &PgPool,
    issue_id: Uuid,
    prior_user_count: i32,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let issue = issues::get_issue_by_id(pool, issue_id)
        .await?
        .ok_or("issue missing after unique user record")?;

    if snooze::is_snoozed(&issue) {
        return Ok(());
    }

    if let Some(threshold) =
        milestones::crossed_user_milestone(prior_user_count, issue.unique_user_count)
    {
        alerts::insert_alert(
            pool,
            alerts::InsertAlertParams {
                org_id: issue.org_id,
                project_id: issue.project_id,
                issue_id: Some(issue.id),
                kind: "users_affected".to_string(),
                payload_json: json!({
                    "title": issue.title,
                    "threshold": threshold,
                    "unique_user_count": issue.unique_user_count,
                }),
            },
        )
        .await?;
    }

    Ok(())
}
