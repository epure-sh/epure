use chrono::{DateTime, Duration, Timelike, Utc};
use serde::Serialize;
use serde_json::Value;
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

pub struct InsertEventParams {
    pub id: Uuid,
    pub org_id: Uuid,
    pub project_id: Uuid,
    pub issue_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub environment: Option<String>,
    pub release: Option<String>,
    pub platform: Option<String>,
    pub runtime_name: Option<String>,
    pub runtime_version: Option<String>,
    pub browser_name: Option<String>,
    pub os_name: Option<String>,
    pub country_code: Option<String>,
    pub user_id: Option<String>,
    pub user_email: Option<String>,
    pub payload_json: Value,
    pub stack_frames: Option<Value>,
    pub breadcrumbs: Option<Value>,
}

pub async fn insert_event(pool: &PgPool, params: InsertEventParams) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO events (
            id,
            org_id,
            project_id,
            issue_id,
            occurred_at,
            environment,
            release,
            platform,
            runtime_name,
            runtime_version,
            browser_name,
            os_name,
            country_code,
            user_id,
            user_email,
            payload_json,
            stack_frames,
            breadcrumbs
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        "#,
    )
    .bind(params.id)
    .bind(params.org_id)
    .bind(params.project_id)
    .bind(params.issue_id)
    .bind(params.occurred_at)
    .bind(&params.environment)
    .bind(&params.release)
    .bind(&params.platform)
    .bind(&params.runtime_name)
    .bind(&params.runtime_version)
    .bind(&params.browser_name)
    .bind(&params.os_name)
    .bind(&params.country_code)
    .bind(&params.user_id)
    .bind(&params.user_email)
    .bind(params.payload_json)
    .bind(params.stack_frames)
    .bind(params.breadcrumbs)
    .execute(pool)
    .await?;

    Ok(())
}

#[derive(Debug, sqlx::FromRow, serde::Serialize)]
pub struct EventDetail {
    pub id: Uuid,
    pub issue_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub environment: Option<String>,
    pub release: Option<String>,
    pub platform: Option<String>,
    pub runtime_name: Option<String>,
    pub runtime_version: Option<String>,
    pub browser_name: Option<String>,
    pub os_name: Option<String>,
    pub user_id: Option<String>,
    pub user_email: Option<String>,
    pub payload_json: Value,
    pub stack_frames: Option<Value>,
    pub breadcrumbs: Option<Value>,
}

pub async fn count_events_for_issue(
    pool: &PgPool,
    org_id: Uuid,
    issue_id: Uuid,
    release: Option<&str>,
) -> Result<i64, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let count = if let Some(release) = release {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)::bigint
            FROM events
            WHERE issue_id = $1 AND release = $2
            "#,
        )
        .bind(issue_id)
        .bind(release)
        .fetch_one(&mut *tx)
        .await?
    } else {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)::bigint
            FROM events
            WHERE issue_id = $1
            "#,
        )
        .bind(issue_id)
        .fetch_one(&mut *tx)
        .await?
    };
    tx.commit().await?;
    Ok(count)
}

pub async fn list_events_for_issue(
    pool: &PgPool,
    org_id: Uuid,
    issue_id: Uuid,
    limit: i64,
    offset: i64,
    release: Option<&str>,
) -> Result<Vec<EventDetail>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let rows = if let Some(release) = release {
        sqlx::query_as::<_, EventDetail>(
            r#"
            SELECT
                id,
                issue_id,
                occurred_at,
                environment,
                release,
                platform,
                runtime_name,
                runtime_version,
                browser_name,
                os_name,
                user_id,
                user_email,
                payload_json,
                stack_frames,
                breadcrumbs
            FROM events
            WHERE issue_id = $1 AND release = $2
            ORDER BY occurred_at DESC
            LIMIT $3 OFFSET $4
            "#,
        )
        .bind(issue_id)
        .bind(release)
        .bind(limit)
        .bind(offset)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, EventDetail>(
            r#"
            SELECT
                id,
                issue_id,
                occurred_at,
                environment,
                release,
                platform,
                runtime_name,
                runtime_version,
                browser_name,
                os_name,
                user_id,
                user_email,
                payload_json,
                stack_frames,
                breadcrumbs
            FROM events
            WHERE issue_id = $1
            ORDER BY occurred_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(issue_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&mut *tx)
        .await?
    };
    tx.commit().await?;
    Ok(rows)
}

