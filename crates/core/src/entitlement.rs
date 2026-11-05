//! What an organization is entitled to, derived from its billing columns.
//!
//! Self-hosted deployments are always unlimited. On Epure Cloud an org may
//! ingest only while it holds a Pro or Scale plan that is paid, past due
//! (provider still retrying) or inside its no-card trial. Everything else
//! (no plan, canceled, deleted, paused, expired trial) is inactive: ingest is
//! refused and the dashboard stays readable with a path to choose a plan.

use crate::PlanTier;
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};

/// Default length of the Cloud no-card trial.
pub const DEFAULT_TRIAL_DAYS: i32 = 14;

static CLOUD: AtomicBool = AtomicBool::new(false);

/// Called once by the Cloud binary before the runtime starts.
pub fn enable_cloud_deployment() {
    CLOUD.store(true, Ordering::SeqCst);
}

/// `true` on Epure Cloud (set by the Cloud binary or `EPURE_CLOUD=1`).
pub fn is_cloud() -> bool {
    CLOUD.load(Ordering::SeqCst)
        || matches!(
            std::env::var("EPURE_CLOUD").ok().as_deref().map(str::trim),
            Some("1" | "true" | "TRUE" | "yes")
        )
}

/// Cloud trial length in days (`EPURE_TRIAL_DAYS`, 1..=60, default 14).
pub fn trial_days() -> i32 {
    std::env::var("EPURE_TRIAL_DAYS")
        .ok()
        .and_then(|v| v.trim().parse::<i32>().ok())
        .filter(|d| (1..=60).contains(d))
        .unwrap_or(DEFAULT_TRIAL_DAYS)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EntitlementState {
    /// Self-hosted: no plan limits.
    Unlimited,
    /// Cloud no-card trial (or provider trial) still running.
    Trial,
    /// Paid and current.
    Active,
    /// Payment failed; the provider is retrying. Access continues.
    PastDue,
    /// No usable plan. Ingest is refused.
    Inactive,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum InactiveReason {
    NoPlan,
    TrialEnded,
    Canceled,
    Paused,
}

#[derive(Debug, Clone, Serialize)]
pub struct Entitlement {
    pub tier: PlanTier,
    pub state: EntitlementState,
    pub reason: Option<InactiveReason>,
    pub trial_ends_at: Option<DateTime<Utc>>,
}

impl Entitlement {
    pub fn can_ingest(&self) -> bool {
        self.state != EntitlementState::Inactive
    }

    /// Monthly stored-event quota; `None` means unlimited.
    pub fn monthly_events(&self) -> Option<u64> {
        match self.state {
            EntitlementState::Unlimited => None,
            EntitlementState::Inactive => Some(0),
            _ => match self.tier.monthly_events() {
                u64::MAX => None,
                n => Some(n),
            },
        }
    }

    /// Retention ceiling in days for this entitlement.
    pub fn max_retention_days(&self) -> Option<u32> {
        match self.state {
            EntitlementState::Unlimited => None,
            _ => Some(self.tier.cloud_retention_days()),
        }
    }

    /// Cron monitor ceiling; `None` means unlimited.
    pub fn max_cron_monitors(&self) -> Option<u32> {
        match self.state {
            EntitlementState::Unlimited => None,
            EntitlementState::Inactive => Some(0),
            _ => match self.tier.max_cron_monitors() {
                u32::MAX => None,
                n => Some(n),
            },
        }
    }
}

/// Billing columns of one organization, as stored.
#[derive(Debug, Clone, Default)]
pub struct BillingColumns<'a> {
    pub plan_tier: &'a str,
    pub subscription_status: &'a str,
    pub trial_ends_at: Option<DateTime<Utc>>,
    pub canary_expires_at: Option<DateTime<Utc>>,
}

/// Resolve an organization's entitlement. `cloud = false` is always unlimited.
pub fn resolve_entitlement(
    cloud: bool,
    columns: &BillingColumns<'_>,
    now: DateTime<Utc>,
) -> Entitlement {
    let parsed = PlanTier::parse_tier(columns.plan_tier).unwrap_or(PlanTier::Oss);
    if !cloud {
        return Entitlement {
            tier: parsed,
            state: EntitlementState::Unlimited,
            reason: None,
            trial_ends_at: None,
        };
    }

    let inactive = |reason| Entitlement {
        tier: if parsed == PlanTier::Oss {
            PlanTier::Pro
        } else {
            parsed
        },
        state: EntitlementState::Inactive,
        reason: Some(reason),
        trial_ends_at: columns.trial_ends_at,
    };

    if columns.canary_expires_at.is_some_and(|at| at <= now) {
        return inactive(InactiveReason::TrialEnded);
    }
    if parsed == PlanTier::Oss {
        return inactive(match columns.subscription_status {
            "canceled" | "deleted" | "revoked" => InactiveReason::Canceled,
            _ if columns.trial_ends_at.is_some() => InactiveReason::TrialEnded,
            _ => InactiveReason::NoPlan,
        });
    }

    let status = columns.subscription_status.trim().to_ascii_lowercase();
    let state = match status.as_str() {
        "active" => EntitlementState::Active,
        "past_due" => EntitlementState::PastDue,
        "trialing" => {
            let deadline = columns.trial_ends_at.or(columns.canary_expires_at);
            if deadline.is_some_and(|at| at <= now) {
                return inactive(InactiveReason::TrialEnded);
            }
            EntitlementState::Trial
        }
        "paused" => return inactive(InactiveReason::Paused),
        "canceled" | "deleted" | "revoked" | "unpaid" | "incomplete_expired" => {
            return inactive(InactiveReason::Canceled)
        }
        _ => return inactive(InactiveReason::NoPlan),
    };

    Entitlement {
        tier: parsed,
        state,
        reason: None,
        trial_ends_at: columns.trial_ends_at,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    fn cols<'a>(plan: &'a str, status: &'a str) -> BillingColumns<'a> {
        BillingColumns {
            plan_tier: plan,
            subscription_status: status,
            ..Default::default()
        }
    }

    #[test]
    fn self_hosted_is_always_unlimited() {
        let e = resolve_entitlement(false, &cols("oss", "none"), Utc::now());
        assert_eq!(e.state, EntitlementState::Unlimited);
        assert!(e.can_ingest());
        assert_eq!(e.monthly_events(), None);
        assert_eq!(e.max_cron_monitors(), None);
        assert_eq!(e.max_retention_days(), None);
    }

    #[test]
    fn cloud_oss_plan_is_inactive_not_unlimited() {
        let e = resolve_entitlement(true, &cols("oss", "deleted"), Utc::now());
        assert_eq!(e.state, EntitlementState::Inactive);
        assert_eq!(e.reason, Some(InactiveReason::Canceled));
        assert!(!e.can_ingest());
        assert_eq!(e.monthly_events(), Some(0));
        let e = resolve_entitlement(true, &cols("oss", "none"), Utc::now());
        assert_eq!(e.reason, Some(InactiveReason::NoPlan));
    }

    #[test]
    fn paid_and_past_due_plans_ingest_with_their_quota() {
        let e = resolve_entitlement(true, &cols("pro", "active"), Utc::now());
        assert_eq!(e.state, EntitlementState::Active);
        assert_eq!(e.monthly_events(), Some(200_000));
        assert_eq!(e.max_retention_days(), Some(30));
        assert_eq!(e.max_cron_monitors(), Some(5));
        let e = resolve_entitlement(true, &cols("scale", "past_due"), Utc::now());
        assert_eq!(e.state, EntitlementState::PastDue);
        assert_eq!(e.monthly_events(), Some(1_500_000));
        assert_eq!(e.max_retention_days(), Some(90));
        assert_eq!(e.max_cron_monitors(), None);
    }

    #[test]
    fn trial_runs_until_its_deadline() {
        let now = Utc::now();
        let mut c = cols("pro", "trialing");
        c.trial_ends_at = Some(now + Duration::days(3));
        let e = resolve_entitlement(true, &c, now);
        assert_eq!(e.state, EntitlementState::Trial);
        assert_eq!(e.monthly_events(), Some(200_000));

        c.trial_ends_at = Some(now - Duration::seconds(1));
        let e = resolve_entitlement(true, &c, now);
        assert_eq!(e.state, EntitlementState::Inactive);
        assert_eq!(e.reason, Some(InactiveReason::TrialEnded));
    }

    #[test]
    fn provider_trial_without_local_deadline_is_trial() {
        let e = resolve_entitlement(true, &cols("scale", "trialing"), Utc::now());
        assert_eq!(e.state, EntitlementState::Trial);
    }

    #[test]
    fn expired_canary_and_paused_and_unknown_status_are_inactive() {
        let now = Utc::now();
        let mut c = cols("canary_sandbox", "trialing");
        c.canary_expires_at = Some(now - Duration::minutes(1));
        assert_eq!(
            resolve_entitlement(true, &c, now).reason,
            Some(InactiveReason::TrialEnded)
        );
        assert_eq!(
            resolve_entitlement(true, &cols("pro", "paused"), now).reason,
            Some(InactiveReason::Paused)
        );
        assert_eq!(
            resolve_entitlement(true, &cols("pro", "weird"), now).state,
            EntitlementState::Inactive
        );
    }
}
