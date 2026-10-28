use epure_auth::{CredentialAuth, DsnValidator, GitHubAuth, GoogleAuth, PostgresStore};
use epure_storage::StoragePools;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::mpsc;
use tower_sessions::SessionManagerLayer;

use crate::lifecycle::velocity::VelocityTracker;
use crate::pipeline::grouping_cache::GroupingCache;
use crate::pipeline::ingest_cap::IngestCapTracker;
use crate::pipeline::ingest_plan_limit::IngestPlanLimitTracker;
use crate::pipeline::mpsc::IngestJob;
use crate::pipeline::noise_cache::NoisePolicyCache;
use crate::pipeline::outcomes::OutcomeLedger;
use crate::pipeline::spike::SpikeValve;

#[derive(Clone)]
pub struct AppState {
    pub pools: StoragePools,
    pub dsn_validator: Arc<DsnValidator>,
    pub ingest_tx: mpsc::Sender<IngestJob>,
    pub spike_valve: Arc<SpikeValve>,
    pub grouping: Arc<GroupingCache>,
    pub outcomes: Arc<OutcomeLedger>,
    pub noise_policies: Arc<NoisePolicyCache>,
    pub velocity_tracker: Arc<VelocityTracker>,
    pub ingest_cap: Arc<IngestCapTracker>,
    pub ingest_plan_limit: Arc<IngestPlanLimitTracker>,
    pub cors_origins: Vec<String>,
    pub artifacts_dir: PathBuf,
    pub credentials: CredentialAuth,
    pub google: Option<GoogleAuth>,
    pub github: Option<GitHubAuth>,
    pub session_layer: SessionManagerLayer<PostgresStore>,
    pub mcp_enabled: bool,
}
