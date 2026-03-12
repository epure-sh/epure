use clap::Parser;
use epure_server::{init_runtime, router_for};
use std::net::SocketAddr;
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(name = "epure", about = "epure exception monitoring")]
struct Cli {
    #[arg(long, default_value = "all", env = "EPURE_MODE")]
    mode: String,
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

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let runtime = init_runtime(&database_url)
        .await
        .expect("failed to initialize epure runtime");

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
