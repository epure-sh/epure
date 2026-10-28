use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
pub struct AlertRuleFilters {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_level: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub first_seen: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub query: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cooldown_minutes: Option<i32>,
    #[serde(default, flatten)]
    pub extra: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Debug, sqlx::FromRow, serde::Serialize, Clone)]
pub struct AlertRuleRow {
    pub id: Uuid,
    pub org_id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    pub enabled: bool,
    pub kind: String,
    pub environment: Option<String>,
    pub threshold: Option<i32>,
    pub filters_json: sqlx::types::Json<AlertRuleFilters>,
    pub created_at: DateTime<Utc>,
}

pub struct CreateAlertRuleParams {
    pub project_id: Uuid,
    pub name: String,
    pub kind: String,
    pub environment: Option<String>,
    pub threshold: Option<i32>,
    pub filters_json: AlertRuleFilters,
    pub enabled: bool,
}

pub struct UpdateAlertRuleParams {
    pub name: Option<String>,
    pub enabled: Option<bool>,
    pub environment: Option<Option<String>>,
    pub threshold: Option<Option<i32>>,
    pub filters_json: Option<AlertRuleFilters>,
}

pub fn validate_kind(kind: &str) -> bool {
    matches!(kind, "velocity_spike" | "regression" | "issue_created")
}

pub async fn list_for_project(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
) -> Result<Vec<AlertRuleRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let rows = sqlx::query_as::<_, AlertRuleRow>(
        r#"
        SELECT id, org_id, project_id, name, enabled, kind, environment, threshold, filters_json, created_at
        FROM alert_rules
        WHERE project_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(project_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

pub async fn list_for_org(pool: &PgPool, org_id: Uuid) -> Result<Vec<AlertRuleRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let rows = sqlx::query_as::<_, AlertRuleRow>(
        r#"
        SELECT id, org_id, project_id, name, enabled, kind, environment, threshold, filters_json, created_at
        FROM alert_rules
        ORDER BY created_at ASC
        "#,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

pub async fn list_enabled_for_project_ingest(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
) -> Result<Vec<AlertRuleRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_ingest_transaction(pool, org_id).await?;
    let rows = sqlx::query_as::<_, AlertRuleRow>(
        r#"
        SELECT id, org_id, project_id, name, enabled, kind, environment, threshold, filters_json, created_at
        FROM alert_rules
        WHERE project_id = $1 AND enabled = true
        ORDER BY created_at ASC
        "#,
    )
    .bind(project_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

pub async fn create_rule(
    pool: &PgPool,
    org_id: Uuid,
    params: CreateAlertRuleParams,
) -> Result<AlertRuleRow, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, AlertRuleRow>(
        r#"
        INSERT INTO alert_rules (org_id, project_id, name, kind, environment, threshold, filters_json, enabled)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, org_id, project_id, name, enabled, kind, environment, threshold, filters_json, created_at
        "#,
    )
    .bind(org_id)
    .bind(params.project_id)
    .bind(&params.name)
    .bind(&params.kind)
    .bind(&params.environment)
    .bind(params.threshold)
    .bind(sqlx::types::Json(params.filters_json))
    .bind(params.enabled)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

pub async fn update_rule(
    pool: &PgPool,
    org_id: Uuid,
    rule_id: Uuid,
    params: UpdateAlertRuleParams,
) -> Result<Option<AlertRuleRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, AlertRuleRow>(
        r#"
        UPDATE alert_rules
        SET
            name = COALESCE($2, name),
            enabled = COALESCE($3, enabled),
            environment = CASE WHEN $4 THEN $5 ELSE environment END,
            threshold = CASE WHEN $6 THEN $7 ELSE threshold END,
            filters_json = COALESCE($8, filters_json)
        WHERE id = $1
        RETURNING id, org_id, project_id, name, enabled, kind, environment, threshold, filters_json, created_at
        "#,
    )
    .bind(rule_id)
    .bind(&params.name)
    .bind(params.enabled)
    .bind(params.environment.is_some())
    .bind(params.environment.clone().flatten())
    .bind(params.threshold.is_some())
    .bind(params.threshold.flatten())
    .bind(
        params
            .filters_json
            .map(sqlx::types::Json),
    )
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

pub async fn delete_rule(pool: &PgPool, org_id: Uuid, rule_id: Uuid) -> Result<bool, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let result = sqlx::query("DELETE FROM alert_rules WHERE id = $1")
        .bind(rule_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(result.rows_affected() > 0)
}

pub fn rule_matches_environment(rule: &AlertRuleRow, environment: Option<&str>) -> bool {
    match rule.environment.as_deref() {
        None | Some("") => true,
        Some(expected) => environment.is_some_and(|value| value == expected),
    }
}

pub fn velocity_ratio_exceeds(rule: &AlertRuleRow, ratio: f64) -> bool {
    let percent = rule.threshold.unwrap_or(300).max(0) as f64;
    ratio > 1.0 + (percent / 100.0)
}

fn level_rank(level: &str) -> i32 {
    match level.to_ascii_lowercase().as_str() {
        "fatal" => 50,
        "error" => 40,
        "warning" => 30,
        "info" => 20,
        "debug" => 10,
        _ => 0,
    }
}

/// `first_seen: "new"` limits `issue_created` rules to the first event on a fingerprint.
pub fn rule_matches_filters(
    rule: &AlertRuleRow,
    is_new_fingerprint: bool,
    issue_level: Option<&str>,
) -> bool {
    match rule.filters_json.first_seen.as_deref() {
        Some("new") if !is_new_fingerprint => return false,
        _ => {}
    }
    match rule.filters_json.min_level.as_deref() {
        None | Some("") | Some("any") => true,
        Some(min) => issue_level.is_some_and(|level| level_rank(level) >= level_rank(min)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_rule(first_seen: Option<&str>, min_level: Option<&str>) -> AlertRuleRow {
        AlertRuleRow {
            id: Uuid::nil(),
            org_id: Uuid::nil(),
            project_id: Uuid::nil(),
            name: "test".into(),
            enabled: true,
            kind: "issue_created".into(),
            environment: None,
            threshold: None,
            filters_json: sqlx::types::Json(AlertRuleFilters {
                min_level: min_level.map(str::to_string),
                first_seen: first_seen.map(str::to_string),
                ..Default::default()
            }),
            created_at: Utc::now(),
        }
    }

    #[test]
    fn first_seen_new_requires_new_fingerprint() {
        let rule = sample_rule(Some("new"), None);
        assert!(!rule_matches_filters(&rule, false, None));
        assert!(rule_matches_filters(&rule, true, None));
    }

    #[test]
    fn min_level_error_requires_error_or_fatal() {
        let rule = sample_rule(None, Some("error"));
        assert!(!rule_matches_filters(&rule, true, Some("warning")));
        assert!(rule_matches_filters(&rule, true, Some("error")));
        assert!(rule_matches_filters(&rule, true, Some("fatal")));
    }
}
