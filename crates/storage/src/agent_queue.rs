use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::alerts::{self, AlertListFilter, AlertRow};
use crate::issues::{self, IssueListFilter, IssueSummary, TimeWindow};

pub const AGENT_QUEUE_MAX: i64 = 50;
pub const AGENT_QUEUE_DEFAULT: i64 = 20;

#[derive(Debug, Clone, serde::Serialize)]
pub struct QueuedIssue {
    pub issue: IssueSummary,
    pub priority_score: i32,
    pub reasons: Vec<String>,
}

pub struct AgentQueueParams {
    pub project_id: Option<Uuid>,
    pub environment: Option<String>,
    pub query_filter: IssueListFilter,
    pub limit: i64,
    pub user_id: Uuid,
}

pub async fn build_agent_queue(
    pool: &PgPool,
    org_id: Uuid,
    params: AgentQueueParams,
) -> Result<Vec<QueuedIssue>, sqlx::Error> {
    let mut filter = params.query_filter;
    filter.project_id = params.project_id.or(filter.project_id);
    if let Some(environment) = &params.environment {
        filter.environment = Some(environment.clone());
    }
    if filter.status.is_none() && filter.snoozed != Some(true) {
        // Default: actionable issues (not ignored-only); snooze excluded via list filter when status set.
    }
    if filter.limit.is_none() {
        filter.limit = Some(AGENT_QUEUE_MAX);
    }

    let issues = issues::list_issues_filtered(pool, org_id, filter).await?;
    let alerts = alerts::list_alerts(
        pool,
        alerts::ListAlertsParams {
            org_id,
            user_id: params.user_id,
            limit: 200,
            offset: 0,
            project_id: params.project_id,
            environment: params.environment.as_deref(),
            filter: AlertListFilter::Unread,
        },
    )
    .await?;

    let alert_by_issue = alert_index(&alerts);
    let now = Utc::now();

    let mut scored: Vec<QueuedIssue> = issues
        .into_iter()
        .filter(|issue| issue.status != "ignored")
        .map(|issue| score_issue(issue, &alert_by_issue, &now))
        .collect();

    scored.sort_by(|a, b| {
        b.priority_score
            .cmp(&a.priority_score)
            .then_with(|| b.issue.last_seen_at.cmp(&a.issue.last_seen_at))
    });

    let limit = params.limit.clamp(1, AGENT_QUEUE_MAX);
    scored.truncate(limit as usize);
    Ok(scored)
}

fn alert_index(alerts: &[AlertRow]) -> std::collections::HashMap<Uuid, Vec<&AlertRow>> {
    let mut map: std::collections::HashMap<Uuid, Vec<&AlertRow>> = std::collections::HashMap::new();
    for alert in alerts {
        if let Some(issue_id) = alert.issue_id {
            map.entry(issue_id).or_default().push(alert);
        }
    }
    map
}

fn score_issue(
    issue: IssueSummary,
    alerts: &std::collections::HashMap<Uuid, Vec<&AlertRow>>,
    now: &DateTime<Utc>,
) -> QueuedIssue {
    let assessed = if issue.priority_pattern.is_none() && issue.priority_score == 0 {
        Some(crate::issue_state::assess_priority(
            &crate::issue_state::PrioritySignals {
                level: issue.level.as_deref(),
                unhandled: issue.is_unhandled,
                status: &issue.status,
                event_count: issue.event_count,
                user_count: issue.unique_user_count,
                environment: issue.environment.as_deref(),
                environment_count: 1,
                first_seen: issue.first_seen_at,
                last_seen: issue.last_seen_at,
                regressed_count: issue.regressed_count,
                hourly_counts: &[],
                now: *now,
            },
        ))
    } else {
        None
    };

    let mut score = assessed
        .as_ref()
        .map(|value| value.score)
        .unwrap_or(issue.priority_score);
    let mut reasons = Vec::new();
    let pattern = assessed
        .as_ref()
        .map(|value| value.pattern)
        .or(issue.priority_pattern.as_deref());
    if let Some(pattern) = pattern {
        reasons.push(pattern_reason(pattern));
    }
    if issue.is_unhandled {
        reasons.push("unhandled".into());
    }
    if issue.unique_user_count >= 2 {
        reasons.push(format!("{} users affected", issue.unique_user_count));
    }
    if let Some(rows) = alerts.get(&issue.id) {
        if let Some(alert) = rows.first() {
            score = (score + 8).min(100);
            reasons.push(format!("{} alert", alert.kind));
        }
    }
    if reasons.is_empty() {
        reasons.push(issue.priority.clone());
    }

    QueuedIssue {
        issue,
        priority_score: score,
        reasons,
    }
}

fn pattern_reason(pattern: &str) -> String {
    match pattern {
        "spike" => "spiking this hour".to_string(),
        "ramp" => "rising over the last hours".to_string(),
        "regression" => "regressed after a fix".to_string(),
        "spread" => "seen in more than one environment".to_string(),
        "new" => "new unhandled crash in production".to_string(),
        "steady" => "steady volume".to_string(),
        "noise" => "single-user noise".to_string(),
        "stale" => "not seen recently".to_string(),
        _ => "trickle".to_string(),
    }
}

pub fn default_queue_filter(window: TimeWindow) -> IssueListFilter {
    IssueListFilter {
        status: None,
        snoozed: None,
        time_window: Some(window),
        limit: Some(AGENT_QUEUE_MAX),
        ..Default::default()
    }
}
