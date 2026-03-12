use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

pub const SIGNATURE_HEADER: &str = "X-Epure-Signature";
pub const DELIVERY_HEADER: &str = "X-Epure-Delivery-Id";
pub const TIMESTAMP_HEADER: &str = "X-Epure-Timestamp";

pub fn sign_payload(secret: &[u8], body: &[u8]) -> String {
    let mut mac =
        HmacSha256::new_from_slice(secret).expect("webhook signing key must be non-empty");
    mac.update(body);
    format!("sha256={}", hex::encode(mac.finalize().into_bytes()))
}

pub fn verify_payload(secret: &[u8], body: &[u8], signature: &str) -> bool {
    let expected = sign_payload(secret, body);
    subtle_constant_time_eq(signature.trim(), expected.as_str())
}

fn subtle_constant_time_eq(left: &str, right: &str) -> bool {
    if left.len() != right.len() {
        return false;
    }
    left.bytes()
        .zip(right.bytes())
        .fold(0u8, |acc, (a, b)| acc | (a ^ b))
        == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signature_round_trip() {
        let secret = b"test-secret";
        let body = br#"{"event":"test"}"#;
        let signature = sign_payload(secret, body);
        assert!(verify_payload(secret, body, &signature));
        assert!(!verify_payload(secret, body, "sha256=deadbeef"));
    }
}
