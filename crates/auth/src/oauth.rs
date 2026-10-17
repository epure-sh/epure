use rand::RngCore;
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

use crate::password::{hash_password, verify_password, PasswordError};

pub const ACCESS_TOKEN_PREFIX: &str = "epure_pat_";
pub const REFRESH_TOKEN_PREFIX: &str = "epure_rt_";

/// Computes SHA256 hash of a string/slice.
pub fn sha256_hash(data: &[u8]) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hasher.finalize().to_vec()
}

/// Base64-URL encoding without padding (RFC 7636).
pub fn base64url_encode_nopad(input: &[u8]) -> String {
    const URL_SAFE_CHARS: &[u8] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = String::with_capacity((input.len() * 4).div_ceil(3));
    let mut i = 0;
    while i < input.len() {
        let b0 = input[i] as usize;
        let b1 = if i + 1 < input.len() {
            input[i + 1] as usize
        } else {
            0
        };
        let b2 = if i + 2 < input.len() {
            input[i + 2] as usize
        } else {
            0
        };

        let triple = (b0 << 16) | (b1 << 8) | b2;

        out.push(URL_SAFE_CHARS[(triple >> 18) & 0x3F] as char);
        out.push(URL_SAFE_CHARS[(triple >> 12) & 0x3F] as char);
        if i + 1 < input.len() {
            out.push(URL_SAFE_CHARS[(triple >> 6) & 0x3F] as char);
        }
        if i + 2 < input.len() {
            out.push(URL_SAFE_CHARS[triple & 0x3F] as char);
        }
        i += 3;
    }
    out
}

/// Verify PKCE S256 code challenge: BASE64URL(SHA256(verifier)) == challenge.
pub fn verify_pkce_s256(code_verifier: &str, code_challenge: &str) -> bool {
    if code_verifier.len() < 43 || code_verifier.len() > 128 {
        return false;
    }
    let hash = sha256_hash(code_verifier.as_bytes());
    let computed_challenge = base64url_encode_nopad(&hash);
    computed_challenge
        .as_bytes()
        .ct_eq(code_challenge.as_bytes())
        .into()
}

/// Generates random hex string of given byte length.
fn random_hex(bytes: usize) -> String {
    let mut buf = vec![0u8; bytes];
    rand::rng().fill_bytes(&mut buf);
    hex::encode(buf)
}

/// Generates an 8-character human-friendly user code with dash e.g. ABCD-EFGH (RFC 8628).
pub fn generate_user_code() -> String {
    const CHARSET: &[u8] = b"BCDFGHJKLMNPQRSTVWXYZ23456789";
    let mut buf = [0u8; 8];
    rand::rng().fill_bytes(&mut buf);
    let mut code = String::with_capacity(9);
    for (i, b) in buf.iter().enumerate() {
        if i == 4 {
            code.push('-');
        }
        let idx = (*b as usize) % CHARSET.len();
        code.push(CHARSET[idx] as char);
    }
    code
}

/// Generates a new OAuth access token.
/// Returns (full_token, prefix, secret_hash).
pub fn generate_access_token() -> Result<(String, String, Vec<u8>), PasswordError> {
    let prefix = random_hex(4); // 8 hex chars
    let secret = random_hex(16); // 32 hex chars
    let full_token = format!("{ACCESS_TOKEN_PREFIX}{prefix}_{secret}");
    let secret_hash = hash_password(&full_token)?;
    Ok((full_token, prefix, secret_hash))
}

/// Generates a new OAuth refresh token.
/// Returns (full_token, prefix, secret_hash).
pub fn generate_refresh_token() -> Result<(String, String, Vec<u8>), PasswordError> {
    let prefix = random_hex(4); // 8 hex chars
    let secret = random_hex(16); // 32 hex chars
    let full_token = format!("{REFRESH_TOKEN_PREFIX}{prefix}_{secret}");
    let secret_hash = hash_password(&full_token)?;
    Ok((full_token, prefix, secret_hash))
}

pub fn parse_refresh_token_prefix(full_token: &str) -> Option<String> {
    let rest = full_token.strip_prefix(REFRESH_TOKEN_PREFIX)?;
    if rest.len() < 8 + 1 + 32 {
        return None;
    }
    Some(rest[..8].to_string())
}

pub fn verify_token_hash(token: &str, stored_hash: &[u8]) -> bool {
    verify_password(token, stored_hash).unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pkce_verification() {
        // Standard PKCE example
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        let hash = sha256_hash(verifier.as_bytes());
        let challenge = base64url_encode_nopad(&hash);
        assert!(verify_pkce_s256(verifier, &challenge));
        assert!(!verify_pkce_s256(
            "wrong_verifier_1234567890123456789012345678901234567890",
            &challenge
        ));
    }

    #[test]
    fn test_user_code_format() {
        let code = generate_user_code();
        assert_eq!(code.len(), 9);
        assert_eq!(code.chars().nth(4), Some('-'));
    }

    #[test]
    fn test_token_generation_and_verification() {
        let (token, prefix, hash) = generate_access_token().expect("access token");
        assert!(token.starts_with(ACCESS_TOKEN_PREFIX));
        assert_eq!(prefix.len(), 8);
        assert!(verify_token_hash(&token, &hash));
    }
}
