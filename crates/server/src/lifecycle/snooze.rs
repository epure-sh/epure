use epure_storage::issues::IssueLifecycleState;

pub fn is_snoozed(issue: &IssueLifecycleState) -> bool {
    if let Some(until) = issue.snooze_until {
        if until > chrono::Utc::now() {
            return true;
        }
    }

    if let Some(threshold) = issue.snooze_until_count {
        if issue.event_count < threshold as i64 {
            return true;
        }
    }

    if let Some(threshold) = issue.snooze_until_users {
        if issue.unique_user_count < threshold {
            return true;
        }
    }

    false
}

/// Status after the snooze overlay expires.
/// Regression that fired during the mute wins; otherwise restore the captured status.
pub fn status_after_wake(current_status: &str, pre_snooze_status: Option<&str>) -> String {
    if current_status == "regression" {
        "regression".to_string()
    } else {
        pre_snooze_status.unwrap_or(current_status).to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, Utc};
    use uuid::Uuid;

    fn issue(
        status: &str,
        snooze_until: Option<chrono::DateTime<Utc>>,
        snooze_until_count: Option<i32>,
        event_count: i64,
        pre_snooze_status: Option<&str>,
    ) -> IssueLifecycleState {
        IssueLifecycleState {
            id: Uuid::nil(),
            org_id: Uuid::nil(),
            project_id: Uuid::nil(),
            title: None,
            status: status.to_string(),
            release: None,
            environment: None,
            event_count,
            unique_user_count: 0,
            resolved_in_release: None,
            snooze_until,
            snooze_until_count,
            snooze_until_users: None,
            pre_snooze_status: pre_snooze_status.map(str::to_string),
        }
    }

    #[test]
    fn time_mute_is_active_until_deadline() {
        let muted = issue(
            "unresolved",
            Some(Utc::now() + Duration::hours(1)),
            None,
            3,
            Some("unresolved"),
        );
        assert!(is_snoozed(&muted));

        let expired = issue(
            "unresolved",
            Some(Utc::now() - Duration::minutes(1)),
            None,
            3,
            Some("unresolved"),
        );
        assert!(!is_snoozed(&expired));
    }

    #[test]
    fn occurrence_mute_lifts_when_count_reaches_threshold() {
        let muted = issue("unresolved", None, Some(50), 10, Some("unresolved"));
        assert!(is_snoozed(&muted));

        let lifted = issue("unresolved", None, Some(50), 50, Some("unresolved"));
        assert!(!is_snoozed(&lifted));
    }

    #[test]
    fn wake_restores_captured_status_unless_regression() {
        assert_eq!(status_after_wake("unresolved", Some("ignored")), "ignored");
        assert_eq!(
            status_after_wake("regression", Some("resolved")),
            "regression"
        );
        assert_eq!(status_after_wake("unresolved", None), "unresolved");
    }
}
