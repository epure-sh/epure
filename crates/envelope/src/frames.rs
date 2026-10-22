use serde_json::{json, Value};

/// Demangle legacy Rust symbols (`_ZN...E`) and strip compile-time hash suffixes (`::h[0-9a-f]{16}`).
pub fn demangle_rust_symbol(symbol: &str) -> String {
    let trimmed = symbol.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    if let Some(mangled) = trimmed
        .strip_prefix("_ZN")
        .and_then(|s| s.strip_suffix('E'))
    {
        let bytes = mangled.as_bytes();
        let mut i = 0;
        let mut segments = Vec::new();

        while i < bytes.len() {
            let start = i;
            while i < bytes.len() && bytes[i].is_ascii_digit() {
                i += 1;
            }
            if i == start {
                break;
            }
            if let Ok(len) = mangled[start..i].parse::<usize>() {
                if i + len <= bytes.len() {
                    let segment = &mangled[i..i + len];
                    i += len;
                    // Skip the trailing hash segment like `17h1234567890abcdef`
                    if segment.starts_with('h')
                        && segment.len() == 17
                        && segment[1..].chars().all(|c| c.is_ascii_hexdigit())
                    {
                        continue;
                    }
                    let raw_segment = if segment.starts_with("_$") {
                        &segment[1..]
                    } else {
                        segment
                    };
                    let cleaned = raw_segment
                        .replace("$u7b$", "{")
                        .replace("$u7d$", "}")
                        .replace("$u20$", " ")
                        .replace("$BP$", "*")
                        .replace("$RF$", "&")
                        .replace("$LT$", "<")
                        .replace("$GT$", ">")
                        .replace("$LP$", "(")
                        .replace("$RP$", ")")
                        .replace("$C$", ",");
                    segments.push(cleaned);
                } else {
                    break;
                }
            } else {
                break;
            }
        }

        if !segments.is_empty() {
            return segments.join("::");
        }
    }

    // Strip trailing hash `::h[0-9a-fA-F]{16}` if already present in demangled name
    if let Some(idx) = trimmed.rfind("::h") {
        let hash_part = &trimmed[idx + 3..];
        if hash_part.len() == 16 && hash_part.chars().all(|c| c.is_ascii_hexdigit()) {
            return trimmed[..idx].to_string();
        }
    }

    trimmed.to_string()
}

/// Strip build system / bundler prefixes from source paths (Next.js, Webpack, Turbopack, App bundle).
pub fn clean_frame_filename(filename: &str) -> String {
    let trimmed = filename.trim();
    let without_query = trimmed.split('?').next().unwrap_or(trimmed);
    let mut normalized = without_query;

    for prefix in [
        "webpack-internal:///(rsc)/",
        "webpack-internal:///(ssr)/",
        "webpack-internal:///(app-pages-browser)/",
        "webpack-internal:///",
        "turbopack:///[project]/",
        "turbopack:///",
        "webpack://_N_E/",
        "webpack:///",
        "app:///",
        "app://",
        "~/",
    ] {
        if let Some(rest) = normalized.strip_prefix(prefix) {
            normalized = rest;
        }
    }

    normalized.trim_start_matches("./").replace('\\', "/")
}

