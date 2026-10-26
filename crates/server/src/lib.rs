pub mod embed;
pub mod jobs;
pub mod lifecycle;
pub mod pipeline;
pub mod rate_limit;
pub mod routes;
pub mod state;

use epure_auth::{
    bootstrap_session_store, build_session_layer, init_session_store, spawn_session_cleanup,
    CredentialAuth, DsnValidator, GitHubAuth, GoogleAuth,
};
use epure_storage::{connect, connect_pools, run_migrations, PgPool, StoragePools};
use jobs::ttl::run_ttl_job;
use lifecycle::velocity::VelocityTracker;
use pipeline::ingest_cap::IngestCapTracker;
use pipeline::ingest_plan_limit::IngestPlanLimitTracker;
use pipeline::mpsc;
use pipeline::spike::SpikeValve;
use pipeline::worker::run_worker;
use routes::router;
use state::AppState;
use std::net::IpAddr;
use std::sync::Arc;
use tokio::task::JoinHandle;

pub struct ServerRuntime {
    pub pools: StoragePools,
    pub state: Arc<AppState>,
    pub worker: JoinHandle<()>,
    pub flusher: JoinHandle<()>,
    pub ttl: JoinHandle<()>,
    pub session_cleanup: JoinHandle<()>,
    shutdown: Arc<tokio::sync::Notify>,
}

impl ServerRuntime {
    pub fn pool(&self) -> &PgPool {
        &self.pools.ingest
    }

    /// After HTTP graceful shutdown: signal flusher, close ingest, join worker and flusher.
    pub async fn shutdown(self) {
        tracing::info!("epure runtime shutting down");
        self.shutdown.notify_waiters();
        drop(self.state);
        if let Err(err) = self.worker.await {
            tracing::error!(error = %err, "ingest worker task failed");
        }
        if let Err(err) = self.flusher.await {
            tracing::error!(error = %err, "spike flusher task failed");
        }
        self.ttl.abort();
        self.session_cleanup.abort();
        tracing::info!("epure runtime shutdown complete");
    }
}

fn bind_is_loopback() -> bool {
    let bind = std::env::var("EPURE_BIND").unwrap_or_else(|_| "127.0.0.1:8080".to_string());
    let host = bind
        .rsplit_once(':')
        .map(|(h, _)| h)
        .unwrap_or(bind.as_str());
    let host = host.trim_start_matches('[').trim_end_matches(']');
    match host.parse::<IpAddr>() {
        Ok(addr) => addr.is_loopback(),
        Err(_) => host == "localhost",
    }
}

/// Parse whether the MCP server is enabled from an optional string value.
/// Defaults to false (deactivated by default on OSS installation).
pub fn parse_mcp_enabled(val: Option<&str>) -> bool {
    match val {
        Some(v) => {
            let s = v.trim();
            s == "1"
                || s.eq_ignore_ascii_case("true")
                || s.eq_ignore_ascii_case("yes")
                || s.eq_ignore_ascii_case("on")
        }
        None => false,
    }
}

pub fn is_mcp_enabled_env() -> bool {
    std::env::var("EPURE_MCP_ENABLED")
        .map(|value| parse_mcp_enabled(Some(&value)))
        .unwrap_or(false)
}

