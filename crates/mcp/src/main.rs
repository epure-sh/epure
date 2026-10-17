use clap::Parser;
use epure_mcp::{JsonRpcRequest, McpHandler};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

#[derive(Parser, Debug)]
#[command(
    name = "epure-mcp",
    about = "Ultra-lean (<600 tokens) surgical MCP server for Epure"
)]
struct Args {
    #[arg(long, env = "EPURE_URL", default_value = "https://epure.sh")]
    url: String,

    #[arg(long, env = "EPURE_TOKEN")]
    token: Option<String>,

    #[arg(long)]
    domain: Option<String>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();
    let token = args
        .token
        .or_else(|| std::env::var("EPURE_TOKEN").ok())
        .unwrap_or_else(|| {
            if let Some(domain) = &args.domain {
                format!("epk_demo_{domain}")
            } else {
                eprintln!("Warning: No EPURE_TOKEN provided. Some tools may fail authentication.");
                String::new()
            }
        });

    let handler = McpHandler::new(args.url, token);

    let stdin = tokio::io::stdin();
    let mut reader = BufReader::new(stdin).lines();
    let mut stdout = tokio::io::stdout();

    while let Ok(Some(line)) = reader.next_line().await {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        if let Ok(req) = serde_json::from_str::<JsonRpcRequest>(trimmed) {
            let res = handler.handle_request(req).await;
            let json_str = serde_json::to_string(&res)?;
            stdout.write_all(json_str.as_bytes()).await?;
            stdout.write_all(b"\n").await?;
            stdout.flush().await?;
        }
    }

    Ok(())
}
