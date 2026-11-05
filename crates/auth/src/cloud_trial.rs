//! Start the Cloud no-card trial when a new workspace is bootstrapped.

use epure_core::entitlement::{is_cloud, trial_days};
use sqlx::PgPool;
use uuid::Uuid;

/// No-op on self-hosted. On Cloud, grants the user's one trial to this org,
/// or leaves it without a plan if the user already had a trial. A failure is
/// logged, not fatal: the workspace stays usable and can subscribe directly.
pub async fn after_workspace_bootstrap(pool: &PgPool, user_id: Uuid, org_id: Uuid) {
    if !is_cloud() {
        return;
    }
    match epure_storage::billing::start_cloud_trial(pool, user_id, org_id, trial_days()).await {
        Ok(true) => tracing::info!(%org_id, "cloud trial started"),
        Ok(false) => tracing::info!(%org_id, "cloud trial already used by this user"),
        Err(err) => tracing::error!(%org_id, error = %err, "cloud trial start failed"),
    }
}
