use argon2::{Argon2, Error as Argon2Error};
use rand::RngCore;
use subtle::ConstantTimeEq;
use thiserror::Error;

const SALT_LEN: usize = 16;
const HASH_LEN: usize = 32;

#[derive(Debug, Error)]
pub enum PasswordError {
    #[error("invalid password")]
    Invalid,
    #[error(transparent)]
    Argon2(#[from] Argon2Error),
}

pub fn hash_password(password: &str) -> Result<Vec<u8>, PasswordError> {
    let mut salt = [0u8; SALT_LEN];
    rand::rng().fill_bytes(&mut salt);
    hash_password_with_salt(password, &salt)
}

/// Deterministic dev seed hash (`devpassword`) for `scripts/seed-dev.sql`.
pub fn dev_seed_password_hash() -> Vec<u8> {
    const DEV_SALT: [u8; SALT_LEN] = *b"epure-dev-salt!!";
    hash_password_with_salt("devpassword", &DEV_SALT).expect("dev seed password hash")
}

fn hash_password_with_salt(
    password: &str,
    salt: &[u8; SALT_LEN],
) -> Result<Vec<u8>, PasswordError> {
    let mut hash = [0u8; HASH_LEN];
    Argon2::default().hash_password_into(password.as_bytes(), salt, &mut hash)?;

    let mut out = Vec::with_capacity(SALT_LEN + HASH_LEN);
    out.extend_from_slice(salt);
    out.extend_from_slice(&hash);
    Ok(out)
}

pub fn verify_password(password: &str, stored: &[u8]) -> Result<bool, PasswordError> {
    if stored.len() != SALT_LEN + HASH_LEN {
        return Err(PasswordError::Invalid);
    }

    let (salt, expected) = stored.split_at(SALT_LEN);
    let mut computed = [0u8; HASH_LEN];
    Argon2::default().hash_password_into(password.as_bytes(), salt, &mut computed)?;
    Ok(bool::from(computed.as_slice().ct_eq(expected)))
}

pub async fn hash_password_blocking(password: String) -> Result<Vec<u8>, PasswordError> {
    tokio::task::spawn_blocking(move || hash_password(&password))
        .await
        .map_err(|_| PasswordError::Invalid)?
}

pub async fn verify_password_blocking(
    password: String,
    stored: Vec<u8>,
) -> Result<bool, PasswordError> {
    tokio::task::spawn_blocking(move || verify_password(&password, &stored))
        .await
        .map_err(|_| PasswordError::Invalid)?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_and_verify_roundtrip() {
        let hash = hash_password("devpassword").expect("hash");
        assert!(verify_password("devpassword", &hash).expect("verify"));
        assert!(!verify_password("wrong", &hash).expect("verify wrong"));
    }

    #[test]
    fn dev_seed_password_is_stable() {
        let hash = dev_seed_password_hash();
        assert!(verify_password("devpassword", &hash).expect("verify dev seed"));
    }
}
