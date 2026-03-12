use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

pub struct UpsertIssueParams {
    pub org_id: Uuid,
    pub project_id: Uuid,
    pub fingerprint: String,
    pub title: Option<String>,
    pub level: Option<String>,
    pub environment: Option<String>,
    pub release: Option<String>,
    pub occurred_at: DateTime<Utc>,
    pub increment_by: i64,
}

pub async fn upsert_issue(pool: &PgPool, params: UpsertIssueParams) -> Result<Uuid, sqlx::Error> {
    let org_id = params.org_id;
    let mut tx = crate::rls::begin_ingest_transaction(pool, org_id).await?;
    let id = crate::persist::upsert_issue_in_tx(&mut tx, params).await?;
    tx.commit().await?;
    Ok(id)
}

pub fn title_from_event(payload: &Value) -> Option<String> {
    if let Some(values) = payload
        .pointer("/exception/values")
        .and_then(Value::as_array)
    {
        if let Some(first) = values.first() {
            let ty = first.get("type").and_then(Value::as_str).unwrap_or("Error");
            let msg = first.get("value").and_then(Value::as_str).unwrap_or("");
            return Some(format!("{ty}: {msg}"));
        }
    }

    payload
        .get("message")
        .and_then(Value::as_str)
        .map(str::to_string)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TimeWindow {
    Hours24,
    Days7,
    Days14,
    Days30,
    Days90,
}

impl TimeWindow {
    pub fn parse(raw: Option<&str>) -> Self {
        match raw {
            Some("24h") => Self::Hours24,
            Some("14d") => Self::Days14,
            Some("30d") => Self::Days30,
            Some("90d") => Self::Days90,
            _ => Self::Days7,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Hours24 => "24h",
            Self::Days7 => "7d",
            Self::Days14 => "14d",
            Self::Days30 => "30d",
            Self::Days90 => "90d",
        }
    }

    pub fn sql_interval(self) -> &'static str {
        match self {
            Self::Hours24 => "24 hours",
            Self::Days7 => "7 days",
            Self::Days14 => "14 days",
            Self::Days30 => "30 days",
            Self::Days90 => "90 days",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum IssueSort {
    #[default]
    LastSeenDesc,
    LastSeenAsc,
    EventsDesc,
    EventsAsc,
    FirstSeenDesc,
    FirstSeenAsc,
    TitleAsc,
}

impl IssueSort {
    pub fn parse(raw: Option<&str>) -> Self {
        match raw {
            Some("last_seen_asc") => Self::LastSeenAsc,
            Some("events_desc") => Self::EventsDesc,
            Some("events_asc") => Self::EventsAsc,
            Some("first_seen_desc") => Self::FirstSeenDesc,
            Some("first_seen_asc") => Self::FirstSeenAsc,
            Some("title_asc") => Self::TitleAsc,
            _ => Self::LastSeenDesc,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::LastSeenDesc => "last_seen_desc",
            Self::LastSeenAsc => "last_seen_asc",
            Self::EventsDesc => "events_desc",
            Self::EventsAsc => "events_asc",
            Self::FirstSeenDesc => "first_seen_desc",
            Self::FirstSeenAsc => "first_seen_asc",
            Self::TitleAsc => "title_asc",
        }
    }

    pub fn order_by_sql(self) -> &'static str {
        match self {
            Self::LastSeenDesc => "last_seen_at DESC NULLS LAST, created_at DESC",
            Self::LastSeenAsc => "last_seen_at ASC NULLS LAST, created_at ASC",
            Self::EventsDesc => "event_count DESC, last_seen_at DESC NULLS LAST",
            Self::EventsAsc => "event_count ASC, last_seen_at DESC NULLS LAST",
            Self::FirstSeenDesc => "first_seen_at DESC NULLS LAST, created_at DESC",
            Self::FirstSeenAsc => "first_seen_at ASC NULLS LAST, created_at ASC",
            Self::TitleAsc => "title ASC NULLS LAST, last_seen_at DESC NULLS LAST",
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct IssueListFilter {
    pub project_id: Option<Uuid>,
    pub status: Option<String>,
    pub snoozed: Option<bool>,
    pub environment: Option<String>,
    pub release: Option<String>,
    pub level: Option<String>,
    pub user_email_pattern: Option<String>,
    pub free_text: Option<String>,
    pub time_window: Option<TimeWindow>,
    pub sort: Option<IssueSort>,
    pub limit: Option<i64>,
}

pub const MAX_ISSUE_LIST: i64 = 100;
pub const MAX_BULK_IDS: usize = 100;

fn ilike_escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

#[derive(Debug, sqlx::FromRow, serde::Serialize)]
pub struct IssueSummary {
    pub id: Uuid,
    pub org_id: Uuid,
    pub project_id: Uuid,
    pub fingerprint: String,
    pub title: Option<String>,
    pub status: String,
    pub level: Option<String>,
    pub environment: Option<String>,
    pub release: Option<String>,
    pub event_count: i64,
    pub unique_user_count: i32,
    pub last_seen_at: Option<DateTime<Utc>>,
    pub first_seen_at: Option<DateTime<Utc>>,
    pub resolved_in_release: Option<String>,
    pub snoozed: bool,
    pub snooze_until: Option<DateTime<Utc>>,
    pub snooze_until_count: Option<i32>,
    pub snooze_until_users: Option<i32>,
}

pub const SNOOZE_ACTIVE_SQL: &str = r#"
    (
        (snooze_until IS NOT NULL AND snooze_until > now())
        OR (snooze_until_count IS NOT NULL AND event_count < snooze_until_count)
        OR (snooze_until_users IS NOT NULL AND unique_user_count < snooze_until_users)
    )
"#;

const ISSUE_SUMMARY_COLUMNS: &str = r#"
    id,
    org_id,
    project_id,
    fingerprint,
    title,
    status,
    level,
    environment,
    release,
    event_count,
    unique_user_count,
    last_seen_at,
    first_seen_at,
    resolved_in_release,
    snooze_until,
    snooze_until_count,
    snooze_until_users,
    (
        (snooze_until IS NOT NULL AND snooze_until > now())
        OR (snooze_until_count IS NOT NULL AND event_count < snooze_until_count)
        OR (snooze_until_users IS NOT NULL AND unique_user_count < snooze_until_users)
    ) AS snoozed
"#;

pub async fn list_issue_summaries(
    pool: &PgPool,
    org_id: Uuid,
) -> Result<Vec<IssueSummary>, sqlx::Error> {
    list_issues_filtered(pool, org_id, IssueListFilter::default()).await
}

pub async fn list_issues_filtered(
    pool: &PgPool,
    org_id: Uuid,
    filter: IssueListFilter,
) -> Result<Vec<IssueSummary>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    wake_expired_snoozes_in_tx(&mut tx).await?;

    let mut query = format!(
        r#"
        SELECT
            {ISSUE_SUMMARY_COLUMNS}
        FROM issues
        WHERE merge_parent_id IS NULL
        "#,
    );

    let mut bind_index = 0usize;
    let mut uuid_binds: Vec<Uuid> = Vec::new();
    let mut binds: Vec<String> = Vec::new();

    if let Some(project_id) = filter.project_id {
        bind_index += 1;
        uuid_binds.push(project_id);
        query.push_str(&format!(" AND project_id = ${bind_index}"));
    }

    if let Some(status) = filter.status {
        bind_index += 1;
        binds.push(status);
        query.push_str(&format!(" AND status = ${bind_index}"));
        if filter.snoozed != Some(true) {
            query.push_str(&format!(" AND NOT {SNOOZE_ACTIVE_SQL}"));
        }
    }

    if filter.snoozed == Some(true) {
        query.push_str(&format!(" AND {SNOOZE_ACTIVE_SQL}"));
    }

    if let Some(environment) = filter.environment {
        bind_index += 1;
        binds.push(environment);
        query.push_str(&format!(" AND environment = ${bind_index}"));
    }

    if let Some(release) = filter.release {
        bind_index += 1;
        binds.push(release);
        query.push_str(&format!(" AND release = ${bind_index}"));
    }

    if let Some(level) = filter.level {
        bind_index += 1;
        binds.push(level);
        query.push_str(&format!(" AND level = ${bind_index}"));
    }

    if let Some(pattern) = filter.user_email_pattern {
        bind_index += 1;
        let escaped = ilike_escape(&pattern).replace('*', "%");
        binds.push(escaped);
        query.push_str(&format!(
            r#"
            AND EXISTS (
                SELECT 1 FROM events e
                WHERE e.issue_id = issues.id
                  AND e.user_email ILIKE ${bind_index} ESCAPE '\'
            )
            "#
        ));
    }

    if let Some(text) = filter.free_text {
        bind_index += 1;
        binds.push(format!("%{}%", ilike_escape(&text)));
        query.push_str(&format!(" AND title ILIKE ${bind_index} ESCAPE '\\'"));
    }

    if let Some(window) = filter.time_window {
        query.push_str(&format!(
            " AND last_seen_at >= now() - interval '{}'",
            window.sql_interval()
        ));
    }

    let sort = filter.sort.unwrap_or_default();
    query.push_str(&format!(" ORDER BY {}", sort.order_by_sql()));
    let limit = filter
        .limit
        .unwrap_or(MAX_ISSUE_LIST)
        .clamp(1, MAX_ISSUE_LIST);
    bind_index += 1;
    query.push_str(&format!(" LIMIT ${bind_index}"));

    let mut sql = sqlx::query_as::<_, IssueSummary>(&query);
    for value in uuid_binds {
        sql = sql.bind(value);
    }
    for value in binds {
        sql = sql.bind(value);
    }
    sql = sql.bind(limit);

    let rows = sql.fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(rows)
}

pub async fn update_issue_status(
    pool: &PgPool,
    org_id: Uuid,
    issue_id: Uuid,
    status: &str,
) -> Result<Option<IssueSummary>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, IssueSummary>(&format!(
        r#"
        UPDATE issues
        SET status = $2
        WHERE id = $1 AND merge_parent_id IS NULL
        RETURNING
            {ISSUE_SUMMARY_COLUMNS}
        "#,
    ))
    .bind(issue_id)
    .bind(status)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

pub async fn bulk_update_status(
    pool: &PgPool,
    org_id: Uuid,
    issue_ids: &[Uuid],
    status: &str,
) -> Result<u64, sqlx::Error> {
    if issue_ids.is_empty() {
        return Ok(0);
    }
    if issue_ids.len() > MAX_BULK_IDS {
        return Err(sqlx::Error::Protocol("too many issue ids".into()));
    }

    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let result = sqlx::query(
        r#"
        UPDATE issues
        SET status = $2
        WHERE id = ANY($1) AND merge_parent_id IS NULL
        "#,
    )
    .bind(issue_ids)
    .bind(status)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(result.rows_affected())
}

pub async fn bulk_delete_issues(
    pool: &PgPool,
    org_id: Uuid,
    issue_ids: &[Uuid],
) -> Result<u64, sqlx::Error> {
    if issue_ids.is_empty() {
        return Ok(0);
    }
    if issue_ids.len() > MAX_BULK_IDS {
        return Err(sqlx::Error::Protocol("too many issue ids".into()));
    }

    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let result = sqlx::query(
        r#"
        DELETE FROM issues
        WHERE id = ANY($1)
        "#,
    )
    .bind(issue_ids)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(result.rows_affected())
}

pub async fn merge_issues(
    pool: &PgPool,
    org_id: Uuid,
    canonical_id: Uuid,
    merge_ids: &[Uuid],
) -> Result<u64, sqlx::Error> {
    if merge_ids.is_empty() {
        return Ok(0);
    }
    if merge_ids.len() > MAX_BULK_IDS {
        return Err(sqlx::Error::Protocol("too many issue ids".into()));
    }

    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let result = sqlx::query(
        r#"
        UPDATE issues
        SET merge_parent_id = $2
        WHERE id = ANY($1)
          AND id <> $2
          AND merge_parent_id IS NULL
        "#,
    )
    .bind(merge_ids)
    .bind(canonical_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(result.rows_affected())
}

pub async fn list_merged_children(
    pool: &PgPool,
    org_id: Uuid,
    canonical_id: Uuid,
) -> Result<Vec<IssueSummary>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let rows = sqlx::query_as::<_, IssueSummary>(&format!(
        r#"
        SELECT
            {ISSUE_SUMMARY_COLUMNS}
        FROM issues
        WHERE merge_parent_id = $1
        ORDER BY last_seen_at DESC NULLS LAST
        "#,
    ))
    .bind(canonical_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

pub async fn split_issues(
    pool: &PgPool,
    org_id: Uuid,
    canonical_id: Uuid,
    split_ids: &[Uuid],
) -> Result<u64, sqlx::Error> {
    if split_ids.is_empty() {
        return Ok(0);
    }
    if split_ids.len() > MAX_BULK_IDS {
        return Err(sqlx::Error::Protocol("too many issue ids".into()));
    }

    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let result = sqlx::query(
        r#"
        UPDATE issues
        SET merge_parent_id = NULL
        WHERE id = ANY($1)
          AND merge_parent_id = $2
        "#,
    )
    .bind(split_ids)
    .bind(canonical_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(result.rows_affected())
}

pub fn fingerprint_from_event(payload: &Value) -> String {
    epure_envelope::compute_fingerprint(payload)
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct IssueLifecycleState {
    pub id: Uuid,
    pub org_id: Uuid,
    pub project_id: Uuid,
    pub title: Option<String>,
    pub status: String,
    pub release: Option<String>,
    pub environment: Option<String>,
    pub event_count: i64,
    pub unique_user_count: i32,
    pub resolved_in_release: Option<String>,
    pub snooze_until: Option<DateTime<Utc>>,
    pub snooze_until_count: Option<i32>,
    pub snooze_until_users: Option<i32>,
    pub pre_snooze_status: Option<String>,
}

pub async fn get_issue_by_fingerprint(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    fingerprint: &str,
) -> Result<Option<IssueLifecycleState>, sqlx::Error> {
    let mut tx = crate::rls::begin_ingest_transaction(pool, org_id).await?;
    let row =
        crate::persist::get_issue_by_fingerprint_in_tx(&mut tx, project_id, fingerprint).await?;
    tx.commit().await?;
    Ok(row)
}

pub async fn get_issue_by_id(
    pool: &PgPool,
    org_id: Uuid,
    issue_id: Uuid,
) -> Result<Option<IssueLifecycleState>, sqlx::Error> {
    let mut tx = crate::rls::begin_ingest_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, IssueLifecycleState>(
        r#"
        SELECT
            id, org_id, project_id, title, status, release, environment,
            event_count, unique_user_count,
            resolved_in_release, snooze_until, snooze_until_count, snooze_until_users,
            pre_snooze_status
        FROM issues
        WHERE id = $1 AND merge_parent_id IS NULL
        "#,
    )
    .bind(issue_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

pub async fn mark_regression(
    pool: &PgPool,
    org_id: Uuid,
    issue_id: Uuid,
) -> Result<(), sqlx::Error> {
    let mut tx = crate::rls::begin_ingest_transaction(pool, org_id).await?;
    sqlx::query(
        r#"
        UPDATE issues
        SET status = 'regression'
        WHERE id = $1 AND merge_parent_id IS NULL
        "#,
    )
    .bind(issue_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

pub struct UpdateIssueParams {
    pub status: Option<String>,
    pub resolved_in_release: Option<String>,
}

pub async fn update_issue(
    pool: &PgPool,
    org_id: Uuid,
    issue_id: Uuid,
    params: UpdateIssueParams,
) -> Result<Option<IssueSummary>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, IssueSummary>(&format!(
        r#"
        UPDATE issues
        SET
            status = COALESCE($2, status),
            resolved_in_release = COALESCE($3, resolved_in_release)
        WHERE id = $1 AND merge_parent_id IS NULL
        RETURNING
            {ISSUE_SUMMARY_COLUMNS}
        "#,
    ))
    .bind(issue_id)
    .bind(&params.status)
    .bind(&params.resolved_in_release)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

pub enum SnoozeMode {
    Hours4,
    Occurrences100,
    Users10,
}

pub async fn apply_snooze(
    pool: &PgPool,
    org_id: Uuid,
    issue_id: Uuid,
    mode: SnoozeMode,
) -> Result<Option<IssueSummary>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;

    let current = sqlx::query_as::<_, (i64, i32, String, Option<String>)>(
        r#"
        SELECT event_count, unique_user_count, status, pre_snooze_status
        FROM issues
        WHERE id = $1 AND merge_parent_id IS NULL
        FOR UPDATE
        "#,
    )
    .bind(issue_id)
    .fetch_optional(&mut *tx)
    .await?;

    let Some((event_count, unique_user_count, status, pre_snooze_status)) = current else {
        tx.commit().await?;
        return Ok(None);
    };

    let overlay_status = pre_snooze_status.unwrap_or(status);

    let (snooze_until, snooze_until_count, snooze_until_users) = match mode {
        SnoozeMode::Hours4 => (Some(Utc::now() + chrono::Duration::hours(4)), None, None),
        SnoozeMode::Occurrences100 => {
            let threshold = event_count.saturating_add(100);
            let threshold = i32::try_from(threshold).unwrap_or(i32::MAX);
            (None, Some(threshold), None)
        }
        SnoozeMode::Users10 => (None, None, Some(unique_user_count.saturating_add(10))),
    };
    let row = sqlx::query_as::<_, IssueSummary>(&format!(
        r#"
        UPDATE issues
        SET
            snooze_until = $2,
            snooze_until_count = $3,
            snooze_until_users = $4,
            pre_snooze_status = $5
        WHERE id = $1 AND merge_parent_id IS NULL
        RETURNING
            {ISSUE_SUMMARY_COLUMNS}
        "#,
    ))
    .bind(issue_id)
    .bind(snooze_until)
    .bind(snooze_until_count)
    .bind(snooze_until_users)
    .bind(&overlay_status)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

const WAKE_EXPIRED_SNOOZE_SQL: &str = r#"
    UPDATE issues
    SET
        status = CASE
            WHEN status = 'regression' THEN 'regression'
            ELSE COALESCE(pre_snooze_status, status)
        END,
        snooze_until = NULL,
        snooze_until_count = NULL,
        snooze_until_users = NULL,
        pre_snooze_status = NULL
    WHERE merge_parent_id IS NULL
      AND (
            snooze_until IS NOT NULL
         OR snooze_until_count IS NOT NULL
         OR snooze_until_users IS NOT NULL
         OR pre_snooze_status IS NOT NULL
      )
      AND NOT (
            (snooze_until IS NOT NULL AND snooze_until > now())
         OR (snooze_until_count IS NOT NULL AND event_count < snooze_until_count)
         OR (snooze_until_users IS NOT NULL AND unique_user_count < snooze_until_users)
      )
"#;

async fn wake_expired_snoozes_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
) -> Result<u64, sqlx::Error> {
    let result = sqlx::query(WAKE_EXPIRED_SNOOZE_SQL)
        .execute(&mut **tx)
        .await?;
    Ok(result.rows_affected())
}

/// Restore overlay status and clear snooze columns for issues whose mute expired.
pub async fn wake_expired_snoozes(pool: &PgPool, org_id: Uuid) -> Result<u64, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let updated = wake_expired_snoozes_in_tx(&mut tx).await?;
    tx.commit().await?;
    Ok(updated)
}

pub async fn wake_issue_if_expired(
    pool: &PgPool,
    org_id: Uuid,
    issue_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let mut tx = crate::rls::begin_ingest_transaction(pool, org_id).await?;
    let result = sqlx::query(&format!(
        r#"
        {WAKE_EXPIRED_SNOOZE_SQL}
          AND id = $1
        "#
    ))
    .bind(issue_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(result.rows_affected() > 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn issue_list_and_bulk_are_capped() {
        let requested = 10_000i64.clamp(1, MAX_ISSUE_LIST);
        assert_eq!(requested, MAX_ISSUE_LIST);
        assert_eq!(MAX_ISSUE_LIST, 100);
        assert_eq!(MAX_BULK_IDS, 100);
    }
}