pub async fn list_releases_for_issue(
    pool: &PgPool,
    org_id: Uuid,
    issue_id: Uuid,
) -> Result<Vec<String>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let rows = sqlx::query_scalar(
        r#"
        SELECT DISTINCT release
        FROM events
        WHERE issue_id = $1 AND release IS NOT NULL
        ORDER BY 1
        "#,
    )
    .bind(issue_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

pub async fn count_events_for_project(pool: &PgPool, project_id: Uuid) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar("SELECT COUNT(*)::bigint FROM events WHERE project_id = $1")
        .bind(project_id)
        .fetch_one(pool)
        .await
}

pub async fn latest_event_stack_frames(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Option<Value>, sqlx::Error> {
    sqlx::query_scalar(
        r#"
        SELECT stack_frames
        FROM events
        WHERE project_id = $1
        ORDER BY occurred_at DESC
        LIMIT 1
        "#,
    )
    .bind(project_id)
    .fetch_optional(pool)
    .await
}

pub async fn latest_event_breadcrumbs(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Option<Value>, sqlx::Error> {
    sqlx::query_scalar(
        r#"
        SELECT breadcrumbs
        FROM events
        WHERE project_id = $1
        ORDER BY occurred_at DESC
        LIMIT 1
        "#,
    )
    .bind(project_id)
    .fetch_optional(pool)
    .await
}

pub async fn count_issues_for_fingerprint(
    pool: &PgPool,
    project_id: Uuid,
    fingerprint: &str,
) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint
        FROM issues
        WHERE project_id = $1 AND fingerprint = $2 AND merge_parent_id IS NULL
        "#,
    )
    .bind(project_id)
    .bind(fingerprint)
    .fetch_one(pool)
    .await
}

#[derive(Debug, Clone, Copy)]
pub enum TimelineWindow {
    Days7,
    Days14,
    Days30,
    All,
}

impl TimelineWindow {
    pub fn parse(raw: Option<&str>) -> Self {
        match raw {
            Some("14d") => Self::Days14,
            Some("28d") | Some("30d") => Self::Days30,
            Some("all") => Self::All,
            _ => Self::Days7,
        }
    }

    pub fn histogram_hours(self) -> i64 {
        match self {
            Self::Days7 => 48,
            Self::Days14 => 14 * 24,
            Self::Days30 => 30 * 24,
            Self::All => 90 * 24,
        }
    }