pub async fn init_runtime(
    database_url: &str,
) -> Result<ServerRuntime, Box<dyn std::error::Error + Send + Sync>> {
    let migrate_pool = connect(database_url).await?;
    run_migrations(&migrate_pool).await?;

    if std::env::var("EPURE_DEV_SEED")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
    {
        if !epure_storage::allow_dev_db_fallback() || !bind_is_loopback() {
            return Err(
                "EPURE_DEV_SEED is refused unless EPURE_PUBLIC_URL is localhost and EPURE_BIND is loopback"
                    .into(),
            );
        }
        epure_storage::bootstrap::run_dev_seed(&migrate_pool)
            .await
            .map_err(|error| -> Box<dyn std::error::Error + Send + Sync> { Box::new(error) })?;
        tracing::info!("dev seed applied (EPURE_DEV_SEED)");
    }

    let pools = connect_pools(database_url).await?;
    let ingest = pools.ingest.clone();
    let app = pools.app.clone();

    let cors_origins = std::env::var("EPURE_CORS_ORIGINS")
        .unwrap_or_else(|_| "*".to_string())
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();
    epure_storage::reject_insecure_prod_config(&cors_origins)?;
    if !epure_storage::allow_dev_db_fallback()
        && std::env::var("EPURE_DEV_MOCK_CHECKOUT")
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(false)
    {
        return Err("EPURE_DEV_MOCK_CHECKOUT must not be enabled in production".into());
    }

    let (ingest_tx, ingest_rx) = mpsc::channel(10_000);
    let spike_valve = SpikeValve::new();
    let velocity_tracker = VelocityTracker::new();
    let ingest_cap = Arc::new(IngestCapTracker::new());
    let ingest_plan_limit = Arc::new(IngestPlanLimitTracker::new());
    let dsn_validator = Arc::new(DsnValidator::new(ingest.clone()));

    let artifacts_dir = std::env::var("EPURE_ARTIFACTS_DIR")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::path::PathBuf::from("/data/artifacts"));
    if let Err(err) = std::fs::create_dir_all(&artifacts_dir) {
        tracing::error!("failed to create artifacts dir: {err}");
        return Err(err.into());
    }

    let worker_pool = ingest.clone();
    let worker_artifacts_dir = artifacts_dir.clone();
    let worker_velocity = velocity_tracker.clone();
    let worker = tokio::spawn(async move {
        run_worker(
            worker_pool,
            worker_artifacts_dir,
            worker_velocity,
            ingest_rx,
        )
        .await;
    });

    let ttl_pool = migrate_pool.clone();
    let ttl = tokio::spawn(async move {
        run_ttl_job(ttl_pool).await;
    });

    let shutdown = Arc::new(tokio::sync::Notify::new());
    let flusher_pool = ingest.clone();
    let flusher_spike = spike_valve.clone();
    let flusher_shutdown = shutdown.clone();
    let flusher = tokio::spawn(async move {
        pipeline::flusher::run_spike_flusher(flusher_pool, flusher_spike, flusher_shutdown).await;
    });

    bootstrap_session_store(migrate_pool).await?;
    let session_store = init_session_store(app.clone()).await?;
    let session_cleanup = spawn_session_cleanup(session_store.clone());
    let session_layer = build_session_layer(session_store);
    let credentials = CredentialAuth::new(app.clone());
    let google = GoogleAuth::from_env(app.clone());
    let github = GitHubAuth::from_env(app);

    let mcp_enabled = is_mcp_enabled_env();

    let state = Arc::new(AppState {
        pools: pools.clone(),
        dsn_validator,
        ingest_tx,
        spike_valve,
        velocity_tracker,
        ingest_cap,
        ingest_plan_limit,
        cors_origins,
        artifacts_dir,
        credentials,
        google,
        github,
        session_layer,
        mcp_enabled,
    });

    Ok(ServerRuntime {
        pools,
        state,
        worker,
        flusher,
        ttl,
        session_cleanup,
        shutdown,
    })
}

pub fn router_for(runtime: &ServerRuntime) -> axum::Router {
    router(runtime.state.clone())
}

pub fn router_for_with_extensions(
    runtime: &ServerRuntime,
    extensions: axum::Router,
) -> axum::Router {
    routes::router_with_extensions(runtime.state.clone(), extensions)
}

pub async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };
    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    tracing::info!("shutdown signal received");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mcp_is_deactivated_by_default() {
        assert!(!parse_mcp_enabled(None));
        assert!(!parse_mcp_enabled(Some("")));
        assert!(!parse_mcp_enabled(Some("0")));
        assert!(!parse_mcp_enabled(Some("false")));
        assert!(!parse_mcp_enabled(Some("FALSE")));
        assert!(!parse_mcp_enabled(Some("no")));
        assert!(!parse_mcp_enabled(Some("off")));
    }

    #[test]
    fn mcp_activates_on_truthy_flags() {
        assert!(parse_mcp_enabled(Some("1")));
        assert!(parse_mcp_enabled(Some("true")));
        assert!(parse_mcp_enabled(Some("TRUE")));
        assert!(parse_mcp_enabled(Some("yes")));
        assert!(parse_mcp_enabled(Some("on")));
    }
}
