use chrono::{Datelike, NaiveDate, Utc};
use sqlx::PgPool;

pub fn partition_name(year: i32, month: u32) -> String {
    format!("events_{year}_{month:02}")
}

pub fn parse_partition_name(name: &str) -> Option<(i32, u32)> {
    let rest = name.strip_prefix("events_")?;
    let (year, month) = rest.split_once('_')?;
    let year = year.parse().ok()?;
    let month = month.parse().ok()?;
    Some((year, month))
}

pub fn partition_bounds(
    year: i32,
    month: u32,
) -> Option<(chrono::DateTime<Utc>, chrono::DateTime<Utc>)> {
    let start = NaiveDate::from_ymd_opt(year, month, 1)?
        .and_hms_opt(0, 0, 0)?
        .and_utc();
    let (next_year, next_month) = if month == 12 {
        (year + 1, 1)
    } else {
        (year, month + 1)
    };
    let end = NaiveDate::from_ymd_opt(next_year, next_month, 1)?
        .and_hms_opt(0, 0, 0)?
        .and_utc();
    Some((start, end))
}

pub async fn ensure_partition(pool: &PgPool, year: i32, month: u32) -> Result<(), sqlx::Error> {
    sqlx::query("SELECT ensure_event_partition($1, $2)")
        .bind(year)
        .bind(month as i32)
        .execute(pool)
        .await?;
    Ok(())
}

/// Ensure partitions exist for the current month and the next month.
pub async fn ensure_current_and_next(pool: &PgPool) -> Result<(), sqlx::Error> {
    let now = Utc::now();
    ensure_partition(pool, now.year(), now.month()).await?;
    let next = now + chrono::Months::new(1);
    ensure_partition(pool, next.year(), next.month()).await?;
    Ok(())
}

async fn max_retention_for_partition(
    pool: &PgPool,
    start: chrono::DateTime<Utc>,
    end: chrono::DateTime<Utc>,
) -> Result<i32, sqlx::Error> {
    sqlx::query_scalar(
        r#"
        SELECT COALESCE(MAX(p.retention_days), 30)
        FROM projects p
        WHERE EXISTS (
            SELECT 1
            FROM events e
            WHERE e.project_id = p.id
              AND e.occurred_at >= $1
              AND e.occurred_at < $2
        )
        "#,
    )
    .bind(start)
    .bind(end)
    .fetch_one(pool)
    .await
}

/// Drop monthly partitions whose data is past the longest applicable project retention.
pub async fn drop_expired_partitions(pool: &PgPool) -> Result<Vec<String>, sqlx::Error> {
    ensure_current_and_next(pool).await?;

    let partitions = sqlx::query_scalar::<_, String>(
        r#"
        SELECT c.relname::text
        FROM pg_inherits i
        INNER JOIN pg_class c ON c.oid = i.inhrelid
        INNER JOIN pg_class p ON p.oid = i.inhparent
        WHERE p.relname = 'events'
        ORDER BY c.relname
        "#,
    )
    .fetch_all(pool)
    .await?;

    let now = Utc::now();
    let mut dropped = Vec::new();

    for relname in partitions {
        let Some((year, month)) = parse_partition_name(&relname) else {
            continue;
        };
        let Some((_start, partition_end)) = partition_bounds(year, month) else {
            continue;
        };
        let retention_days = max_retention_for_partition(pool, _start, partition_end).await?;
        let cutoff = now - chrono::Duration::days(retention_days as i64);
        if partition_end <= cutoff {
            sqlx::query("SELECT drop_event_partition($1)")
                .bind(&relname)
                .execute(pool)
                .await?;
            dropped.push(relname);
        }
    }

    Ok(dropped)
}

/// Create a partition for testing or backfill scenarios.
pub async fn create_partition_for_month(
    pool: &PgPool,
    year: i32,
    month: u32,
) -> Result<String, sqlx::Error> {
    ensure_partition(pool, year, month).await?;
    Ok(partition_name(year, month))
}

pub async fn partition_exists(pool: &PgPool, name: &str) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar(
        r#"
        SELECT EXISTS (
            SELECT 1
            FROM pg_class c
            INNER JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = $1
        )
        "#,
    )
    .bind(name)
    .fetch_one(pool)
    .await
}
