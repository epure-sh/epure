use serde::{Deserialize, Serialize};
use std::fmt;
use std::future::Future;
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("tenant error: {0}")]
    Tenant(String),
    #[error("auth error: {0}")]
    Auth(String),
    #[error("ingest gate error: {0}")]
    Ingest(String),
    #[error("billing error: {0}")]
    Billing(String),
}

/// Product tiers: self-hosted OSS and Cloud Pro / Scale only.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum PlanTier {
    #[default]
    Oss,
    Pro,
    Scale,
}

impl PlanTier {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Oss => "oss",
            Self::Pro => "pro",
            Self::Scale => "scale",
        }
    }

    pub fn parse_tier(s: &str) -> Option<Self> {
        s.parse().ok()
    }

    pub fn default_limits(&self) -> TenantLimits {
        match self {
            Self::Oss => TenantLimits {
                plan_tier: *self,
                max_projects: u32::MAX,
                retention_days: 30,
                allows_sub_tenants: false,
                max_sub_tenants: 0,
                spike_valve_rate_per_min: 100.0,
            },
            Self::Pro => TenantLimits {
                plan_tier: *self,
                max_projects: u32::MAX,
                retention_days: 35,
                allows_sub_tenants: false,
                max_sub_tenants: 0,
                spike_valve_rate_per_min: 100.0,
            },
            Self::Scale => TenantLimits {
                plan_tier: *self,
                max_projects: u32::MAX,
                retention_days: 90,
                allows_sub_tenants: true,
                max_sub_tenants: u32::MAX,
                spike_valve_rate_per_min: 100.0,
            },
        }
    }

    pub fn monthly_events(&self) -> u64 {
        match self {
            Self::Oss => u64::MAX,
            Self::Pro => 200_000,
            Self::Scale => 1_500_000,
        }
    }

    pub fn max_cron_monitors(&self) -> u32 {
        match self {
            Self::Oss => u32::MAX,
            Self::Pro => 5,
            Self::Scale => u32::MAX,
        }
    }

    pub fn max_orgs(&self) -> u32 {
        match self {
            Self::Oss => u32::MAX,
            Self::Pro => 1,
            Self::Scale => u32::MAX,
        }
    }
}

impl fmt::Display for PlanTier {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl std::str::FromStr for PlanTier {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        // Polar active SKUs: pro | scale (+ legacy strings → same). See cloud-billing polar_paid_tier.
        match s.trim().to_lowercase().as_str() {
            "oss" | "self_hosted" => Ok(Self::Oss),
            "pro" | "builder_pro" | "canary_sandbox" | "canary" => Ok(Self::Pro),
            "scale" | "team_plus" | "plus" | "studio" | "multi_app_studio" => Ok(Self::Scale),
            "agency" | "boutique_agency" => Ok(Self::Scale),
            "dedicated" | "enterprise" | "dedicated_sovereign" => Ok(Self::Scale),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TenantLimits {
    pub plan_tier: PlanTier,
    pub max_projects: u32,
    pub retention_days: u32,
    pub allows_sub_tenants: bool,
    pub max_sub_tenants: u32,
    pub spike_valve_rate_per_min: f64,
}

/// Abstract tenancy gate interface for checking organization plan limits.
pub trait TenancyGate: Send + Sync {
    fn get_limits(
        &self,
        org_id: Uuid,
    ) -> impl Future<Output = Result<TenantLimits, CoreError>> + Send;
    fn can_create_project(
        &self,
        org_id: Uuid,
        current_count: u32,
    ) -> impl Future<Output = Result<bool, CoreError>> + Send;
    fn can_create_client_org(
        &self,
        parent_agency_id: Uuid,
        current_count: u32,
    ) -> impl Future<Output = Result<bool, CoreError>> + Send;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IngestionAction {
    Accept,
    RateLimitSpike,
    DropNonErrorItem,
    RejectInvalidDsn,
    RejectPlanLimit,
}

/// Abstract ingestion gate interface for DSN validation, spike valve filtering, and item routing.
pub trait IngestionGate: Send + Sync {
    fn evaluate(
        &self,
        project_id: Uuid,
        public_key: &str,
        fingerprint: &str,
        item_type: &str,
    ) -> impl Future<Output = IngestionAction> + Send;
}

/// Abstract auth provider interface for pluggable authentication mechanisms.
pub trait AuthProvider: Send + Sync {
    fn authenticate_token(
        &self,
        token: &str,
    ) -> impl Future<Output = Result<Uuid, CoreError>> + Send;
}

/// Abstract billing provider interface for webhook processing.
pub trait BillingProvider: Send + Sync {
    fn handle_webhook(
        &self,
        event_type: &str,
        payload: &[u8],
    ) -> impl Future<Output = Result<(), CoreError>> + Send;
}

/// Default open-source tenancy gate that places no artificial project caps on self-hosted instances.
#[derive(Debug, Default, Clone)]
pub struct OpenSourceTenancyGate;

impl TenancyGate for OpenSourceTenancyGate {
    async fn get_limits(&self, _org_id: Uuid) -> Result<TenantLimits, CoreError> {
        Ok(PlanTier::Oss.default_limits())
    }

    async fn can_create_project(
        &self,
        _org_id: Uuid,
        _current_count: u32,
    ) -> Result<bool, CoreError> {
        Ok(true)
    }

    async fn can_create_client_org(
        &self,
        _parent_agency_id: Uuid,
        _current_count: u32,
    ) -> Result<bool, CoreError> {
        Ok(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_plan_tier_quotas_v2() {
        let pro = PlanTier::Pro;
        assert_eq!(pro.as_str(), "pro");
        assert_eq!(pro.monthly_events(), 200_000);
        assert_eq!(pro.max_cron_monitors(), 5);
        assert_eq!(pro.max_orgs(), 1);
        let pro_limits = pro.default_limits();
        assert_eq!(pro_limits.retention_days, 35);
        assert_eq!(pro_limits.max_projects, u32::MAX);

        let scale = PlanTier::Scale;
        assert_eq!(scale.as_str(), "scale");
        assert_eq!(scale.monthly_events(), 1_500_000);
        assert_eq!(scale.max_cron_monitors(), u32::MAX);
        assert_eq!(scale.max_orgs(), u32::MAX);
        let scale_limits = scale.default_limits();
        assert_eq!(scale_limits.retention_days, 90);
        assert_eq!(scale_limits.max_projects, u32::MAX);
        assert!(scale_limits.allows_sub_tenants);
    }

    #[test]
    fn test_plan_tier_parsing() {
        assert_eq!("pro".parse::<PlanTier>(), Ok(PlanTier::Pro));
        assert_eq!("scale".parse::<PlanTier>(), Ok(PlanTier::Scale));
        assert_eq!("oss".parse::<PlanTier>(), Ok(PlanTier::Oss));
        assert_eq!("builder_pro".parse::<PlanTier>(), Ok(PlanTier::Pro));
        assert_eq!("canary_sandbox".parse::<PlanTier>(), Ok(PlanTier::Pro));
        assert_eq!("boutique_agency".parse::<PlanTier>(), Ok(PlanTier::Scale));
    }
}
