use serde::{Deserialize, Serialize};
use serde_json::Value;
use sourcemap::SourceMap;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DemangleError {
    #[error("failed to read sourcemap at {path}: {source}")]
    Read { path: PathBuf, source: std::io::Error },
    #[error("failed to parse sourcemap at {path}: {source}")]
    Parse { path: PathBuf, source: sourcemap::Error },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DemangledFrame {
    pub filename: Option<String>,
    pub function: Option<String>,
    pub lineno: Option<u64>,
    pub colno: Option<u64>,
    pub context: Option<String>,
    pub in_app: Option<bool>,
    pub module: Option<String>,
    pub demangled: bool,
}

/// Resolve JS/TS stack frames using uploaded source maps for a release.
pub fn demangle_stack_frames(
    frames: &[Value],
    artifacts_dir: &Path,
    project_id: &str,
    release: &str,
    resolve_artifact: &dyn Fn(&str) -> Option<PathBuf>,
) -> Vec<DemangledFrame> {
    let mut sourcemaps: HashMap<String, SourceMap> = HashMap::new();

    frames
        .iter()
        .map(|frame| demangle_frame(frame, artifacts_dir, project_id, release, resolve_artifact, &mut sourcemaps))
        .collect()
}

fn demangle_frame(
    frame: &Value,
    artifacts_dir: &Path,
    project_id: &str,
    release: &str,
    resolve_artifact: &dyn Fn(&str) -> Option<PathBuf>,
    cache: &mut HashMap<String, SourceMap>,
) -> DemangledFrame {
    let filename = frame.get("filename").and_then(Value::as_str);
    let function = frame.get("function").and_then(Value::as_str);
    let lineno = frame.get("lineno").and_then(Value::as_u64);
    let colno = frame.get("colno").and_then(Value::as_u64);
    let in_app = frame.get("in_app").and_then(Value::as_bool);
    let module = frame.get("module").and_then(Value::as_str);

    let mut result = DemangledFrame {
        filename: filename.map(str::to_string),
        function: function.map(str::to_string),
        lineno,
        colno,
        context: None,
        in_app,
        module: module.map(str::to_string),
        demangled: false,
    };

    if !is_js_platform_frame(filename) {
        return result;
    }

    let Some(filename) = filename else {
        return result;
    };

    let map_name = sourcemap_name(filename);
    let map_path = resolve_artifact(&map_name).or_else(|| {
        default_artifact_path(artifacts_dir, project_id, release, &map_name)
            .filter(|path| path.is_file())
    });

    let Some(map_path) = map_path else {
        return result;
    };

    let sourcemap = match cache.get(&map_name) {
        Some(map) => map,
        None => match load_sourcemap(&map_path) {
            Ok(map) => {
                cache.insert(map_name.clone(), map);
                cache.get(&map_name).expect("just inserted")
            }
            Err(_) => return result,
        },
    };

    let Some(lineno) = lineno else {
        return result;
    };
    let column = colno.unwrap_or(1);

    // Sentry frames are 1-based; sourcemap lookups are 0-based.
    let line0 = lineno.saturating_sub(1);
    let col0 = column.saturating_sub(1);

    if let Some(token) = sourcemap.lookup_token(line0 as u32, col0 as u32) {
        result.demangled = true;
        if let Some(src) = token.get_source() {
            result.filename = Some(src.to_string());
        }
        if let Some(name) = token.get_name() {
            result.function = Some(name.to_string());
        }
        let src_line = token.get_src_line();
        if src_line != u32::MAX {
            result.lineno = Some(src_line as u64 + 1);
        }
        let src_col = token.get_src_col();
        if src_col != u32::MAX {
            result.colno = Some(src_col as u64);
        }
        result.context = context_snippet(sourcemap, token.get_src_id(), src_line);
    }

    result
}

fn is_js_platform_frame(filename: Option<&str>) -> bool {
    match filename {
        Some(name) => {
            name.ends_with(".js")
                || name.ends_with(".ts")
                || name.ends_with(".jsx")
                || name.ends_with(".tsx")
                || name.ends_with(".mjs")
                || name.ends_with(".cjs")
        }
        None => false,
    }
}

fn sourcemap_name(filename: &str) -> String {
    if filename.ends_with(".map") {
        filename.to_string()
    } else {
        format!("{filename}.map")
    }
}

fn default_artifact_path(
    artifacts_dir: &Path,
    project_id: &str,
    release: &str,
    name: &str,
) -> Option<PathBuf> {
    let path = artifacts_dir
        .join(project_id)
        .join(release)
        .join(sanitize_filename(name));
    Some(path)
}

fn sanitize_filename(name: &str) -> String {
    name.trim_start_matches("~/")
        .trim_start_matches('/')
        .replace('/', "_")
}

pub fn load_sourcemap(path: &Path) -> Result<SourceMap, DemangleError> {
    let bytes = std::fs::read(path).map_err(|source| DemangleError::Read {
        path: path.to_path_buf(),
        source,
    })?;
    SourceMap::from_slice(&bytes).map_err(|source| DemangleError::Parse {
        path: path.to_path_buf(),
        source,
    })
}

fn context_snippet(sourcemap: &SourceMap, source_id: u32, line: u32) -> Option<String> {
    if line == u32::MAX {
        return None;
    }

    sourcemap
        .get_source_contents(source_id)
        .and_then(|contents| line_snippet(contents, line as usize))
}

fn line_snippet(source: &str, line: usize) -> Option<String> {
    source
        .lines()
        .nth(line)
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::fs;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Mutex;

    static TEMP_COUNTER: AtomicUsize = AtomicUsize::new(0);

    fn write_fixture_sourcemap() -> (PathBuf, String) {
        let dir = std::env::temp_dir().join(format!(
            "epure-demangle-test-{}",
            TEMP_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&dir).expect("create temp dir");
        let map_path = dir.join("app.min.js.map");
        let map_json = r#"{
            "version": 3,
            "file": "app.min.js",
            "sources": ["src/app.ts"],
            "sourcesContent": ["function throwError() {\n  throw new Error(\"boom\");\n}\nthrowError();\n"],
            "names": ["throwError"],
            "mappings": "AAAA,SAASA"
        }"#;
        fs::write(&map_path, map_json).expect("write sourcemap");
        (map_path, dir.to_string_lossy().to_string())
    }

    #[test]
    fn demangles_frame_with_uploaded_sourcemap() {
        let (map_path, _dir) = write_fixture_sourcemap();
        let map_path = Mutex::new(map_path);
        let frames = [json!({
            "filename": "app.min.js",
            "function": "n",
            "lineno": 1,
            "colno": 10,
            "in_app": true
        })];

        let demangled = demangle_stack_frames(
            &frames,
            Path::new("/tmp/unused"),
            "project",
            "1.0.0",
            &|name| {
                if name == "app.min.js.map" {
                    Some(map_path.lock().expect("lock").clone())
                } else {
                    None
                }
            },
        );

        assert_eq!(demangled.len(), 1);
        assert!(demangled[0].demangled);
        assert_eq!(demangled[0].filename.as_deref(), Some("src/app.ts"));
        assert_eq!(demangled[0].function.as_deref(), Some("throwError"));
        assert_eq!(demangled[0].lineno, Some(1));
        assert!(
            demangled[0]
                .context
                .as_deref()
                .is_some_and(|line| line.contains("function throwError"))
        );
    }
}
