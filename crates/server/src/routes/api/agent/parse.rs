use epure_storage::issues::{IssueListFilter, IssueSort};

pub fn parse_issue_query(raw: &str) -> IssueListFilter {
    let mut filter = IssueListFilter::default();
    let mut free_text: Vec<String> = Vec::new();

    for token in raw.split_whitespace() {
        if let Some(value) = token.strip_prefix("is:") {
            if value == "snoozed" {
                filter.snoozed = Some(true);
            } else {
                filter.status = Some(normalize_status(value));
            }
        } else if let Some(value) = token.strip_prefix("env:") {
            filter.environment = Some(value.to_string());
        } else if let Some(value) = token.strip_prefix("release:") {
            filter.release = Some(value.to_string());
        } else if let Some(value) = token.strip_prefix("user.email:") {
            filter.user_email_pattern = Some(value.to_string());
        } else if let Some(value) = token.strip_prefix("level:") {
            filter.level = Some(value.to_string());
        } else {
            free_text.push(token.to_string());
        }
    }

    if !free_text.is_empty() {
        filter.free_text = Some(free_text.join(" "));
    }

    filter
}

fn normalize_status(value: &str) -> String {
    match value {
        "unresolved" | "open" => "unresolved".to_string(),
        "resolved" => "resolved".to_string(),
        "ignored" => "ignored".to_string(),
        "regression" => "regression".to_string(),
        other => other.to_string(),
    }
}

#[allow(dead_code)]
pub fn parse_sort(raw: Option<&str>) -> IssueSort {
    IssueSort::parse(raw)
}
