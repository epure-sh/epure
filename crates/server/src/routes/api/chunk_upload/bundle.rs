use serde::Deserialize;
use std::{
    collections::BTreeMap,
    io::{Cursor, Read},
};
use uuid::Uuid;
use zip::ZipArchive;

use super::{AssemblyError, MAX_ARTIFACT_BYTES};

#[derive(Deserialize)]
struct Manifest {
    files: BTreeMap<String, BundleEntry>,
}

#[derive(Deserialize)]
struct BundleEntry {
    #[serde(rename = "type", default)]
    kind: String,
    #[serde(default)]
    url: String,
    #[serde(default)]
    headers: BTreeMap<String, String>,
}

#[derive(Deserialize)]
struct MapMetadata {
    version: u32,
    debug_id: Option<Uuid>,
    #[serde(rename = "debugId")]
    camel_case_debug_id: Option<Uuid>,
}

pub(super) struct SourceMap {
    pub name: String,
    pub bytes: Vec<u8>,
    pub debug_id: Option<Uuid>,
}

pub(super) fn read_source_maps(
    bytes: Vec<u8>,
    require_debug_ids: bool,
) -> Result<Vec<SourceMap>, AssemblyError> {
    let mut archive = ZipArchive::new(Cursor::new(bytes))
        .map_err(|_| AssemblyError::Invalid("Invalid source map bundle"))?;
    // Read members by name. Archive paths never become filesystem paths.
    let manifest = read_entry(&mut archive, "manifest.json", 2 * 1024 * 1024)?;
    let manifest: Manifest = serde_json::from_slice(&manifest)
        .map_err(|_| AssemblyError::Invalid("Invalid source map manifest"))?;
    let mut remaining = MAX_ARTIFACT_BYTES;
    let mut maps = Vec::new();
    for (path, entry) in manifest.files {
        if entry.kind != "source_map" {
            continue;
        }
        let bytes = read_entry(&mut archive, &path, remaining)?;
        remaining -= bytes.len();
        let metadata: MapMetadata = serde_json::from_slice(&bytes)
            .map_err(|_| AssemblyError::Invalid("Invalid source map JSON"))?;
        if metadata.version != 3 || entry.url.is_empty() || entry.url.len() > 2048 {
            return Err(AssemblyError::Invalid("Invalid source map version or URL"));
        }
        let debug_id = metadata
            .debug_id
            .or(metadata.camel_case_debug_id)
            .or_else(|| {
                entry
                    .headers
                    .iter()
                    .find(|(name, _)| name.eq_ignore_ascii_case("debug-id"))
                    .and_then(|(_, value)| Uuid::parse_str(value).ok())
            });
        if require_debug_ids && debug_id.is_none() {
            return Err(AssemblyError::Invalid(
                "Inject debug IDs before uploading without a release or with a distribution",
            ));
        }
        maps.push(SourceMap {
            name: entry.url,
            bytes,
            debug_id,
        });
    }
    if maps.is_empty() {
        return Err(AssemblyError::Invalid("Bundle contains no source maps"));
    }
    Ok(maps)
}

fn read_entry(
    archive: &mut ZipArchive<Cursor<Vec<u8>>>,
    name: &str,
    limit: usize,
) -> Result<Vec<u8>, AssemblyError> {
    let entry = archive
        .by_name(name)
        .map_err(|_| AssemblyError::Invalid("Source map bundle member is missing"))?;
    if !entry.is_file() || entry.size() > limit as u64 {
        return Err(AssemblyError::Invalid(
            "Source map bundle exceeds the size limit",
        ));
    }
    let mut bytes = Vec::new();
    entry
        .take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| AssemblyError::Invalid("Could not read source map bundle member"))?;
    if bytes.len() > limit {
        return Err(AssemblyError::Invalid(
            "Source map bundle exceeds the size limit",
        ));
    }
    Ok(bytes)
}
