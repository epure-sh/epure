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

/// Inputs for one priority assessment. `hourly_counts` is the last 24 hours,
/// oldest first, with empty hours as zero. The newest bucket is the current hour.
#[derive(Debug, Clone)]
pub struct PrioritySignals<'a> {
    pub level: Option<&'a str>,
    pub unhandled: bool,
    pub status: &'a str,
    pub event_count: i64,
    pub user_count: i32,
    pub environment: Option<&'a str>,
    pub environment_count: i32,
    pub first_seen: Option<chrono::DateTime<chrono::Utc>>,
    pub last_seen: Option<chrono::DateTime<chrono::Utc>>,
    pub regressed_count: i32,
    pub hourly_counts: &'a [i64],
    pub now: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PriorityAssessment {
    pub score: i32,
    pub label: &'static str,
    pub pattern: &'static str,
}

/// Score an issue from its severity, who it hit, and the shape of the last day.
///
/// Critical is reserved for a live, page-worthy pattern: an unhandled or fatal
/// issue that is spiking, spreading across users, or regressing in production.
/// A single-user loop and a stale crash stay below that line.
pub fn assess_priority(signals: &PrioritySignals<'_>) -> PriorityAssessment {
    let production = is_production(signals.environment);
    let non_prod = is_non_production(signals.environment);
    let (pattern_score, mut pattern) = hourly_pattern(signals.hourly_counts);

    let mut score = severity(signals.level, signals.unhandled)
        + impact(signals.user_count, signals.event_count)
        + pattern_score
        + recency(signals.last_seen, signals.now);

    if signals.status == IssueStatus::Regression.as_str() {
        score += 12;
        if signals.regressed_count >= 3 {
            score += 4;
        }
        pattern = "regression";
    }
    if production {
        score += 4;
    }
    if non_prod {
        score -= 8;
    }
    if signals.environment_count >= 2 && production && matches!(pattern, "trickle" | "steady") {
        score += 4;
        pattern = "spread";
    }
    if signals.unhandled
        && production
        && is_new(signals.first_seen, signals.now)
        && !matches!(pattern, "spike" | "ramp" | "regression")
    {
        score += 6;
        pattern = "new";
    }

    if let Some(last_seen) = signals.last_seen {
        let age = signals.now.signed_duration_since(last_seen);
        if age.num_days() > 30 {
            score -= 30;
            pattern = "stale";
        } else if age.num_days() > 7 {
            score -= 15;
            if pattern != "spike" {
                pattern = "stale";
            }
        }
    }

    if signals.user_count <= 1 && !signals.unhandled && is_low_severity(signals.level) {
        score = score.min(22);
        pattern = "noise";
    } else if signals.user_count <= 1 && !signals.unhandled {
        score = score.min(39);
    } else if signals.user_count <= 1 && signals.unhandled && signals.level != Some("fatal") {
        score = score.min(54);
    }

    if signals.status == IssueStatus::Resolved.as_str() {
        score = score.min(8);
    } else if signals.status == IssueStatus::Ignored.as_str() {
        score = score.min(12);
    }

    let score = score.clamp(0, 100);
    PriorityAssessment {
        score,
        label: priority_label(score, signals, pattern),
        pattern,
    }
}

