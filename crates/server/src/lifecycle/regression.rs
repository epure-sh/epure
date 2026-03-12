use epure_storage::issues::IssueLifecycleState;

pub fn should_mark_regression(issue: &IssueLifecycleState, incoming_release: Option<&str>) -> bool {
    if issue.status != "resolved" {
        return false;
    }

    let resolved_release = issue
        .resolved_in_release
        .as_deref()
        .or(issue.release.as_deref());
    let Some(incoming) = incoming_release else {
        return false;
    };

    match resolved_release {
        Some(base) => release_gte(incoming, base),
        None => false,
    }
}

pub fn release_gte(left: &str, right: &str) -> bool {
    compare_releases(left, right) >= 0
}

fn compare_releases(left: &str, right: &str) -> i32 {
    let left_parts = parse_release(left);
    let right_parts = parse_release(right);

    for index in 0..left_parts.len().max(right_parts.len()) {
        let left_value = left_parts.get(index).copied().unwrap_or(0);
        let right_value = right_parts.get(index).copied().unwrap_or(0);
        if left_value != right_value {
            return left_value.cmp(&right_value) as i32;
        }
    }

    left.cmp(right) as i32
}

fn parse_release(value: &str) -> Vec<u32> {
    value
        .trim()
        .trim_start_matches(['v', 'V'])
        .split(['.', '-', '_'])
        .filter_map(|part| part.parse::<u32>().ok())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn later_release_is_gte() {
        assert!(release_gte("v1.5.0", "v1.4.0"));
        assert!(release_gte("1.4.1", "1.4.0"));
        assert!(!release_gte("v1.3.9", "v1.4.0"));
    }
}
