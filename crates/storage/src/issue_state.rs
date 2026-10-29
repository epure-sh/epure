//! Issue workflow.
//!
//! `status` is the durable triage state. Snooze is an overlay on top of it:
//! the issue keeps its status, and `pre_snooze_status` remembers that status
//! while the until-columns hide it from the inbox. Waking clears the overlay
//! and leaves `status` unchanged unless a regression was recorded meanwhile.
//!
//! Allowed statuses:
//! - `unresolved` — in the inbox
//! - `resolved` — marked fixed; `resolved_at` is set, and `resolved_in_release` may name the fix
//! - `ignored` — muted until someone reopens it
//! - `regression` — occurred again after it was resolved

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IssueStatus {
    Unresolved,
    Resolved,
    Ignored,
    Regression,
}

impl IssueStatus {
    pub fn parse(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "unresolved" | "open" => Some(Self::Unresolved),
            "resolved" => Some(Self::Resolved),
            "ignored" => Some(Self::Ignored),
            "regression" => Some(Self::Regression),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Unresolved => "unresolved",
            Self::Resolved => "resolved",
            Self::Ignored => "ignored",
            Self::Regression => "regression",
        }
    }
}

/// 0–100 score used when the user has not locked a manual priority.
pub fn priority_score(
    level: Option<&str>,
    unhandled: bool,
    event_count: i64,
    users: i32,
    status: &str,
) -> i32 {
    let mut score = match level.unwrap_or("error") {
        "fatal" => 40,
        "error" => 25,
        "warning" => 10,
        _ => 0,
    };
    if unhandled {
        score += 20;
    }
    if status == IssueStatus::Regression.as_str() {
        score += 15;
    }
    score += (event_count.clamp(0, 100) as i32) / 5;
    score += users.clamp(0, 20);
    score.clamp(0, 100)
}

pub fn priority_label(score: i32) -> &'static str {
    if score >= 80 {
        "critical"
    } else if score >= 50 {
        "high"
    } else if score >= 25 {
        "medium"
    } else {
        "low"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn statuses_are_the_four_workflow_states() {
        assert_eq!(IssueStatus::parse("open").unwrap().as_str(), "unresolved");
        assert!(IssueStatus::parse("snoozed").is_none());
        assert!(IssueStatus::parse("regressed").is_none());
    }

    #[test]
    fn fatal_unhandled_regression_ranks_above_a_warning() {
        let fatal = priority_score(Some("fatal"), true, 40, 5, "regression");
        let warning = priority_score(Some("warning"), false, 1, 1, "unresolved");
        assert!(fatal > warning);
        assert_eq!(priority_label(fatal), "critical");
        assert_eq!(priority_label(warning), "low");
    }
}
