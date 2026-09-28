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
        org_id,
        params.user_id,
        200,
        params.project_id,
        params.environment.as_deref(),
        AlertListFilter::Unread,
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
    let mut score = 0i32;
    let mut reasons = Vec::new();

    if issue.status == "regression" {
        score += 1000;
        reasons.push("regression".into());
    }

    if let Some(rows) = alerts.get(&issue.id) {
        for alert in rows {
            score += 500;
            reasons.push(format!("{} alert", alert.kind));
            break;
        }
    }

    match issue.level.as_deref() {
        Some("fatal") => {
            score += 200;
            reasons.push("fatal level".into());
        }
        Some("error") => score += 100,
        _ => {}
    }

    let event_boost = issue.event_count.clamp(0, 300) as i32;
    if event_boost > 0 {
        score += event_boost;
        if event_boost >= 10 {
            reasons.push(format!("{} events", issue.event_count));
        }
    }

    let user_boost = (issue.unique_user_count as i32 * 10).min(200);
    if user_boost > 0 {
        score += user_boost;
        if issue.unique_user_count >= 2 {
            reasons.push(format!("{} users affected", issue.unique_user_count));
        }
    }

    if let Some(last_seen) = issue.last_seen_at {
        score += recency_boost(last_seen, *now);
    }

    if reasons.is_empty() {
        reasons.push("unresolved issue".into());
    }

    QueuedIssue {
        issue,
        priority_score: score,
        reasons,
    }
}

fn recency_boost(last_seen: DateTime<Utc>, now: DateTime<Utc>) -> i32 {
    let hours = now.signed_duration_since(last_seen).num_hours();
    if hours <= 1 {
        100
    } else if hours <= 24 {
        80
    } else if hours <= 72 {
        50
    } else if hours <= 168 {
        25
    } else {
        0
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
