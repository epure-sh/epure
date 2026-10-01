use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthCredentials {
    pub public_key: String,
    pub secret_key: Option<String>,
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

    match query_key {
        Some(public_key) if !public_key.is_empty() => Ok(AuthCredentials {
            public_key: public_key.to_string(),
            secret_key: query_secret
                .filter(|secret_key| !secret_key.is_empty())
                .map(ToOwned::to_owned),
        }),
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

    match public_key {
        Some(public_key) => Ok(AuthCredentials {
            public_key,
            secret_key: secret_key.filter(|secret_key| !secret_key.is_empty()),
        }),
        _ => Err(AuthError::MalformedHeader),
    }
}

#[cfg(test)]
mod tests {
    use super::{parse_auth, AuthCredentials, AuthError};

    #[test]
    fn parses_header_without_secret_key() {
        let parsed = parse_auth(
            Some("Sentry sentry_version=7, sentry_key=public123, sentry_client=test/1.0"),
            None,
            None,
        )
        .expect("auth");

        assert_eq!(
            parsed,
            AuthCredentials {
                public_key: "public123".to_string(),
                secret_key: None,
            }
        );
    }

    #[test]
    fn parses_query_without_secret_key() {
        let parsed = parse_auth(None, Some("public123"), None).expect("auth");

        assert_eq!(
            parsed,
            AuthCredentials {
                public_key: "public123".to_string(),
                secret_key: None,
            }
        );
    }

    #[test]
    fn rejects_missing_public_key() {
        let err = parse_auth(None, None, Some("secret")).expect_err("missing key");
        assert!(matches!(err, AuthError::Missing));
    }
}
