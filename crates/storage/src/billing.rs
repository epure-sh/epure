//! Billing columns and entitlement lookups shared by ingest, API and jobs.

use chrono::{DateTime, Utc};
use epure_core::entitlement::{is_cloud, resolve_entitlement, BillingColumns, Entitlement};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct OrgBilling {
    pub billing_workspace_id: Option<Uuid>,
    pub plan_tier: String,
    pub subscription_status: String,
    pub trial_ends_at: Option<DateTime<Utc>>,
    pub canary_expires_at: Option<DateTime<Utc>>,
}

impl OrgBilling {
    pub fn entitlement(&self, now: DateTime<Utc>) -> Entitlement {
        resolve_entitlement(
            is_cloud(),
            &BillingColumns {
                plan_tier: &self.plan_tier,
                subscription_status: &self.subscription_status,
                trial_ends_at: self.trial_ends_at,
                canary_expires_at: self.canary_expires_at,
            },
            now,
        )
    }
}

impl Default for OrgBilling {
    fn default() -> Self {
        Self {
            billing_workspace_id: None,
            plan_tier: "oss".into(),
            subscription_status: "none".into(),
            trial_ends_at: None,
            canary_expires_at: None,
        }
    }
}

/// Billing columns for an org. Works from both the ingest and app pools.
pub async fn org_billing(pool: &PgPool, org_id: Uuid) -> Result<OrgBilling, sqlx::Error> {
    let row = sqlx::query_as::<_, OrgBilling>(
        "SELECT NULLIF(ingest_billing_workspace($1),$1) AS billing_workspace_id,
            plan_tier, subscription_status, trial_ends_at, canary_expires_at FROM ingest_org_billing($1)",
    )
    .bind(org_id)
    .fetch_optional(pool)
    .await?;
    Ok(row.unwrap_or_default())
}

/// Resolve the org's current entitlement.
pub async fn org_entitlement(pool: &PgPool, org_id: Uuid) -> Result<Entitlement, sqlx::Error> {
    Ok(org_billing(pool, org_id).await?.entitlement(Utc::now()))
}

/// Start the Cloud trial for a freshly bootstrapped workspace.
/// Returns `true` when this user's one trial was granted to the org.
pub async fn start_cloud_trial(
    pool: &PgPool,
    user_id: Uuid,
    org_id: Uuid,
    days: i32,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar("SELECT billing_start_trial($1, $2, $3)")
        .bind(user_id)
        .bind(org_id)
        .bind(days)
        .fetch_one(pool)
        .await
}

/// Clamp project retention to plan ceilings. Requires the migrator/admin pool.
pub async fn clamp_retention(
    pool: &PgPool,
    pro_days: i32,
    scale_days: i32,
) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar("SELECT billing_clamp_retention($1, $2)")
        .bind(pro_days)
        .bind(scale_days)
        .fetch_one(pool)
        .await
}