fn priority_label(score: i32, signals: &PrioritySignals<'_>, pattern: &str) -> &'static str {
    let live = signals
        .last_seen
        .map(|seen| signals.now.signed_duration_since(seen).num_hours() <= 6)
        .unwrap_or(false);
    let open = matches!(signals.status, "unresolved" | "regression");
    let severe = signals.unhandled || signals.level == Some("fatal");
    let wide = signals.user_count >= 5
        || (pattern == "spike" && signals.user_count >= 2)
        || (pattern == "regression" && is_production(signals.environment) && signals.unhandled);
    if live && open && severe && wide && score >= 70 {
        "critical"
    } else if score >= 50 {
        "high"
    } else if score >= 25 {
        "medium"
    } else {
        "low"
    }
}

fn severity(level: Option<&str>, unhandled: bool) -> i32 {
    match (level.unwrap_or("error"), unhandled) {
        ("fatal", true) => 36,
        ("fatal", false) => 28,
        ("error", true) => 26,
        ("error", false) => 16,
        ("warning", true) => 10,
        ("warning", false) => 5,
        _ => 1,
    }
}

fn impact(users: i32, events: i64) -> i32 {
    if users > 0 {
        return match users {
            1 => 4,
            2..=3 => 10,
            4..=9 => 16,
            10..=49 => 22,
            _ => 28,
        };
    }
    match events {
        0..=4 => 2,
        5..=19 => 6,
        20..=99 => 10,
        _ => 14,
    }
}

fn hourly_pattern(hours: &[i64]) -> (i32, &'static str) {
    let Some((&last, prior)) = hours.split_last() else {
        return (2, "trickle");
    };
    let baseline_hours: Vec<i64> = prior.iter().copied().filter(|count| *count > 0).collect();
    let baseline = if baseline_hours.is_empty() {
        0
    } else {
        baseline_hours.iter().sum::<i64>() / baseline_hours.len() as i64
    };

    if last >= 8 && (baseline == 0 || last >= baseline.saturating_mul(3)) {
        return (22, "spike");
    }
    if last >= 5 && baseline > 0 && last >= baseline.saturating_mul(2) {
        return (16, "spike");
    }
    if hours.len() >= 3 {
        let count = hours.len();
        let oldest = hours[count - 3];
        let middle = hours[count - 2];
        if last > middle && middle > oldest && last >= 4 {
            return (14, "ramp");
        }
    }
    if last >= 5 {
        return (8, "steady");
    }
    (2, "trickle")
}

fn recency(
    last_seen: Option<chrono::DateTime<chrono::Utc>>,
    now: chrono::DateTime<chrono::Utc>,
) -> i32 {
    let Some(last_seen) = last_seen else {
        return 0;
    };
    let minutes = now.signed_duration_since(last_seen).num_minutes();
    if minutes <= 15 {
        10
    } else if minutes <= 60 {
        8
    } else if minutes <= 6 * 60 {
        5
    } else if minutes <= 24 * 60 {
        2
    } else {
        0
    }
}

fn is_new(
    first_seen: Option<chrono::DateTime<chrono::Utc>>,
    now: chrono::DateTime<chrono::Utc>,
) -> bool {
    first_seen
        .map(|seen| now.signed_duration_since(seen).num_minutes() <= 60)
        .unwrap_or(true)
}

fn is_production(environment: Option<&str>) -> bool {
    matches!(
        environment
            .map(str::trim)
            .map(|value| value.to_ascii_lowercase())
            .as_deref(),
        Some("production" | "prod")
    )
}

fn is_non_production(environment: Option<&str>) -> bool {
    matches!(
        environment
            .map(str::trim)
            .map(|value| value.to_ascii_lowercase())
            .as_deref(),
        Some("development" | "dev" | "local" | "test" | "testing" | "staging")
    )
}

fn is_low_severity(level: Option<&str>) -> bool {
    matches!(level, Some("warning" | "info" | "debug") | None)
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

    #[allow(clippy::too_many_arguments)]
    fn signals<'a>(
        level: Option<&'a str>,
        unhandled: bool,
        status: &'a str,
        users: i32,
        events: i64,
        environment: Option<&'a str>,
        hours: &'a [i64],
        age_minutes: i64,
    ) -> PrioritySignals<'a> {
        let now = chrono::DateTime::parse_from_rfc3339("2026-10-29T12:00:00Z")
            .unwrap()
            .with_timezone(&chrono::Utc);
        PrioritySignals {
            level,
            unhandled,
            status,
            event_count: events,
            user_count: users,
            environment,
            environment_count: 1,
            first_seen: Some(now - chrono::Duration::minutes(age_minutes)),
            last_seen: Some(now - chrono::Duration::minutes(5)),
            regressed_count: if status == "regression" { 1 } else { 0 },
            hourly_counts: hours,
            now,
        }
    }

    #[test]
    fn a_live_production_spike_across_users_is_critical() {
        let mut hours = vec![2i64; 24];
        hours[23] = 40;
        let score = assess_priority(&signals(
            Some("error"),
            true,
            "unresolved",
            12,
            80,
            Some("production"),
            &hours,
            180,
        ));
        assert_eq!(score.pattern, "spike");
        assert_eq!(score.label, "critical");
        assert!(score.score >= 70);
    }

    #[test]
    fn one_fatal_crash_is_high_until_it_spreads() {
        let mut hours = vec![0i64; 24];
        hours[23] = 1;
        let score = assess_priority(&signals(
            Some("fatal"),
            true,
            "unresolved",
            1,
            1,
            Some("production"),
            &hours,
            10,
        ));
        assert_eq!(score.label, "high");
        assert_ne!(score.label, "critical");
    }

    #[test]
    fn a_handled_warning_loop_for_one_user_stays_low() {
        let hours = vec![20i64; 24];
        let score = assess_priority(&signals(
            Some("warning"),
            false,
            "unresolved",
            1,
            480,
            Some("production"),
            &hours,
            24 * 60,
        ));
        assert_eq!(score.pattern, "noise");
        assert_eq!(score.label, "low");
    }

    #[test]
    fn a_month_old_crash_falls_behind_a_live_one() {
        let now = chrono::DateTime::parse_from_rfc3339("2026-10-29T12:00:00Z")
            .unwrap()
            .with_timezone(&chrono::Utc);
        let quiet = [0i64; 24];
        let mut stale = signals(
            Some("fatal"),
            true,
            "unresolved",
            20,
            100,
            Some("production"),
            &quiet,
            40 * 24 * 60,
        );
        stale.last_seen = Some(now - chrono::Duration::days(40));
        let mut live_hours = vec![1i64; 24];
        live_hours[23] = 12;
        let live = signals(
            Some("error"),
            true,
            "unresolved",
            6,
            12,
            Some("production"),
            &live_hours,
            30,
        );
        let stale_score = assess_priority(&stale);
        let live_score = assess_priority(&live);
        assert_eq!(stale_score.pattern, "stale");
        assert!(live_score.score > stale_score.score);
    }

    #[test]
    fn resolved_issues_cannot_outrank_an_open_one() {
        let hours = vec![10i64; 24];
        let resolved = assess_priority(&signals(
            Some("fatal"),
            true,
            "resolved",
            40,
            400,
            Some("production"),
            &hours,
            60,
        ));
        assert!(resolved.score <= 8);
        assert_eq!(resolved.label, "low");
    }
}
