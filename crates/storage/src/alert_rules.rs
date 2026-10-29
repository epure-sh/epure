use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
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
    pub triggers: sqlx::types::Json<Vec<serde_json::Value>>,
    pub condition_match: String,
    pub conditions: sqlx::types::Json<Vec<serde_json::Value>>,
    pub payload_options: sqlx::types::Json<serde_json::Value>,
    pub channel_ids: Vec<Uuid>,
    pub cooldown_mins: i32,
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
    pub triggers: Vec<serde_json::Value>,
    pub condition_match: String,
    pub conditions: Vec<serde_json::Value>,
    pub payload_options: serde_json::Value,
    pub channel_ids: Vec<Uuid>,
    pub cooldown_mins: i32,
}

pub struct UpdateAlertRuleParams {
    pub name: Option<String>,
    pub enabled: Option<bool>,
    pub environment: Option<Option<String>>,
    pub threshold: Option<Option<i32>>,
    pub filters_json: Option<AlertRuleFilters>,
    pub triggers: Option<Vec<serde_json::Value>>,
    pub condition_match: Option<String>,
    pub conditions: Option<Vec<serde_json::Value>>,
    pub payload_options: Option<serde_json::Value>,
    pub channel_ids: Option<Vec<Uuid>>,
    pub cooldown_mins: Option<i32>,
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
        SELECT id, org_id, project_id, name, enabled, kind, environment, threshold, filters_json,
               triggers, condition_match, conditions, payload_options, channel_ids, cooldown_mins, created_at
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
        SELECT id, org_id, project_id, name, enabled, kind, environment, threshold, filters_json,
               triggers, condition_match, conditions, payload_options, channel_ids, cooldown_mins, created_at
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
        SELECT id, org_id, project_id, name, enabled, kind, environment, threshold, filters_json,
               triggers, condition_match, conditions, payload_options, channel_ids, cooldown_mins, created_at
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
        INSERT INTO alert_rules (
            org_id, project_id, name, kind, environment, threshold, filters_json, enabled,
            triggers, condition_match, conditions, payload_options, channel_ids, cooldown_mins
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id, org_id, project_id, name, enabled, kind, environment, threshold, filters_json,
                  triggers, condition_match, conditions, payload_options, channel_ids, cooldown_mins, created_at
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
    .bind(sqlx::types::Json(params.triggers))
    .bind(&params.condition_match)
    .bind(sqlx::types::Json(params.conditions))
    .bind(sqlx::types::Json(params.payload_options))
    .bind(&params.channel_ids)
    .bind(params.cooldown_mins)
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
            filters_json = COALESCE($8, filters_json),
            triggers = COALESCE($9, triggers),
            condition_match = COALESCE($10, condition_match),
            conditions = COALESCE($11, conditions),
            payload_options = COALESCE($12, payload_options),
            channel_ids = COALESCE($13, channel_ids),
            cooldown_mins = COALESCE($14, cooldown_mins)
        WHERE id = $1
        RETURNING id, org_id, project_id, name, enabled, kind, environment, threshold, filters_json,
                  triggers, condition_match, conditions, payload_options, channel_ids, cooldown_mins, created_at
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
    .bind(params.triggers.map(sqlx::types::Json))
    .bind(&params.condition_match)
    .bind(params.conditions.map(sqlx::types::Json))
    .bind(params.payload_options.map(sqlx::types::Json))
    .bind(&params.channel_ids)
    .bind(params.cooldown_mins)
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

/// Fields the ingest worker can check without another query.
#[derive(Debug, Clone)]
pub struct SentenceContext<'a> {
    pub event: &'a str,
    pub is_new: bool,
    pub level: Option<&'a str>,
    pub environment: Option<&'a str>,
    pub title: Option<&'a str>,
    pub release: Option<&'a str>,
    pub platform: Option<&'a str>,
    pub culprit: Option<&'a str>,
    pub exception_type: Option<&'a str>,
    pub priority: Option<&'a str>,
    pub unhandled: bool,
    pub event_count: i64,
    pub user_count: i32,
    pub regressed_count: i32,
    pub status: Option<&'a str>,
}

/// Legacy rules with an empty sentence still run only on their stored kind.
/// A sentence runs on the pass each trigger can hear.
pub fn sentence_listens(rule: &AlertRuleRow, kind: &str) -> bool {
    if rule.triggers.is_empty() {
        return rule.kind == kind;
    }
    let came_back = came_back_yes(&rule.conditions);
    rule.triggers
        .iter()
        .any(|trigger| trigger_hears(trigger, kind, came_back, &rule.kind))
}

fn came_back_yes(conditions: &[serde_json::Value]) -> bool {
    conditions.iter().any(|condition| {
        condition.get("field").and_then(|value| value.as_str()) == Some("came_back")
            && condition
                .get("op")
                .and_then(|value| value.as_str())
                .unwrap_or("is")
                == "is"
            && matches!(
                condition.get("value").and_then(|value| value.as_str()),
                Some("yes" | "true")
            )
    })
}

fn trigger_hears(
    trigger: &serde_json::Value,
    kind: &str,
    came_back: bool,
    rule_kind: &str,
) -> bool {
    match trigger
        .get("type")
        .and_then(|value| value.as_str())
        .unwrap_or("")
    {
        // First fingerprint, unless the rule is "came back", which hears the regression pass.
        "issue_new" if kind == "issue_created" => !came_back,
        "issue_new" if kind == "regression" => came_back,
        "issue_regression" => kind == "regression",
        "issue_count" | "users_affected" | "project_count" => kind == "velocity_spike",
        // Older rows: keep the kind they were saved with, don't fan out.
        "any_event" => rule_kind == kind,
        _ => false,
    }
}

/// True when one stored trigger matches this event and the conditions hold.
pub fn sentence_matches(rule: &AlertRuleRow, ctx: &SentenceContext<'_>) -> bool {
    if rule.triggers.is_empty() {
        return true;
    }
    let triggered = rule
        .triggers
        .iter()
        .any(|trigger| trigger_matches(trigger, ctx));
    if !triggered {
        return false;
    }
    let checks: Vec<bool> = rule
        .conditions
        .iter()
        .map(|item| condition_matches(item, ctx))
        .collect();
    if checks.is_empty() {
        return true;
    }
    if rule.condition_match == "any" {
        checks.iter().any(|item| *item)
    } else {
        checks.iter().all(|item| *item)
    }
}

fn trigger_matches(trigger: &serde_json::Value, ctx: &SentenceContext<'_>) -> bool {
    let kind = trigger
        .get("type")
        .and_then(|value| value.as_str())
        .unwrap_or("");
    match kind {
        // `regression` is heard only by rules whose condition is came back.
        "issue_new" => match ctx.event {
            "issue_created" => ctx.is_new,
            "regression" => true,
            _ => false,
        },
        "issue_regression" => ctx.event == "regression",
        "priority_escalated" => matches!(ctx.priority, Some("high" | "critical")),
        "any_event" => true,
        "issue_count" => count_compare(trigger, ctx.event_count),
        "users_affected" => count_compare(trigger, i64::from(ctx.user_count)),
        "project_count" => ctx.event == "velocity_spike",
        _ => false,
    }
}

/// `gt` / `lt` / `eq` are the sentence. A stored count with no op keeps `>=`.
fn count_compare(trigger: &serde_json::Value, actual: i64) -> bool {
    let threshold = trigger
        .get("threshold")
        .and_then(|value| value.as_i64())
        .unwrap_or(1);
    match trigger.get("op").and_then(|value| value.as_str()) {
        Some("gt") => actual > threshold,
        Some("lt") => actual < threshold,
        Some("eq") => actual == threshold,
        _ => actual >= threshold,
    }
}

fn condition_matches(condition: &serde_json::Value, ctx: &SentenceContext<'_>) -> bool {
    let field = condition
        .get("field")
        .and_then(|value| value.as_str())
        .unwrap_or("");
    let op = condition
        .get("op")
        .and_then(|value| value.as_str())
        .unwrap_or("is");
    let expected = condition
        .get("value")
        .and_then(|value| value.as_str())
        .unwrap_or("");
    let actual = match field {
        "level" => ctx.level,
        "environment" => ctx.environment,
        "title" => ctx.title,
        "release" => ctx.release,
        "platform" => ctx.platform,
        "culprit" => ctx.culprit,
        "exception_type" => ctx.exception_type,
        "priority" => ctx.priority,
        "is_unhandled" => Some(if ctx.unhandled { "true" } else { "false" }),
        "came_back" => {
            let yes = ctx.event == "regression" || ctx.status == Some("regression");
            let want = matches!(expected, "yes" | "true");
            return op == "is" && yes == want;
        }
        "regressed_count" => return number_op(op, i64::from(ctx.regressed_count), expected),
        "user.email"
        | "user_key"
        | "transaction_name"
        | "request.url"
        | "request.method"
        | "contexts.browser.name"
        | "contexts.os.name"
        | "contexts.runtime.name"
        | "tags.plan"
        | "tags.tenant" => return false,
        _ => return false,
    };
    text_op(op, actual, expected)
}

fn text_op(op: &str, actual: Option<&str>, expected: &str) -> bool {
    match op {
        "exists" | "is_not_null" => actual.is_some_and(|value| !value.is_empty()),
        "is" | "equals" => actual.is_some_and(|value| value.eq_ignore_ascii_case(expected)),
        "is_not" => actual.is_some_and(|value| !value.eq_ignore_ascii_case(expected)),
        "contains" => actual.is_some_and(|value| {
            value
                .to_ascii_lowercase()
                .contains(&expected.to_ascii_lowercase())
        }),
        "not_contains" => actual.is_some_and(|value| {
            !value
                .to_ascii_lowercase()
                .contains(&expected.to_ascii_lowercase())
        }),
        "starts_with" => actual.is_some_and(|value| {
            value
                .to_ascii_lowercase()
                .starts_with(&expected.to_ascii_lowercase())
        }),
        "ends_with" => actual.is_some_and(|value| {
            value
                .to_ascii_lowercase()
                .ends_with(&expected.to_ascii_lowercase())
        }),
        "at_least" => actual.is_some_and(|value| rank(value) >= rank(expected)),
        "is_one_of" => actual.is_some_and(|value| {
            expected
                .split(',')
                .any(|part| value.eq_ignore_ascii_case(part.trim()))
        }),
        _ => false,
    }
}

fn number_op(op: &str, actual: i64, expected: &str) -> bool {
    let expected = expected.parse::<i64>().unwrap_or(0);
    match op {
        "gt" => actual > expected,
        "is" | "equals" => actual == expected,
        _ => false,
    }
}

fn rank(value: &str) -> i32 {
    match value.to_ascii_lowercase().as_str() {
        "fatal" | "critical" => 50,
        "error" | "high" => 40,
        "warning" | "medium" => 30,
        "info" | "low" => 20,
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

#[derive(Debug, sqlx::FromRow, serde::Serialize, Clone)]
pub struct AlertChannelRow {
    pub id: Uuid,
    pub org_id: Uuid,
    pub project_id: Uuid,
    pub provider: String,
    pub label: String,
    pub config: sqlx::types::Json<serde_json::Value>,
    pub is_enabled: bool,
    pub last_error: Option<String>,
    pub last_tested_at: Option<DateTime<Utc>>,
    pub last_test_status: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Public channel shape — secrets and raw webhook URLs stripped.
#[derive(Debug, serde::Serialize, Clone)]
pub struct AlertChannelPublic {
    pub id: Uuid,
    pub org_id: Uuid,
    pub project_id: Uuid,
    pub provider: String,
    pub label: String,
    pub config: serde_json::Value,
    pub is_enabled: bool,
    pub last_error: Option<String>,
    pub last_tested_at: Option<DateTime<Utc>>,
    pub last_test_status: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, serde::Serialize, Clone)]
pub struct CreatedAlertChannel {
    #[serde(flatten)]
    pub channel: AlertChannelPublic,
    /// Present once for Slack/Discord/webhook creates (linked webhook secret).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signing_secret: Option<String>,
}

pub struct CreateChannelParams {
    pub project_id: Uuid,
    pub provider: String,
    pub label: String,
    pub config: serde_json::Value,
    pub is_enabled: bool,
}

const CHANNEL_SELECT: &str = r#"
    id, org_id, project_id, provider, label, config, is_enabled,
    last_error, last_tested_at, last_test_status, created_at
"#;

pub fn validate_provider(provider: &str) -> bool {
    matches!(
        provider,
        "slack" | "discord" | "telegram" | "email" | "webhook"
    )
}

pub fn webhook_format_for_provider(provider: &str) -> Option<&'static str> {
    match provider {
        "slack" => Some("slack"),
        "discord" => Some("discord"),
        "webhook" => Some("generic"),
        _ => None,
    }
}

/// Mask a destination URL for list/detail responses (host + truncated path).
pub fn mask_destination_url(url: &str) -> String {
    let trimmed = url.trim();
    let without_scheme = trimmed
        .strip_prefix("https://")
        .or_else(|| trimmed.strip_prefix("http://"))
        .unwrap_or(trimmed);
    let (host, rest) = match without_scheme.split_once('/') {
        Some((host, path)) => (host, path),
        None => (without_scheme, ""),
    };
    if host.is_empty() {
        return "••••".to_string();
    }
    if rest.is_empty() {
        return host.to_string();
    }
    let short = if rest.len() > 16 {
        format!("/{}…", &rest[..16])
    } else {
        format!("/{rest}")
    };
    format!("{host}{short}")
}

pub fn sanitize_channel_config(provider: &str, config: &serde_json::Value) -> serde_json::Value {
    let mut out = serde_json::Map::new();
    if let Some(webhook_id) = config.get("webhook_id").cloned() {
        out.insert("webhook_id".into(), webhook_id);
    }
    if let Some(format) = config.get("format").cloned() {
        out.insert("format".into(), format);
    }
    if let Some(preview) = config.get("destination_preview").cloned() {
        out.insert("destination_preview".into(), preview);
    } else if let Some(url) = config.get("url").and_then(|v| v.as_str()) {
        out.insert(
            "destination_preview".into(),
            serde_json::Value::String(mask_destination_url(url)),
        );
    }
    if provider == "email" {
        if let Some(recipients) = config.get("recipients").cloned() {
            out.insert("recipients".into(), recipients);
        }
    }
    if provider == "telegram" {
        if let Some(chat_id) = config.get("chat_id").cloned() {
            out.insert("chat_id".into(), chat_id);
        }
        // Never expose bot_token in API responses.
    }
    if let Some(secret_prefix) = config.get("secret_prefix").cloned() {
        out.insert("secret_prefix".into(), secret_prefix);
    }
    serde_json::Value::Object(out)
}

pub fn channel_to_public(row: &AlertChannelRow) -> AlertChannelPublic {
    AlertChannelPublic {
        id: row.id,
        org_id: row.org_id,
        project_id: row.project_id,
        provider: row.provider.clone(),
        label: row.label.clone(),
        config: sanitize_channel_config(&row.provider, &row.config.0),
        is_enabled: row.is_enabled,
        last_error: row.last_error.clone(),
        last_tested_at: row.last_tested_at,
        last_test_status: row.last_test_status.clone(),
        created_at: row.created_at,
    }
}

pub fn channel_webhook_id(config: &serde_json::Value) -> Option<Uuid> {
    config
        .get("webhook_id")
        .and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok())
}

pub fn channel_email_recipients(config: &serde_json::Value) -> Vec<String> {
    config
        .get("recipients")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

pub fn channel_telegram_credentials(config: &serde_json::Value) -> Option<(String, String)> {
    let bot_token = config
        .get("bot_token")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())?
        .to_string();
    let chat_id = config
        .get("chat_id")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())?
        .to_string();
    Some((bot_token, chat_id))
}

