/// Public workspace signup. Unset or empty stays open so existing installs
/// keep the register form. `0`, `false`, `no`, `off`, and `disabled` close it.
pub fn registration_enabled() -> bool {
    registration_enabled_from(std::env::var("EPURE_REGISTRATION").ok().as_deref())
}

pub fn registration_enabled_from(value: Option<&str>) -> bool {
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
    use super::registration_enabled_from;

    #[test]
    fn unset_and_blank_stay_open() {
        assert!(registration_enabled_from(None));
        assert!(registration_enabled_from(Some("")));
        assert!(registration_enabled_from(Some("  ")));
    }

    #[test]
    fn explicit_values_close_registration() {
        for value in ["false", "FALSE", "0", "no", "off", "disabled", " false "] {
            assert!(
                !registration_enabled_from(Some(value)),
                "{value} should close registration"
            );
        }
    }

    #[test]
    fn explicit_values_keep_registration_open() {
        for value in ["true", "TRUE", "1", "yes", "on"] {
            assert!(
                registration_enabled_from(Some(value)),
                "{value} should keep registration open"
            );
        }
    }
}
