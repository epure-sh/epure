pub mod embed;
pub mod jobs;
pub mod lifecycle;
pub mod pipeline;
pub mod rate_limit;
pub mod routes;
pub mod state;

use epure_auth::{
    build_session_layer, init_session_store, spawn_session_cleanup, CredentialAuth, DsnValidator,
    GoogleAuth,
};
use epure_storage::{connect, connect_pools, run_migrations, PgPool, StoragePools};
use jobs::ttl::run_ttl_job;
use lifecycle::velocity::VelocityTracker;
use pipeline::ingest_cap::IngestCapTracker;
use pipeline::mpsc;
use pipeline::spike::SpikeValve;
use pipeline::worker::run_worker;
use routes::router;
use state::AppState;
use std::sync::Arc;

pub struct ServerRuntime {
    pub pools: StoragePools,
    pub state: Arc<AppState>,
}

impl ServerRuntime {
    pub fn pool(&self) -> &PgPool {
        &self.pools.ingest
    }
}

pub async fn init_runtime(database_url: &str) -> Result<ServerRuntime, Box<dyn std::error::Error + Send + Sync>> {
    let migrate_pool = connect(database_url).await?;
    run_migrations(&migrate_pool).await?;

    if std::env::var("EPURE_DEV_SEED")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
    {
        epure_storage::bootstrap::run_dev_seed(&migrate_pool)
            .await
            .map_err(|error| -> Box<dyn std::error::Error + Send + Sync> { Box::new(error) })?;
        tracing::info!("dev seed applied (EPURE_DEV_SEED)");
    }

    let pools = connect_pools(database_url).await?;
    let pool = pools.ingest.clone();

    let cors_origins = std::env::var("EPURE_CORS_ORIGINS")
        .unwrap_or_else(|_| "*".to_string())
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();

    let (ingest_tx, ingest_rx) = mpsc::channel(10_000);
    let spike_valve = SpikeValve::new();
    let velocity_tracker = VelocityTracker::new();
    let ingest_cap = Arc::new(IngestCapTracker::new());
    let dsn_validator = Arc::new(DsnValidator::new(pool.clone()));

    let artifacts_dir = std::env::var("EPURE_ARTIFACTS_DIR")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::path::PathBuf::from("/data/artifacts"));
    std::fs::create_dir_all(&artifacts_dir).ok();

    let worker_pool = pool.clone();
    let worker_artifacts_dir = artifacts_dir.clone();
    let worker_velocity = velocity_tracker.clone();
    tokio::spawn(async move {
        run_worker(worker_pool, worker_artifacts_dir, worker_velocity, ingest_rx).await;
    });

    let ttl_pool = pool.clone();
    tokio::spawn(async move {
        run_ttl_job(ttl_pool).await;
    });

    let session_store = init_session_store(migrate_pool.clone()).await?;
    spawn_session_cleanup(session_store.clone());
    let session_layer = build_session_layer(session_store);
    let credentials = CredentialAuth::new(pool.clone());
    let google = GoogleAuth::from_env(pool.clone());

    let state = Arc::new(AppState {
        pools: pools.clone(),
        dsn_validator,
        ingest_tx,
        spike_valve,
        velocity_tracker,
        ingest_cap,
        cors_origins,
        artifacts_dir,
        credentials,
        google,
        session_layer,
    });

    Ok(ServerRuntime { pools, state })
}

pub fn router_for(runtime: &ServerRuntime) -> axum::Router {
    router(runtime.state.clone())
}