pub async fn list_channels(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
) -> Result<Vec<AlertChannelRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let rows = sqlx::query_as::<_, AlertChannelRow>(&format!(
        r#"
        SELECT {CHANNEL_SELECT}
        FROM alert_channels
        WHERE project_id = $1
        ORDER BY created_at ASC
        "#
    ))
    .bind(project_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

pub async fn list_channels_for_org(
    pool: &PgPool,
    org_id: Uuid,
) -> Result<Vec<AlertChannelRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let rows = sqlx::query_as::<_, AlertChannelRow>(&format!(
        r#"
        SELECT {CHANNEL_SELECT}
        FROM alert_channels
        ORDER BY created_at DESC
        "#
    ))
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

pub async fn get_channel(
    pool: &PgPool,
    org_id: Uuid,
    channel_id: Uuid,
) -> Result<Option<AlertChannelRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, AlertChannelRow>(&format!(
        r#"
        SELECT {CHANNEL_SELECT}
        FROM alert_channels
        WHERE id = $1
        "#
    ))
    .bind(channel_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

/// Ingest-path load for rule dispatch (no dashboard session).
pub async fn get_channels_by_ids_ingest(
    pool: &PgPool,
    org_id: Uuid,
    channel_ids: &[Uuid],
) -> Result<Vec<AlertChannelRow>, sqlx::Error> {
    if channel_ids.is_empty() {
        return Ok(Vec::new());
    }
    let mut tx = crate::rls::begin_ingest_transaction(pool, org_id).await?;
    let rows = sqlx::query_as::<_, AlertChannelRow>(&format!(
        r#"
        SELECT {CHANNEL_SELECT}
        FROM alert_channels
        WHERE id = ANY($1)
          AND is_enabled = true
        "#
    ))
    .bind(channel_ids)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

pub async fn create_channel(
    pool: &PgPool,
    org_id: Uuid,
    params: CreateChannelParams,
) -> Result<AlertChannelRow, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, AlertChannelRow>(&format!(
        r#"
        INSERT INTO alert_channels (org_id, project_id, provider, label, config, is_enabled)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING {CHANNEL_SELECT}
        "#
    ))
    .bind(org_id)
    .bind(params.project_id)
    .bind(&params.provider)
    .bind(&params.label)
    .bind(sqlx::types::Json(&params.config))
    .bind(params.is_enabled)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

pub async fn set_channel_test_result(
    pool: &PgPool,
    org_id: Uuid,
    channel_id: Uuid,
    status: &str,
    error: Option<&str>,
    enable_on_ok: bool,
) -> Result<Option<AlertChannelRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, AlertChannelRow>(&format!(
        r#"
        UPDATE alert_channels
        SET last_tested_at = now(),
            last_test_status = $2,
            last_error = $3,
            is_enabled = CASE
                WHEN $4 AND $2 = 'ok' THEN true
                ELSE is_enabled
            END
        WHERE id = $1
        RETURNING {CHANNEL_SELECT}
        "#
    ))
    .bind(channel_id)
    .bind(status)
    .bind(error)
    .bind(enable_on_ok)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

pub async fn set_channel_enabled(
    pool: &PgPool,
    org_id: Uuid,
    channel_id: Uuid,
    enabled: bool,
) -> Result<Option<AlertChannelRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, AlertChannelRow>(&format!(
        r#"
        UPDATE alert_channels
        SET is_enabled = $2
        WHERE id = $1
        RETURNING {CHANNEL_SELECT}
        "#
    ))
    .bind(channel_id)
    .bind(enabled)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

pub async fn delete_channel(
    pool: &PgPool,
    org_id: Uuid,
    channel_id: Uuid,
) -> Result<Option<AlertChannelRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, AlertChannelRow>(&format!(
        r#"
        DELETE FROM alert_channels
        WHERE id = $1
        RETURNING {CHANNEL_SELECT}
        "#
    ))
    .bind(channel_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

pub async fn channel_ready(
    pool: &PgPool,
    org_id: Uuid,
    channel_id: Uuid,
) -> Result<Option<bool>, sqlx::Error> {
    let row = get_channel(pool, org_id, channel_id).await?;
    Ok(row.map(|r| r.is_enabled))
}

/// True when a custom rule fired within the last `cooldown_mins` for the same rule+issue.
pub async fn rule_in_cooldown(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    rule_id: Uuid,
    issue_id: Option<Uuid>,
    cooldown_mins: i32,
) -> Result<bool, sqlx::Error> {
    if cooldown_mins <= 0 {
        return Ok(false);
    }
    let mut tx = crate::rls::begin_ingest_transaction(pool, org_id).await?;
    let recent: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1
            FROM alerts
            WHERE project_id = $1
              AND kind = 'custom'
              AND issue_id IS NOT DISTINCT FROM $2
              AND payload_json->>'rule_id' = $3
              AND created_at > now() - ($4::text || ' minutes')::interval
        )
        "#,
    )
    .bind(project_id)
    .bind(issue_id)
    .bind(rule_id.to_string())
    .bind(cooldown_mins.to_string())
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(recent)
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
            triggers: sqlx::types::Json(Vec::new()),
            condition_match: "all".into(),
            conditions: sqlx::types::Json(Vec::new()),
            payload_options: sqlx::types::Json(serde_json::json!({})),
            channel_ids: Vec::new(),
            cooldown_mins: 30,
            created_at: Utc::now(),
        }
    }

    #[test]
    fn production_crash_sentence_requires_unhandled_prod() {
        let mut rule = sample_rule(None, None);
        rule.triggers = sqlx::types::Json(vec![serde_json::json!({"type": "issue_new"})]);
        rule.conditions = sqlx::types::Json(vec![
            serde_json::json!({"field": "environment", "op": "is", "value": "production"}),
            serde_json::json!({"field": "is_unhandled", "op": "is", "value": "true"}),
        ]);
        let mut ctx = SentenceContext {
            event: "issue_created",
            is_new: true,
            level: Some("error"),
            environment: Some("production"),
            title: Some("TypeError"),
            release: None,
            platform: Some("node"),
            culprit: None,
            exception_type: Some("TypeError"),
            priority: Some("high"),
            unhandled: true,
            event_count: 1,
            user_count: 1,
            regressed_count: 0,
            status: Some("unresolved"),
        };
        assert!(sentence_matches(&rule, &ctx));
        ctx.unhandled = false;
        assert!(!sentence_matches(&rule, &ctx));
        ctx.unhandled = true;
        ctx.environment = Some("staging");
        assert!(!sentence_matches(&rule, &ctx));
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

    #[test]
    fn alert_rule_filters_serde_roundtrip_preserves_extra_fields() {
        let raw = serde_json::json!({
            "min_level": "error",
            "first_seen": "new",
            "query": "release:v1.2.0 tag:service:billing",
            "cooldown_minutes": 30,
            "custom_agent_id": "agent-42",
            "notify_slack_channel": "#alerts-prod",
            "arbitrary_tags": ["high_priority", "backend"]
        });

        let parsed: AlertRuleFilters = serde_json::from_value(raw.clone()).expect("parse filters");
        assert_eq!(parsed.min_level.as_deref(), Some("error"));
        assert_eq!(parsed.first_seen.as_deref(), Some("new"));
        assert_eq!(
            parsed.query.as_deref(),
            Some("release:v1.2.0 tag:service:billing")
        );
        assert_eq!(parsed.cooldown_minutes, Some(30));
        assert_eq!(
            parsed.extra.get("custom_agent_id"),
            Some(&serde_json::json!("agent-42"))
        );
        assert_eq!(
            parsed.extra.get("notify_slack_channel"),
            Some(&serde_json::json!("#alerts-prod"))
        );

        let reserialized = serde_json::to_value(&parsed).expect("serialize filters");
        assert_eq!(reserialized, raw);

        // Empty json defaults cleanly
        let empty: AlertRuleFilters = serde_json::from_str("{}").expect("empty parse");
        assert_eq!(empty, AlertRuleFilters::default());
    }

    fn event_ctx<'a>(event: &'a str, status: &'a str, event_count: i64) -> SentenceContext<'a> {
        SentenceContext {
            event,
            is_new: event == "issue_created",
            level: Some("error"),
            environment: Some("production"),
            title: None,
            release: None,
            platform: None,
            culprit: None,
            exception_type: None,
            priority: Some("high"),
            unhandled: true,
            event_count,
            user_count: 4,
            regressed_count: if status == "regression" { 1 } else { 0 },
            status: Some(status),
        }
    }

    #[test]
    fn issue_count_uses_greater_less_or_equal() {
        let mut rule = sample_rule(None, None);
        rule.kind = "velocity_spike".into();
        rule.triggers = sqlx::types::Json(vec![
            serde_json::json!({"type": "issue_count", "op": "gt", "threshold": 100, "window": "5m"}),
        ]);
        let ctx = event_ctx("velocity_spike", "unresolved", 100);
        assert!(!sentence_matches(&rule, &ctx));
        let over = event_ctx("velocity_spike", "unresolved", 101);
        assert!(sentence_matches(&rule, &over));

        rule.triggers = sqlx::types::Json(vec![
            serde_json::json!({"type": "issue_count", "op": "eq", "threshold": 100}),
        ]);
        assert!(sentence_matches(&rule, &ctx));

        rule.triggers = sqlx::types::Json(vec![
            serde_json::json!({"type": "issue_count", "op": "lt", "threshold": 100}),
        ]);
        let under = event_ctx("velocity_spike", "unresolved", 99);
        assert!(sentence_matches(&rule, &under));
        assert!(!sentence_matches(&rule, &ctx));
    }

    #[test]
    fn legacy_count_without_op_is_at_least() {
        let mut rule = sample_rule(None, None);
        rule.triggers = sqlx::types::Json(vec![
            serde_json::json!({"type": "issue_count", "threshold": 100}),
        ]);
        let exact = event_ctx("velocity_spike", "unresolved", 100);
        assert!(sentence_matches(&rule, &exact));
        let under = event_ctx("velocity_spike", "unresolved", 99);
        assert!(!sentence_matches(&rule, &under));
    }

    #[test]
    fn came_back_condition_matches_a_regression() {
        let mut rule = sample_rule(None, None);
        rule.kind = "regression".into();
        rule.triggers = sqlx::types::Json(vec![serde_json::json!({"type": "issue_new"})]);
        rule.conditions = sqlx::types::Json(vec![
            serde_json::json!({"field": "came_back", "op": "is", "value": "yes"}),
        ]);
        let back = event_ctx("regression", "regression", 12);
        assert!(sentence_matches(&rule, &back));
        let fresh = event_ctx("issue_created", "unresolved", 1);
        assert!(!sentence_matches(&rule, &fresh));
        assert!(sentence_listens(&rule, "regression"));
        assert!(!sentence_listens(&rule, "issue_created"));
    }

    #[test]
    fn new_issue_rule_does_not_hear_a_regression() {
        let mut rule = sample_rule(None, None);
        rule.kind = "issue_created".into();
        rule.triggers = sqlx::types::Json(vec![serde_json::json!({"type": "issue_new"})]);
        assert!(sentence_listens(&rule, "issue_created"));
        assert!(!sentence_listens(&rule, "regression"));
        assert!(!sentence_listens(&rule, "velocity_spike"));
    }

    #[test]
    fn count_or_new_hears_both_passes() {
        let mut rule = sample_rule(None, None);
        rule.kind = "velocity_spike".into();
        rule.triggers = sqlx::types::Json(vec![
            serde_json::json!({"type": "issue_new"}),
            serde_json::json!({"type": "users_affected", "op": "gt", "threshold": 25, "window": "1h"}),
        ]);
        assert!(sentence_listens(&rule, "issue_created"));
        assert!(sentence_listens(&rule, "velocity_spike"));
        assert!(!sentence_listens(&rule, "regression"));
        let users = event_ctx("velocity_spike", "unresolved", 10);
        assert!(!sentence_matches(&rule, &users));
        let mut many = users.clone();
        many.user_count = 26;
        assert!(sentence_matches(&rule, &many));
    }
}
