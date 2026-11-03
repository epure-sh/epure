//! Native launcher for the same OAuth-only runtime shipped on npm.
//! Sharing the implementation avoids a second, incompatible authentication client.
use std::process::{Command, ExitCode};

fn run() -> Result<u8, String> {
    let directory = std::env::temp_dir().join(format!("epure-mcp-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&directory).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&directory, std::fs::Permissions::from_mode(0o700))
            .map_err(|e| e.to_string())?;
    }
    let result = (|| {
        let files = [
            (
                "auth.js",
                include_str!("../../../packages/epure-mcp/lib/auth.js"),
            ),
            (
                "api.js",
                include_str!("../../../packages/epure-mcp/lib/api.js"),
            ),
            (
                "operations.js",
                include_str!("../../../packages/epure-mcp/lib/operations.js"),
            ),
            (
                "cli.js",
                include_str!("../../../packages/epure-mcp/lib/cli.js"),
            ),
            (
                "mcp.js",
                include_str!("../../../packages/epure-mcp/lib/mcp.js"),
            ),
            (
                "api-catalog.json",
                include_str!("../../../packages/epure-mcp/lib/api-catalog.json"),
            ),
        ];
        for (name, source) in files {
            std::fs::write(directory.join(name), source).map_err(|e| e.to_string())?;
        }
        std::fs::write(
            directory.join("main.js"),
            "require('./cli').run(process.argv.slice(2), {mcp:true,version:'0.3.0'});\n",
        )
        .map_err(|e| e.to_string())?;
        let status = Command::new("node")
            .arg(directory.join("main.js"))
            .args(std::env::args_os().skip(1))
            .status()
            .map_err(|_| {
                "Node.js 18 or later is required. Install Node.js, or use npx @epure-sh/cli."
                    .to_string()
            })?;
        Ok(status.code().unwrap_or(1) as u8)
    })();
    let _ = std::fs::remove_dir_all(&directory);
    result
}

fn main() -> ExitCode {
    match run() {
        Ok(code) => ExitCode::from(code),
        Err(message) => {
            eprintln!("{message}");
            ExitCode::FAILURE
        }
    }
}
