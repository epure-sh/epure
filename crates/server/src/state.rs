use epure_auth::{CredentialAuth, DsnValidator, GoogleAuth, PostgresStore};
use epure_storage::StoragePools;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::mpsc;
use tower_sessions::SessionManagerLayer;

use crate::lifecycle::velocity::VelocityTracker;
use crate::pipeline::ingest_cap::IngestCapTracker;
use crate::pipeline::mpsc::IngestJob;
use crate::pipeline::spike::SpikeValve;

#[derive(Clone)]
pub struct AppState {
    pub pools: StoragePools,
    pub dsn_validator: Arc<DsnValidator>,
    pub ingest_tx: mpsc::Sender<IngestJob>,
    pub spike_valve: Arc<SpikeValve>,
    pub velocity_tracker: Arc<VelocityTracker>,
    pub ingest_cap: Arc<IngestCapTracker>,
    pub cors_origins: Vec<String>,
    pub artifacts_dir: PathBuf,
    pub credentials: CredentialAuth,
    pub google: Option<GoogleAuth>,
    pub session_layer: SessionManagerLayer<PostgresStore>,
}
