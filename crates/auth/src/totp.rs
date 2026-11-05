//! Time-based one-time passwords (RFC 6238, HMAC-SHA1, 30 s, 6 digits) and
//! single-use recovery codes for two-factor login.

use hmac::{Hmac, Mac};
use rand::RngCore;
use sha1::Sha1;
use sha2::{Digest, Sha256};

pub const PERIOD_SECS: u64 = 30;
pub const DIGITS: u32 = 6;
pub const SECRET_LEN: usize = 20;
pub const RECOVERY_CODE_COUNT: usize = 10;
const BASE32: &[u8; 32] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/// New random 160-bit secret.
pub fn generate_secret() -> Vec<u8> {
    let mut secret = vec![0u8; SECRET_LEN];
    rand::rng().fill_bytes(&mut secret);
    secret
}

/// RFC 4648 base32 without padding (what authenticator apps expect).
pub fn base32_encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len().div_ceil(5) * 8);
    let mut buffer: u32 = 0;
    let mut bits = 0;
    for &byte in bytes {
        buffer = (buffer << 8) | u32::from(byte);
        bits += 8;
        while bits >= 5 {
            bits -= 5;
            out.push(BASE32[((buffer >> bits) & 31) as usize] as char);
        }
    }
    if bits > 0 {
        out.push(BASE32[((buffer << (5 - bits)) & 31) as usize] as char);
    }
    out
}

pub fn base32_decode(text: &str) -> Option<Vec<u8>> {
    let mut out = Vec::with_capacity(text.len() * 5 / 8);
    let mut buffer: u32 = 0;
    let mut bits = 0;
    for ch in text.chars().filter(|c| !c.is_whitespace() && *c != '=') {
        let value = BASE32
            .iter()
            .position(|&b| b as char == ch.to_ascii_uppercase())? as u32;
        buffer = (buffer << 5) | value;
        bits += 5;
        if bits >= 8 {
            bits -= 8;
            out.push(((buffer >> bits) & 0xff) as u8);
        }
    }
    Some(out)
}

/// `otpauth://` provisioning URI for authenticator apps.
pub fn provisioning_uri(secret: &[u8], account: &str, issuer: &str) -> String {
    format!(
        "otpauth://totp/{issuer_enc}:{account_enc}?secret={secret}&issuer={issuer_enc}&algorithm=SHA1&digits={DIGITS}&period={PERIOD_SECS}",
        issuer_enc = urlencoding::encode(issuer),
        account_enc = urlencoding::encode(account),
        secret = base32_encode(secret),
    )
}

/// HOTP value for a counter (RFC 4226 dynamic truncation).
pub fn hotp(secret: &[u8], counter: u64) -> u32 {
    let mut mac = Hmac::<Sha1>::new_from_slice(secret).expect("hmac accepts any key length");
    mac.update(&counter.to_be_bytes());
    let digest = mac.finalize().into_bytes();
    let offset = (digest[19] & 0x0f) as usize;
    let binary = (u32::from(digest[offset]) & 0x7f) << 24
        | u32::from(digest[offset + 1]) << 16
        | u32::from(digest[offset + 2]) << 8
        | u32::from(digest[offset + 3]);
    binary % 10u32.pow(DIGITS)
}

pub fn counter_at(unix_secs: u64) -> u64 {
    unix_secs / PERIOD_SECS
}

/// Check a 6-digit code against the current step and one step either side.
/// Returns the matched counter so callers can refuse replays.
pub fn verify(secret: &[u8], code: &str, unix_secs: u64) -> Option<u64> {
    let code = code.trim().replace([' ', '-'], "");
    if code.len() != DIGITS as usize || !code.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let wanted: u32 = code.parse().ok()?;
    let now = counter_at(unix_secs);
    [now.saturating_sub(1), now, now + 1]
        .into_iter()
        .find(|&counter| {
            let value = hotp(secret, counter);
            subtle::ConstantTimeEq::ct_eq(&value.to_be_bytes()[..], &wanted.to_be_bytes()[..])
                .into()
        })
}

/// Ten recovery codes like `k3f9-2hq7-m8xz`.
pub fn generate_recovery_codes() -> Vec<String> {
    const ALPHABET: &[u8] = b"abcdefghjkmnpqrstuvwxyz23456789";
    let mut rng = rand::rng();
    (0..RECOVERY_CODE_COUNT)
        .map(|_| {
            let mut bytes = [0u8; 12];
            rng.fill_bytes(&mut bytes);
            let chars: String = bytes
                .iter()
                .map(|b| ALPHABET[*b as usize % ALPHABET.len()] as char)
                .collect();
            format!("{}-{}-{}", &chars[0..4], &chars[4..8], &chars[8..12])
        })
        .collect()
}

/// Normalized SHA-256 of a recovery code (stored instead of the code).
pub fn hash_recovery_code(code: &str) -> Vec<u8> {
    let normalized: String = code
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_lowercase())
        .collect();
    Sha256::digest(normalized.as_bytes()).to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    // RFC 6238 Appendix B, SHA1 secret "12345678901234567890".
    const RFC_SECRET: &[u8] = b"12345678901234567890";

    #[test]
    fn matches_rfc6238_vectors() {
        for (time, expected) in [
            (59u64, 94287082u32),
            (1111111109, 7081804),
            (1111111111, 14050471),
            (1234567890, 89005924),
            (2000000000, 69279037),
        ] {
            assert_eq!(hotp(RFC_SECRET, counter_at(time)), expected % 1_000_000);
        }
    }

    #[test]
    fn verify_accepts_adjacent_steps_and_rejects_others() {
        let t = 1_111_111_109;
        let code = format!("{:06}", hotp(RFC_SECRET, counter_at(t)));
        assert_eq!(verify(RFC_SECRET, &code, t), Some(counter_at(t)));
        assert!(verify(RFC_SECRET, &code, t + PERIOD_SECS).is_some());
        assert!(verify(RFC_SECRET, &code, t + 3 * PERIOD_SECS).is_none());
        assert!(verify(RFC_SECRET, "12345", t).is_none());
        assert!(verify(RFC_SECRET, "abcdef", t).is_none());
    }

    #[test]
    fn base32_round_trips_and_matches_rfc4648() {
        assert_eq!(base32_encode(b"foobar"), "MZXW6YTBOI");
        assert_eq!(base32_decode("MZXW6YTBOI").unwrap(), b"foobar");
        assert_eq!(base32_decode("mzxw 6ytb oi==").unwrap(), b"foobar");
        let secret = generate_secret();
        assert_eq!(base32_decode(&base32_encode(&secret)).unwrap(), secret);
        assert!(base32_decode("not-base32!").is_none());
    }

    #[test]
    fn recovery_codes_are_unique_and_hash_ignores_formatting() {
        let codes = generate_recovery_codes();
        assert_eq!(codes.len(), RECOVERY_CODE_COUNT);
        let unique: std::collections::HashSet<_> = codes.iter().collect();
        assert_eq!(unique.len(), RECOVERY_CODE_COUNT);
        assert_eq!(
            hash_recovery_code(&codes[0]),
            hash_recovery_code(&codes[0].to_uppercase().replace('-', " "))
        );
    }

    #[test]
    fn provisioning_uri_is_well_formed() {
        let uri = provisioning_uri(RFC_SECRET, "dev@epure.local", "Epure");
        assert!(uri.starts_with("otpauth://totp/Epure:dev%40epure.local?secret="));
        assert!(uri.contains("&issuer=Epure&algorithm=SHA1&digits=6&period=30"));
    }
}
