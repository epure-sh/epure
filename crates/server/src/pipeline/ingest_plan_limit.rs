use chrono::{Datelike, Utc};
use dashmap::DashMap;
use epure_core::PlanTier;
use epure_storage::{events, projects, PgPool};
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use uuid::Uuid;

const COUNT_CACHE_TTL_SECS: u64 = 60;

#[derive(Clone)]
pub struct IngestPlanLimitTracker {
    monthly_counts: Arc<DashMap<Uuid, (u64, i64, Instant)>>,
    plan_tiers: Arc<DashMap<Uuid, (u64, String)>>,
}

impl IngestPlanLimitTracker {
    pub fn new() -> Self {
        Self {
            monthly_counts: Arc::new(DashMap::new()),
            plan_tiers: Arc::new(DashMap::new()),
        }
    }

    fn current_hour() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_secs() / 3600)
            .unwrap_or(0)
    }

    fn utc_month_bucket() -> u64 {
        let now = Utc::now();
        now.year() as u64 * 12 + now.month() as u64
    }

    async fn plan_tier_for_org(
        &self,
        pool: &PgPool,
        org_id: Uuid,
    ) -> Result<PlanTier, epure_storage::StorageError> {
        let hour = Self::current_hour();
        if let Some(entry) = self.plan_tiers.get(&org_id) {
            if entry.0 == hour {
                return Ok(PlanTier::parse_tier(&entry.1).unwrap_or(PlanTier::Oss));
            }
        }

        let raw = projects::ingest_org_plan_tier(pool, org_id).await?;
        self.plan_tiers.insert(org_id, (hour, raw.clone()));
        Ok(PlanTier::parse_tier(&raw).unwrap_or(PlanTier::Oss))
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
        self.monthly_counts.insert(org_id, (month, count, now));
        Ok(count)
    }

    /// `true` when ingest may proceed (OSS / under monthly stored-event quota).
    pub async fn allow_ingest(
        &self,
        pool: &PgPool,
        org_id: Uuid,
    ) -> Result<bool, epure_storage::StorageError> {
        let tier = self.plan_tier_for_org(pool, org_id).await?;
        let limit = tier.monthly_events();
        if limit == u64::MAX {
            return Ok(true);
        }

        let count = self.monthly_stored_count(pool, org_id).await?;
        Ok(count < limit as i64)
    }
}

impl Default for IngestPlanLimitTracker {
    fn default() -> Self {
        Self::new()
    }
}