/// Deterministically check if a frame belongs to runtime or standard third-party frameworks.
pub fn is_framework_frame(
    filename: Option<&str>,
    module: Option<&str>,
    package: Option<&str>,
    function: Option<&str>,
    platform: Option<&str>,
) -> bool {
    let filename_lower = filename.unwrap_or("").to_lowercase();
    let module_str = module.unwrap_or("");
    let package_str = package.unwrap_or("");
    let function_str = function.unwrap_or("");
    let _platform_str = platform.unwrap_or("");

    // General Web / Node / Next.js
    if filename_lower.contains("node_modules/")
        || filename_lower.contains("node_modules\\")
        || filename_lower.contains("webpack/")
        || filename_lower.contains("next/dist/")
        || filename_lower.starts_with("node:")
        || filename_lower.starts_with("internal/")
    {
        return true;
    }

    // JVM (Java / Kotlin / Spring / Tomcat / Hikari)
    for prefix in [
        "java.",
        "javax.",
        "jdk.",
        "sun.",
        "com.sun.",
        "org.springframework.",
        "org.apache.catalina.",
        "org.apache.coyote.",
        "org.apache.tomcat.",
        "org.hibernate.",
        "com.zaxxer.hikari.",
        "io.undertow.",
        "org.eclipse.jetty.",
        "kotlin.",
        "kotlinx.coroutines.",
        "scala.",
        "groovy.",
        "org.junit.",
    ] {
        if module_str.starts_with(prefix) || function_str.starts_with(prefix) {
            return true;
        }
    }

    // .NET (C# / F# / ASP.NET Core)
    for prefix in [
        "System.",
        "Microsoft.",
        "Newtonsoft.Json",
        "Npgsql",
        "Swashbuckle",
        "MediatR",
        "AutoMapper",
        "Serilog",
        "Castle.",
        "Xunit.",
    ] {
        if module_str.starts_with(prefix)
            || package_str.starts_with(prefix)
            || function_str.starts_with(prefix)
        {
            return true;
        }
    }

    // Rust standard library, core, tokio, runtime
    if filename_lower.contains(".cargo/registry")
        || filename_lower.contains("/rustc/")
        || filename_lower.contains("\\.cargo\\registry")
    {
        return true;
    }
    for prefix in [
        "std::",
        "core::",
        "alloc::",
        "tokio::",
        "tokio_util::",
        "hyper::",
        "tower::",
        "actix_",
        "axum::",
        "futures::",
        "mio::",
        "parking_lot::",
        "serde::",
        "sqlx::",
    ] {
        if function_str.starts_with(prefix) || package_str.starts_with(prefix) {
            return true;
        }
    }

    // Python (stdlib, site-packages, django, flask, etc.)
    if filename_lower.contains("/site-packages/")
        || filename_lower.contains("/dist-packages/")
        || filename_lower.contains("/lib/python")
        || filename_lower.starts_with("<frozen ")
    {
        return true;
    }
    for prefix in [
        "django.",
        "flask.",
        "fastapi.",
        "starlette.",
        "celery.",
        "urllib3.",
        "requests.",
        "sqlalchemy.",
        "pytest.",
    ] {
        if module_str.starts_with(prefix) {
            return true;
        }
    }

    // Go (runtime, net/http, standard web frameworks)
    if filename_lower.contains("/src/runtime/")
        || filename_lower.contains("/src/net/http/")
        || filename_lower.contains("/pkg/mod/")
    {
        return true;
    }
    for prefix in [
        "runtime.",
        "net/http.",
        "syscall.",
        "google.golang.org/",
        "github.com/gin-gonic/",
        "github.com/labstack/",
        "github.com/go-chi/",
    ] {
        if function_str.starts_with(prefix) || module_str.starts_with(prefix) {
            return true;
        }
    }

    false
}

/// Extract and normalize stack frames from a raw Sentry event payload.
pub fn normalize_stack_frames(event: &Value) -> Vec<Value> {
    let raw_frames = exception_frames(event);
    let platform = event.get("platform").and_then(Value::as_str);

    raw_frames
        .into_iter()
        .map(|frame| normalize_single_frame(&frame, platform))
        .collect()
}

fn normalize_single_frame(frame: &Value, platform: Option<&str>) -> Value {
    let raw_filename = frame
        .get("filename")
        .or_else(|| frame.get("abs_path"))
        .and_then(Value::as_str);
    let raw_func = frame.get("function").and_then(Value::as_str);
    let raw_symbol = frame.get("symbol").and_then(Value::as_str);
    let module = frame
        .get("module")
        .and_then(Value::as_str)
        .map(str::to_string);
    let package = frame
        .get("package")
        .and_then(Value::as_str)
        .map(str::to_string);
    let lineno = frame.get("lineno").and_then(Value::as_u64);
    let colno = frame.get("colno").and_then(Value::as_u64);
    let instruction_addr = frame
        .get("instruction_addr")
        .and_then(Value::as_str)
        .map(str::to_string);

    let clean_filename = raw_filename.map(clean_frame_filename);

    let clean_function = if let Some(func) = raw_func {
        if platform == Some("native")
            || platform == Some("rust")
            || func.starts_with("_ZN")
            || func.contains("::h")
        {
            Some(demangle_rust_symbol(func))
        } else {
            Some(func.to_string())
        }
    } else {
        raw_symbol.map(demangle_rust_symbol)
    };

    let in_app = frame
        .get("in_app")
        .and_then(Value::as_bool)
        .unwrap_or_else(|| {
            !is_framework_frame(
                raw_filename,
                module.as_deref(),
                package.as_deref(),
                clean_function.as_deref().or(raw_func),
                platform,
            )
        });

    let mut out = json!({
        "filename": clean_filename,
        "function": clean_function,
        "symbol": raw_symbol,
        "module": module,
        "package": package,
        "lineno": lineno,
        "colno": colno,
        "in_app": in_app,
    });

    if let Some(obj) = out.as_object_mut() {
        if let Some(addr) = instruction_addr {
            obj.insert("instruction_addr".to_string(), Value::String(addr));
        }
        if let Some(ctx) = frame.get("context_line").cloned() {
            obj.insert("context_line".to_string(), ctx);
        }
        if let Some(pre) = frame.get("pre_context").cloned() {
            obj.insert("pre_context".to_string(), pre);
        }
        if let Some(post) = frame.get("post_context").cloned() {
            obj.insert("post_context".to_string(), post);
        }
        if let Some(vars) = frame.get("vars").cloned() {
            obj.insert("vars".to_string(), vars);
        }
    }

    out
}

