//! Plan gate for ingest: entitlement (Cloud trial/paid/inactive) and the
//! monthly stored-event quota with the "never go blind" over-quota rule.
//!
//! Over quota, events of existing open issues are counted without storing a
//! payload, and the first event of a new or regressed issue is still stored,
//! up to a grace of 5% of the plan's monthly events. Only past that grace are
//! new fingerprints refused. Self-hosted deployments are never limited.

use chrono::{Datelike, Utc};
use dashmap::DashMap;
use epure_core::entitlement::{Entitlement, InactiveReason};
use epure_storage::{billing, events, PgPool};
use std::sync::Arc;
use std::time::Instant;
use uuid::Uuid;

const ENTITLEMENT_CACHE_TTL_SECS: u64 = 60;
const COUNT_CACHE_TTL_SECS: u64 = 60;
const CACHE_MAX_ORGS: usize = 20_000;
/// New-issue grace past the quota, as a fraction of the monthly quota.
pub const OVER_QUOTA_GRACE_DIVISOR: u64 = 20;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QuotaDecision {
    /// Under quota (or unlimited): ingest normally.
    Allow,
    /// Quota reached: count existing issues; store first events while grace remains.
    OverQuota { grace_remaining: bool },
    /// No usable plan (Cloud only): refuse.
    Inactive(InactiveReason),
}

#[derive(Clone)]
pub struct IngestPlanLimitTracker {
    monthly_counts: Arc<DashMap<Uuid, (u64, i64, Instant)>>,
    entitlements: Arc<DashMap<Uuid, (Entitlement, Instant)>>,
}

impl IngestPlanLimitTracker {
    pub fn new() -> Self {
        Self {
            monthly_counts: Arc::new(DashMap::new()),
            entitlements: Arc::new(DashMap::new()),
        }
    }

    fn utc_month_bucket() -> u64 {
        let now = Utc::now();
        now.year() as u64 * 12 + now.month() as u64
    }

    /// Drop cached state for an org (after billing changes).
    pub fn invalidate(&self, org_id: Uuid) {
        self.entitlements.remove(&org_id);
        self.monthly_counts.remove(&org_id);
    }

    /// Cached entitlement for an org (60 s).
    pub async fn entitlement(
        &self,
        pool: &PgPool,
        org_id: Uuid,
    ) -> Result<Entitlement, epure_storage::StorageError> {
        if let Some(entry) = self.entitlements.get(&org_id) {
            if entry.1.elapsed().as_secs() < ENTITLEMENT_CACHE_TTL_SECS {
                return Ok(entry.0.clone());
            }
        }
        let entitlement = billing::org_entitlement(pool, org_id).await?;
        if self.entitlements.len() < CACHE_MAX_ORGS || self.entitlements.contains_key(&org_id) {
            self.entitlements
                .insert(org_id, (entitlement.clone(), Instant::now()));
        }
        Ok(entitlement)
    }

    async fn monthly_stored_count(
        &self,
        pool: &PgPool,
        org_id: Uuid,
    ) -> Result<i64, epure_storage::StorageError> {
        let month = Self::utc_month_bucket();
        let now = Instant::now();
        if let Some(entry) = self.monthly_counts.get(&org_id) {
            let (stored_month, count, fetched_at) = entry.value();
            if *stored_month == month
                && now.duration_since(*fetched_at).as_secs() < COUNT_CACHE_TTL_SECS
            {
                return Ok(*count);
            }
        }

        let count = events::org_monthly_event_count(pool, org_id).await?;
        if self.monthly_counts.len() < CACHE_MAX_ORGS || self.monthly_counts.contains_key(&org_id) {
            self.monthly_counts.insert(org_id, (month, count, now));
        }
        Ok(count)
    }

    /// Decide how this org's next event may be ingested.
    pub async fn decide(
        &self,
        pool: &PgPool,
        org_id: Uuid,
    ) -> Result<QuotaDecision, epure_storage::StorageError> {
        let entitlement = self.entitlement(pool, org_id).await?;
        if !entitlement.can_ingest() {
            return Ok(QuotaDecision::Inactive(
                entitlement.reason.unwrap_or(InactiveReason::NoPlan),
            ));
        }
        let Some(limit) = entitlement.monthly_events() else {
            return Ok(QuotaDecision::Allow);
        };
        let count = self.monthly_stored_count(pool, org_id).await?.max(0) as u64;
        Ok(quota_decision(count, limit))
    }

    /// `true` when a check-in may create or update this monitor under the plan ceiling.
    pub async fn monitor_allowed(
        &self,
        pool: &PgPool,
        org_id: Uuid,
        project_id: Uuid,
        slug: &str,
    ) -> Result<bool, epure_storage::StorageError> {
        let entitlement = self.entitlement(pool, org_id).await?;
        if !entitlement.can_ingest() {
            return Ok(false);
        }
        let Some(max) = entitlement.max_cron_monitors() else {
            return Ok(true);
        };
        let (exists, total) =
            epure_storage::monitors::monitor_slot(pool, org_id, project_id, slug).await?;
        Ok(exists || total < i64::from(max))
    }

    /// `true` when ingest may proceed normally (kept for callers that only need a yes/no).
    pub async fn allow_ingest(
        &self,
        pool: &PgPool,
        org_id: Uuid,
    ) -> Result<bool, epure_storage::StorageError> {
        Ok(self.decide(pool, org_id).await? == QuotaDecision::Allow)
    }
}

/// Pure quota rule: under the limit → allow; then a grace of `limit / 20` for new issues.
pub fn quota_decision(stored_this_month: u64, limit: u64) -> QuotaDecision {
    if stored_this_month < limit {
        return QuotaDecision::Allow;
    }
    let grace = (limit / OVER_QUOTA_GRACE_DIVISOR).max(1);
    QuotaDecision::OverQuota {
        grace_remaining: stored_this_month < limit.saturating_add(grace),
    }
}

impl Default for IngestPlanLimitTracker {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quota_rule_allows_then_grants_grace_then_stops_new_issues() {
        assert_eq!(quota_decision(0, 200_000), QuotaDecision::Allow);
        assert_eq!(quota_decision(199_999, 200_000), QuotaDecision::Allow);
        assert_eq!(
            quota_decision(200_000, 200_000),
            QuotaDecision::OverQuota {
                grace_remaining: true
            }
        );
        assert_eq!(
            quota_decision(209_999, 200_000),
            QuotaDecision::OverQuota {
                grace_remaining: true
            }
        );
        assert_eq!(
            quota_decision(210_000, 200_000),
            QuotaDecision::OverQuota {
                grace_remaining: false
            }
        );
    }

    #[test]
    fn tiny_quota_still_has_one_grace_event() {
        assert_eq!(
            quota_decision(10, 10),
            QuotaDecision::OverQuota {
                grace_remaining: true
            }
        );
        assert_eq!(
            quota_decision(11, 10),
            QuotaDecision::OverQuota {
                grace_remaining: false
            }
        );
    }
}