    pub fn summary_interval(self) -> &'static str {
        match self {
            Self::Days7 => "7 days",
            Self::Days14 => "14 days",
            Self::Days30 => "30 days",
            Self::All => "90 days",
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum TimelineBucketSize {
    Hour,
    Day,
}

impl TimelineBucketSize {
    pub fn parse(raw: Option<&str>) -> Self {
        match raw {
            Some("day") => Self::Day,
            _ => Self::Hour,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct TimelineBucket {
    pub start: DateTime<Utc>,
    pub count: i32,
}

#[derive(Debug, Serialize)]
pub struct TimelineSummary {
    pub last_1h: i32,
    pub last_24h: i32,
    pub last_7d: i32,
}

#[derive(Debug, Serialize)]
pub struct IssueTimeline {
    pub issue_id: Uuid,
    pub event_count: i64,
    pub stored_event_count: i64,
    pub buckets: Vec<TimelineBucket>,
    pub summary: TimelineSummary,
}

#[derive(Debug, sqlx::FromRow)]
struct TimelineSummaryRow {
    last_1h: i64,
    last_24h: i64,
    last_7d: i64,
}

#[derive(Debug, sqlx::FromRow)]
struct TimelineBucketRow {
    bucket_start: DateTime<Utc>,
    count: i64,
}

fn truncate_to_bucket_start(at: DateTime<Utc>, bucket: TimelineBucketSize) -> DateTime<Utc> {
    match bucket {
        TimelineBucketSize::Hour => at
            .with_minute(0)
            .and_then(|value| value.with_second(0))
            .and_then(|value| value.with_nanosecond(0))
            .unwrap_or(at),
        TimelineBucketSize::Day => at
            .date_naive()
            .and_hms_opt(0, 0, 0)
            .map(|value| value.and_utc())
            .unwrap_or(at),
    }
}

fn fill_timeline_buckets(
    window: TimelineWindow,
    bucket: TimelineBucketSize,
    rows: Vec<TimelineBucketRow>,
) -> Vec<TimelineBucket> {
    let hours = window.histogram_hours();
    let bucket_hours = match bucket {
        TimelineBucketSize::Hour => 1,
        TimelineBucketSize::Day => 24,
    };
    let bucket_count = (hours / bucket_hours).max(1) as usize;
    let now = Utc::now();
    let current_bucket = truncate_to_bucket_start(now, bucket);
    let step = Duration::hours(bucket_hours);

    let counts: HashMap<DateTime<Utc>, i32> = rows
        .into_iter()
        .map(|row| (row.bucket_start, row.count as i32))
        .collect();

    (0..bucket_count)
        .rev()
        .map(|offset| {
            let start = current_bucket - step * (bucket_count - 1 - offset) as i32;
            TimelineBucket {
                start,
                count: counts.get(&start).copied().unwrap_or(0),
            }
        })
        .collect()
}

pub async fn issue_timeline(
    pool: &PgPool,
    org_id: Uuid,
    issue_id: Uuid,
    window: TimelineWindow,
    bucket: TimelineBucketSize,
) -> Result<Option<IssueTimeline>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;

    let event_count: Option<i64> = sqlx::query_scalar(
        r#"
        SELECT event_count
        FROM issues
        WHERE id = $1 AND merge_parent_id IS NULL
        "#,
    )
    .bind(issue_id)
    .fetch_optional(&mut *tx)
    .await?;

    let Some(event_count) = event_count else {
        tx.commit().await?;
        return Ok(None);
    };

    let stored_event_count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint
        FROM events
        WHERE issue_id = $1
        "#,
    )
    .bind(issue_id)
    .fetch_one(&mut *tx)
    .await?;

    let summary = sqlx::query_as::<_, TimelineSummaryRow>(
        r#"
        SELECT
            COUNT(*) FILTER (WHERE occurred_at >= now() - interval '1 hour')::bigint AS last_1h,
            COUNT(*) FILTER (WHERE occurred_at >= now() - interval '24 hours')::bigint AS last_24h,
            COUNT(*) FILTER (WHERE occurred_at >= now() - interval '7 days')::bigint AS last_7d
        FROM events
        WHERE issue_id = $1
        "#,
    )
    .bind(issue_id)
    .fetch_one(&mut *tx)
    .await?;

    let trunc_unit = match bucket {
        TimelineBucketSize::Hour => "hour",
        TimelineBucketSize::Day => "day",
    };
    let histogram_hours = window.histogram_hours();
    let bucket_rows = sqlx::query_as::<_, TimelineBucketRow>(
        &format!(
            r#"
            SELECT
                date_trunc('{trunc_unit}', occurred_at) AS bucket_start,
                COUNT(*)::bigint AS count
            FROM events
            WHERE issue_id = $1
              AND occurred_at >= now() - interval '{histogram_hours} hours'
            GROUP BY 1
            ORDER BY 1
            "#,
        ),
    )
    .bind(issue_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Some(IssueTimeline {
        issue_id,
        event_count,
        stored_event_count,
        buckets: fill_timeline_buckets(window, bucket, bucket_rows),
        summary: TimelineSummary {
            last_1h: summary.last_1h as i32,
            last_24h: summary.last_24h as i32,
            last_7d: summary.last_7d as i32,
        },
    }))
}
