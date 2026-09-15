use chrono::Utc;
use epure_storage::issues::IssueLifecycleState;

pub fn is_snoozed(issue: &IssueLifecycleState) -> bool {
    if let Some(until) = issue.snooze_until {
        if until > Utc::now() {
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
