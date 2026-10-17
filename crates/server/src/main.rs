use clap::Parser;
use epure_server::{init_runtime, router_for};
use std::net::SocketAddr;
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(name = "epure", about = "epure exception monitoring")]
struct Cli {
    #[arg(long, default_value = "all", env = "EPURE_MODE")]
    mode: String,

    /// Activate embedded Model Context Protocol (MCP) server (deactivated by default on OSS)
    #[arg(long, env = "EPURE_MCP_ENABLED", default_value_t = false)]
    enable_mcp: bool,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let cli = Cli::parse();

    if cli.mode != "all" {
        eprintln!("error: only --mode=all is supported in Phase 1");
        std::process::exit(1);
    }

    if cli.enable_mcp {
        std::env::set_var("EPURE_MCP_ENABLED", "true");
    }

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let runtime = init_runtime(&database_url)
        .await
        .expect("failed to initialize epure runtime");

    if runtime.state.mcp_enabled {
        tracing::info!("Model Context Protocol (MCP) server is active (/mcp and /api/mcp)");
    } else {
        tracing::info!("Model Context Protocol (MCP) server is deactivated (enable via EPURE_MCP_ENABLED=true or --enable-mcp)");
    }

    let bind = std::env::var("EPURE_BIND").unwrap_or_else(|_| "0.0.0.0:8080".to_string());
    let addr: SocketAddr = bind
        .parse()
        .expect("EPURE_BIND must be a valid socket address");

    let app = router_for(&runtime);
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind HTTP listener");

    tracing::info!("epure listening on {addr}");
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .expect("HTTP server exited with error");
}
