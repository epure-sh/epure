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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum PlanTier {
    #[default]
    Oss,
    BuilderPro,
    MultiAppStudio,
    BoutiqueAgency,
    CanarySandbox,
}

impl PlanTier {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Oss => "oss",
            Self::BuilderPro => "builder_pro",
            Self::MultiAppStudio => "multi_app_studio",
            Self::BoutiqueAgency => "boutique_agency",
            Self::CanarySandbox => "canary_sandbox",
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
            Self::BuilderPro => TenantLimits {
                plan_tier: *self,
                max_projects: 3,
                retention_days: 30,
                allows_sub_tenants: false,
                max_sub_tenants: 0,
                spike_valve_rate_per_min: 100.0,
            },
            Self::MultiAppStudio => TenantLimits {
                plan_tier: *self,
                max_projects: 15,
                retention_days: 60,
                allows_sub_tenants: false,
                max_sub_tenants: 0,
                spike_valve_rate_per_min: 100.0,
            },
            Self::BoutiqueAgency => TenantLimits {
                plan_tier: *self,
                max_projects: 50,
                retention_days: 90,
                allows_sub_tenants: true,
                max_sub_tenants: 25,
                spike_valve_rate_per_min: 100.0,
            },
            Self::CanarySandbox => TenantLimits {
                plan_tier: *self,
                max_projects: 1,
                retention_days: 14,
                allows_sub_tenants: false,
                max_sub_tenants: 0,
                spike_valve_rate_per_min: 100.0,
            },
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
        match s.trim().to_lowercase().as_str() {
            "oss" | "self_hosted" => Ok(Self::Oss),
            "builder_pro" | "pro" => Ok(Self::BuilderPro),
            "multi_app_studio" | "studio" => Ok(Self::MultiAppStudio),
            "boutique_agency" | "agency" => Ok(Self::BoutiqueAgency),
            "canary_sandbox" | "canary" => Ok(Self::CanarySandbox),
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
