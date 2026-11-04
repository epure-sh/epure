use moka::sync::Cache;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sourcemap::SourceMap;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, LazyLock};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DemangleError {
    #[error("failed to read sourcemap at {path}: {source}")]
    Read {
        path: PathBuf,
        source: std::io::Error,
    },
    #[error("failed to parse sourcemap at {path}: {source}")]
    Parse {
        path: PathBuf,
        source: sourcemap::Error,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum ArtifactCacheKey {
    DebugId(String),
    ReleaseUrl {
        project_id: String,
        release: String,
        url: String,
    },
    Path(PathBuf),
    Revision {
        project_id: String,
        release: String,
        path: PathBuf,
        len: u64,
        modified: std::time::SystemTime,
    },
}

/// Global AST cache holding up to 128 parsed SourceMap instances across requests.
pub static SOURCEMAP_CACHE: LazyLock<Cache<ArtifactCacheKey, Arc<SourceMap>>> =
    LazyLock::new(|| {
        Cache::builder()
            .max_capacity(64 * 1024 * 1024)
            .weigher(|_key: &ArtifactCacheKey, map: &Arc<SourceMap>| {
                let contents: u64 = (0..map.get_source_count())
                    .map(|i| map.get_source_contents(i).map_or(0, |s| s.len() as u64))
                    .sum();
                (contents
                    .saturating_add(u64::from(map.get_token_count()) * 128)
                    .saturating_add(1024))
                .min(u64::from(u32::MAX)) as u32
            })
            .build()
    });

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DemangledFrame {
    pub filename: Option<String>,
    pub function: Option<String>,
    pub lineno: Option<u64>,
    pub colno: Option<u64>,
    pub context: Option<String>,
    #[serde(default)]
    pub pre_context: Vec<String>,
    #[serde(default)]
    pub context_line: Option<String>,
    #[serde(default)]
    pub post_context: Vec<String>,
    pub in_app: Option<bool>,
    pub module: Option<String>,
    pub demangled: bool,
    #[serde(default)]
    pub is_causal_locus: bool,
    #[serde(default)]
    pub is_elided_wrapper: bool,
}

/// Standardized Sentry source path normalization.
/// Strips query strings (?...) and common bundler prefixes (webpack:///, vite://, app:///, rollup://, ~).
pub fn normalize_sourcemap_url(url: &str) -> String {
    let without_query = url.split('?').next().unwrap_or(url);
    let stripped = without_query
        .strip_prefix("webpack:///")
        .or_else(|| without_query.strip_prefix("webpack://"))
        .or_else(|| without_query.strip_prefix("vite://"))
        .or_else(|| without_query.strip_prefix("app:///"))
        .or_else(|| without_query.strip_prefix("rollup://"))
        .unwrap_or(without_query);
    stripped
        .trim_start_matches('~')
        .trim_start_matches('/')
        .to_string()
}

/// Resolve JS/TS stack frames using uploaded source maps for a release.
pub fn demangle_stack_frames(
    frames: &[Value],
    artifacts_dir: &Path,
    project_id: &str,
    release: &str,
    resolve_artifact: &dyn Fn(&str) -> Option<PathBuf>,
) -> Vec<DemangledFrame> {
    let mut sourcemaps: HashMap<String, Arc<SourceMap>> = HashMap::new();

    frames
        .iter()
        .map(|frame| {
            demangle_frame(
                frame,
                artifacts_dir,
                project_id,
                release,
                resolve_artifact,
                &mut sourcemaps,
            )
        })
        .collect()
}

fn demangle_frame(
    frame: &Value,
    artifacts_dir: &Path,
    project_id: &str,
    release: &str,
    resolve_artifact: &dyn Fn(&str) -> Option<PathBuf>,
    cache: &mut HashMap<String, Arc<SourceMap>>,
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
        pre_context: Vec::new(),
        context_line: None,
        post_context: Vec::new(),
        in_app,
        module: module.map(str::to_string),
        demangled: false,
        is_causal_locus: false,
        is_elided_wrapper: false,
    };

    if !is_js_platform_frame(filename) {
        return result;
    }

    let Some(filename) = filename else {
        return result;
    };

    let map_name = sourcemap_name(filename);
    let sourcemap = if let Some(map) = cache.get(&map_name) {
        map.clone()
    } else {
        let Some(path) = resolve_artifact(&map_name).or_else(|| {
            default_artifact_path(artifacts_dir, project_id, release, &map_name)
                .filter(|p| p.is_file())
        }) else {
            return result;
        };
        let Ok(metadata) = std::fs::metadata(&path) else {
            return result;
        };
        // Individual parse work is bounded as well as cache retention.
        if metadata.len() > 32 * 1024 * 1024 {
            return result;
        }
        let key = ArtifactCacheKey::Revision {
            project_id: project_id.to_owned(),
            release: release.to_owned(),
            path: path.clone(),
            len: metadata.len(),
            modified: metadata.modified().unwrap_or(std::time::UNIX_EPOCH),
        };
        let map = match SOURCEMAP_CACHE.get(&key) {
            Some(map) => map,
            None => match load_sourcemap(&path) {
                Ok(map) => {
                    let map = Arc::new(map);
                    SOURCEMAP_CACHE.insert(key, map.clone());
                    map
                }
                Err(_) => return result,
            },
        };
        cache.insert(map_name, map.clone());
        map
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
            result.filename = Some(normalize_sourcemap_url(src));
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

        let (pre, ctx, post) = extract_context(&sourcemap, token.get_src_id(), src_line);
        result.pre_context = pre;
        result.context_line = ctx.clone();
        result.context = ctx;
        result.post_context = post;
    }

    result
}

fn is_js_platform_frame(filename: Option<&str>) -> bool {
    match filename {
        Some(name) => {
            let clean = name.split('?').next().unwrap_or(name);
            clean.ends_with(".js")
                || clean.ends_with(".ts")
                || clean.ends_with(".jsx")
                || clean.ends_with(".tsx")
                || clean.ends_with(".mjs")
                || clean.ends_with(".cjs")
        }
        None => false,
    }
}

fn sourcemap_name(filename: &str) -> String {
    let clean = normalize_sourcemap_url(filename);
    if clean.ends_with(".map") {
        clean
    } else {
        format!("{clean}.map")
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

fn extract_context(
    sourcemap: &SourceMap,
    source_id: u32,
    line: u32,
) -> (Vec<String>, Option<String>, Vec<String>) {
    if line == u32::MAX {
        return (Vec::new(), None, Vec::new());
    }

    let Some(contents) = sourcemap.get_source_contents(source_id) else {
        return (Vec::new(), None, Vec::new());
    };

    let idx = line as usize;
    let mut pre_context = Vec::new();
    let mut post_context = Vec::new();
    let mut context_line = None;
    for (n, text) in contents
        .lines()
        .enumerate()
        .skip(idx.saturating_sub(5))
        .take(11)
    {
        let text: String = text.chars().take(2048).collect();
        if n < idx {
            pre_context.push(text);
        } else if n == idx {
            context_line = Some(text);
        } else {
            post_context.push(text);
        }
    }

    (pre_context, context_line, post_context)
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
        assert!(demangled[0]
            .context
            .as_deref()
            .is_some_and(|line| line.contains("function throwError")));
    }
}
