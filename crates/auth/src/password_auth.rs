/// Email/password dashboard sign-in. Unset or empty stays enabled (OSS default).
/// Set `0`, `false`, `no`, `off`, or `disabled` to disable (Epure Cloud: social-only).
pub fn password_auth_enabled() -> bool {
    password_auth_enabled_from(std::env::var("EPURE_PASSWORD_AUTH").ok().as_deref())
}

pub fn password_auth_enabled_from(value: Option<&str>) -> bool {
    let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) else {
        return true;
    };
    !matches!(
        value.to_ascii_lowercase().as_str(),
        "0" | "false" | "no" | "off" | "disabled"
    )
}

#[cfg(test)]
mod tests {
    use super::password_auth_enabled_from;

    #[test]
    fn unset_and_blank_stay_enabled() {
        assert!(password_auth_enabled_from(None));
        assert!(password_auth_enabled_from(Some("")));
        assert!(password_auth_enabled_from(Some("  ")));
    }

    #[test]
    fn explicit_values_disable_password_auth() {
        for value in ["false", "FALSE", "0", "no", "off", "disabled", " false "] {
            assert!(
                !password_auth_enabled_from(Some(value)),
                "{value} should disable password auth"
            );
        }
    }

    #[test]
    fn explicit_values_keep_password_auth_enabled() {
        for value in ["true", "TRUE", "1", "yes", "on"] {
            assert!(
                password_auth_enabled_from(Some(value)),
                "{value} should keep password auth enabled"
            );
        }
    }
}
