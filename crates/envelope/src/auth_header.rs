use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthCredentials {
    pub public_key: String,
    pub secret_key: String,
}

#[derive(Debug, Error)]
pub enum AuthError {
    #[error("missing DSN credentials")]
    Missing,
    #[error("malformed X-Sentry-Auth header")]
    MalformedHeader,
}

/// Parse `X-Sentry-Auth` or query `sentry_key` / `sentry_secret`.
pub fn parse_auth(
    header: Option<&str>,
    query_key: Option<&str>,
    query_secret: Option<&str>,
) -> Result<AuthCredentials, AuthError> {
    if let Some(header) = header {
        return parse_sentry_auth_header(header);
    }

    match (query_key, query_secret) {
        (Some(public_key), Some(secret_key)) if !public_key.is_empty() && !secret_key.is_empty() => {
            Ok(AuthCredentials {
                public_key: public_key.to_string(),
                secret_key: secret_key.to_string(),
            })
        }
        _ => Err(AuthError::Missing),
    }
}

fn parse_sentry_auth_header(header: &str) -> Result<AuthCredentials, AuthError> {
    let header = header.trim();
    let payload = header
        .strip_prefix("Sentry ")
        .or_else(|| header.strip_prefix("sentry "))
        .ok_or(AuthError::MalformedHeader)?;

    let mut public_key = None;
    let mut secret_key = None;

    for part in payload.split(',') {
        let part = part.trim();
        if let Some(value) = part.strip_prefix("sentry_key=") {
            public_key = Some(value.trim().to_string());
        } else if let Some(value) = part.strip_prefix("sentry_secret=") {
            secret_key = Some(value.trim().to_string());
        }
    }

    match (public_key, secret_key) {
        (Some(public_key), Some(secret_key)) => Ok(AuthCredentials {
            public_key,
            secret_key,
        }),
        _ => Err(AuthError::MalformedHeader),
    }
}