fn exception_frames(event: &Value) -> Vec<Value> {
    if let Some(values) = event.pointer("/exception/values").and_then(Value::as_array) {
        if let Some(first) = values.first() {
            if let Some(frames) = first
                .pointer("/stacktrace/frames")
                .and_then(Value::as_array)
            {
                return frames.clone();
            }
        }
    }

    event
        .pointer("/stacktrace/frames")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn demangles_rust_symbol_and_strips_hash() {
        let mangled = "_ZN12epure_server8pipeline6worker11process_job28_$u7b$$u7b$closure$u7d$$u7d$17h1234567890abcdefE";
        let demangled = demangle_rust_symbol(mangled);
        assert_eq!(
            demangled,
            "epure_server::pipeline::worker::process_job::{{closure}}"
        );

        let with_hash = "epure_server::pipeline::worker::process_job::hdeadbeefcafebabe";
        let cleaned = demangle_rust_symbol(with_hash);
        assert_eq!(cleaned, "epure_server::pipeline::worker::process_job");
    }

    #[test]
    fn cleans_nextjs_and_bundler_paths() {
        assert_eq!(
            clean_frame_filename("webpack-internal:///(rsc)/./src/app/page.tsx"),
            "src/app/page.tsx"
        );
        assert_eq!(
            clean_frame_filename("turbopack:///[project]/src/components/Card.tsx"),
            "src/components/Card.tsx"
        );
        assert_eq!(
            clean_frame_filename("webpack://_N_E/./src/pages/index.tsx"),
            "src/pages/index.tsx"
        );
        assert_eq!(
            clean_frame_filename("app:///dist/index.js"),
            "dist/index.js"
        );
    }

    #[test]
    fn detects_framework_frames_across_languages() {
        // Java
        assert!(is_framework_frame(
            Some("FrameworkServlet.java"),
            Some("org.springframework.web.servlet.FrameworkServlet"),
            None,
            Some("processRequest"),
            Some("java")
        ));
        assert!(!is_framework_frame(
            Some("OrderService.java"),
            Some("com.acme.shop.service.OrderService"),
            None,
            Some("processOrder"),
            Some("java")
        ));

        // .NET
        assert!(is_framework_frame(
            None,
            Some("Microsoft.AspNetCore.Mvc.Core"),
            Some("Microsoft.AspNetCore.Mvc.Core"),
            Some("ActionMethodExecutor.Execute"),
            Some("csharp")
        ));
        assert!(!is_framework_frame(
            None,
            Some("Acme.Shop.Api"),
            Some("Acme.Shop.Api"),
            Some("OrderController.Checkout"),
            Some("csharp")
        ));

        // Rust
        assert!(is_framework_frame(
            Some("/rustc/123/library/core/src/ops/function.rs"),
            None,
            Some("core"),
            Some("core::ops::function::FnOnce::call_once"),
            Some("native")
        ));
        assert!(!is_framework_frame(
            Some("crates/server/src/pipeline/worker.rs"),
            None,
            Some("epure_server"),
            Some("epure_server::pipeline::worker::process_job"),
            Some("native")
        ));

        // Python
        assert!(is_framework_frame(
            Some("/usr/local/lib/python3.11/site-packages/django/core/handlers/base.py"),
            Some("django.core.handlers.base"),
            None,
            Some("get_response"),
            Some("python")
        ));
        assert!(!is_framework_frame(
            Some("app/services/checkout.py"),
            Some("app.services.checkout"),
            None,
            Some("process_payment"),
            Some("python")
        ));

        // Next.js / Node
        assert!(is_framework_frame(
            Some("node_modules/react-dom/cjs/react-dom.production.min.js"),
            None,
            None,
            Some("throwOnHydrationMismatch"),
            Some("javascript")
        ));
        assert!(!is_framework_frame(
            Some("src/components/StatCard.tsx"),
            None,
            None,
            Some("StatCard"),
            Some("javascript")
        ));
    }
}
