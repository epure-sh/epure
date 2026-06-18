use flate2::read::{GzDecoder, ZlibDecoder};
use std::io::Read;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("store payload is empty")]
    Empty,
    #[error("store payload is not valid JSON")]
    InvalidJson,
    #[error("store payload decompression failed")]
    DecompressFailed,
}

/// Parse legacy store JSON. Compression is handled asynchronously in the worker.
pub fn parse_store_payload(body: &[u8]) -> Result<Vec<u8>, StoreError> {
    if body.is_empty() {
        return Err(StoreError::Empty);
    }

    if body.first() == Some(&b'{') || body.first() == Some(&b'[') {
        return Ok(body.to_vec());
    }

    if is_gzip(body) || is_zlib(body) {
        return Ok(body.to_vec());
    }

    Err(StoreError::InvalidJson)
}

/// Decompress gzip/zlib store payloads before JSON parsing in the worker.
pub fn decompress_store_payload(body: &[u8]) -> Result<Vec<u8>, StoreError> {
    if body.first() == Some(&b'{') || body.first() == Some(&b'[') {
        return Ok(body.to_vec());
    }

    if is_gzip(body) {
        let mut decoder = GzDecoder::new(body);
        let mut out = Vec::new();
        decoder
            .read_to_end(&mut out)
            .map_err(|_| StoreError::DecompressFailed)?;
        return Ok(out);
    }

    if is_zlib(body) {
        let mut decoder = ZlibDecoder::new(body);
        let mut out = Vec::new();
        decoder
            .read_to_end(&mut out)
            .map_err(|_| StoreError::DecompressFailed)?;
        return Ok(out);
    }

    Err(StoreError::InvalidJson)
}

fn is_gzip(body: &[u8]) -> bool {
    body.len() >= 2 && body[0] == 0x1f && body[1] == 0x8b
}

fn is_zlib(body: &[u8]) -> bool {
    body.len() >= 2 && body[0] == 0x78 && matches!(body[1], 0x01 | 0x5e | 0x9c | 0xda)
}

#[cfg(test)]
mod tests {
    use super::*;
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use std::fs;
    use std::io::Write;
    use std::path::PathBuf;

    fn fixture_path(language: &str, name: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../fixtures/sentry")
            .join(language)
            .join(name)
    }

    #[test]
    fn parses_python_store_fixture() {
        let body = fs::read(fixture_path("python", "store.json")).expect("python fixture");
        let parsed = parse_store_payload(&body).expect("parse python store");
        assert!(parsed.starts_with(b"{"));
    }

    #[test]
    fn accepts_gzip_magic_for_worker_decompress() {
        let json = br#"{"level":"error"}"#;
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(json).expect("gzip write");
        let compressed = encoder.finish().expect("gzip finish");
        let accepted = parse_store_payload(&compressed).expect("accept gzip store");
        assert_eq!(accepted, compressed);
        let decompressed = decompress_store_payload(&compressed).expect("decompress gzip");
        assert_eq!(decompressed, json);
    }
}
