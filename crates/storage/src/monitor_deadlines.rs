//! Durable monitor state, evaluated against an explicit clock for fast tests.
use crate::{monitors::MonitorRow, PgPool};
use chrono::{DateTime, Duration, Utc};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub fn next_scheduled(
    schedule: Option<&str>,
    timezone: Option<&str>,
    after: DateTime<Utc>,
) -> Option<DateTime<Utc>> {
    let text = schedule?.trim();
    let parts: Vec<_> = text.split_whitespace().collect();
    if parts.len() == 3 && parts[0].eq_ignore_ascii_case("every") {
        let value: i64 = parts[1].parse().ok()?;
        if value <= 0 {
            return None;
        }
        let seconds = match parts[2].trim_end_matches('s') {
            "minute" => 60,
            "hour" => 3600,
            "day" => 86400,
            "week" => 604800,
            _ => return None,
        };
        return after.checked_add_signed(Duration::try_seconds(value.checked_mul(seconds)?)?);
    }
    let zone: chrono_tz::Tz = timezone.unwrap_or("UTC").parse().ok()?;
    let cron: croner::Cron = text.parse().ok()?;
    let mut cursor = after.with_timezone(&zone);
    // A nonexistent wall time during the spring DST jump is skipped, rather
    // than silently changing a fixed 02:30 job into a 03:00 deadline.
    for _ in 0..4 {
        let next = cron.find_next_occurrence(&cursor, false).ok()?;
        if cron.is_time_matching(&next).ok()? {
            return Some(next.with_timezone(&Utc));
        }
        cursor = next;
    }
    None
}

pub fn valid_schedule(schedule: Option<&str>, timezone: Option<&str>) -> bool {
    timezone.unwrap_or("UTC").parse::<chrono_tz::Tz>().is_ok()
        && schedule.is_none_or(|s| next_scheduled(Some(s), timezone, Utc::now()).is_some())
}

pub async fn apply_incident_state(
    tx: &mut Transaction<'_, Postgres>,
    row: &MonitorRow,
    status: &str,
    now: DateTime<Utc>,
) -> Result<(), sqlx::Error> {
    let (failures, open, prior_issue): (i32, bool, Option<Uuid>) = sqlx::query_as(
        "SELECT consecutive_failures,incident_open,incident_issue_id FROM monitors WHERE id=$1",
    )
    .bind(row.id)
    .fetch_one(&mut **tx)
    .await?;
    let failures = if status == "ok" {
        0
    } else {
        failures.saturating_add(1)
    };
    let failure = status != "ok" && failures >= row.failure_issue_threshold.max(1);
    let mut issue_id = prior_issue;
    let transition = if !open && failure {
        let id = crate::persist::upsert_issue_in_tx(
            tx,
            crate::issues::UpsertIssueParams {
                org_id: row.org_id,
                project_id: row.project_id,
                fingerprint: format!("monitor:{}", row.id),
                title: Some(format!(
                    "Cron {}: {status}",
                    row.name.as_deref().unwrap_or(&row.slug)
                )),
                level: Some("error".into()),
                environment: row.environment.clone(),
                release: None,
                occurred_at: now,
                increment_by: 0,
                grouping: None,
                rollup: Default::default(),
            },
        )
        .await?;
        sqlx::query("UPDATE issues SET status=$2,title=$3 WHERE id=$1")
            .bind(id)
            .bind(if prior_issue.is_some() {
                "regression"
            } else {
                "unresolved"
            })
            .bind(format!(
                "Cron {}: {status}",
                row.name.as_deref().unwrap_or(&row.slug)
            ))
            .execute(&mut **tx)
            .await?;
        issue_id = Some(id);
        Some(status)
    } else if open && status == "ok" {
        if let Some(id) = issue_id {
            sqlx::query("UPDATE issues SET status='resolved' WHERE id=$1")
                .bind(id)
                .execute(&mut **tx)
                .await?;
        }
        Some("recovered")
    } else {
        None
    };
    sqlx::query("UPDATE monitors SET consecutive_failures=$2,incident_open=$3,incident_issue_id=$4 WHERE id=$1")
        .bind(row.id).bind(failures).bind(if status=="ok" {false} else {open||failure})
        .bind(issue_id).execute(&mut **tx).await?;
    if let Some(kind) = transition {
        let id = Uuid::new_v4();
        sqlx::query("INSERT INTO monitor_transitions (id,monitor_id,issue_id,kind,created_at) VALUES ($1,$2,$3,$4,$5)")
            .bind(id).bind(row.id).bind(issue_id).bind(kind).bind(now).execute(&mut **tx).await?;
        sqlx::query("INSERT INTO alerts (id,org_id,project_id,issue_id,kind,payload_json) VALUES ($1,$2,$3,$4,'custom',$5)")
            .bind(id).bind(row.org_id).bind(row.project_id).bind(issue_id)
            .bind(serde_json::json!({"monitor_id":row.id,"monitor_slug":row.slug,"status":kind,"source":"cron_monitor"}))
            .execute(&mut **tx).await?;
    }
    Ok(())
}

/// Maintenance connection only: claims due rows with locks so multiple instances
/// cannot emit the same incident transition. SDK writes serialize on these rows.
pub async fn evaluate_deadlines(pool: &PgPool, now: DateTime<Utc>) -> Result<usize, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let rows=sqlx::query_as::<_,MonitorRow>(r#"
        SELECT id,org_id,project_id,slug,name,schedule,schedule_type,timezone,status,
            last_check_in_at,last_duration_ms,next_check_in_at,environment,
            checkin_margin_mins,max_runtime_mins,failure_issue_threshold,paused,created_at,updated_at
        FROM monitors WHERE NOT paused AND (
            (next_check_in_at IS NULL AND schedule IS NOT NULL)
            OR next_check_in_at <= $1
        ) ORDER BY next_check_in_at NULLS FIRST LIMIT 200 FOR UPDATE SKIP LOCKED
    "#).bind(now).fetch_all(&mut *tx).await?;
    let mut changes = 0;
    for mut row in rows {
        let running = row.status == "in_progress";
        let (started,): (Option<DateTime<Utc>>,) =
            sqlx::query_as("SELECT runtime_started_at FROM monitors WHERE id=$1")
                .bind(row.id)
                .fetch_one(&mut *tx)
                .await?;
        let deadline = row.next_check_in_at.or_else(|| {
            if running {
                Some(
                    started.or(row.last_check_in_at).unwrap_or(row.created_at)
                        + Duration::minutes(i64::from(row.max_runtime_mins.max(1))),
                )
            } else {
                next_scheduled(
                    row.schedule.as_deref(),
                    row.timezone.as_deref(),
                    row.last_check_in_at.unwrap_or(row.created_at),
                )
            }
        });
        let Some(deadline) = deadline else { continue };
        let due = deadline
            + if running {
                Duration::zero()
            } else {
                Duration::minutes(i64::from(row.checkin_margin_mins.max(0)))
            };
        if now >= due {
            let status = if running { "timeout" } else { "missed" };
            row.status = status.into();
            apply_incident_state(&mut tx, &row, status, now).await?;
            let next = next_scheduled(row.schedule.as_deref(), row.timezone.as_deref(), deadline);
            sqlx::query("UPDATE monitors SET status=$2,next_check_in_at=$3,runtime_started_at=NULL,updated_at=$4 WHERE id=$1")
                .bind(row.id).bind(status).bind(next).bind(now).execute(&mut *tx).await?;
            changes += 1;
        } else if row.next_check_in_at.is_none() {
            sqlx::query("UPDATE monitors SET next_check_in_at=$2 WHERE id=$1")
                .bind(row.id)
                .bind(deadline)
                .execute(&mut *tx)
                .await?;
        }
    }
    tx.commit().await?;
    Ok(changes)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn time(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
    }
    #[test]
    fn intervals_are_anchored_and_invalid_values_rejected() {
        let t = time("2026-11-02T10:00:00Z");
        assert_eq!(
            next_scheduled(Some("every 15 minutes"), Some("UTC"), t),
            Some(t + Duration::minutes(15))
        );
        for value in [
            "every 0 minute",
            "every -1 day",
            "every 999999999999999999 week",
            "bad",
        ] {
            assert_eq!(next_scheduled(Some(value), Some("UTC"), t), None);
        }
    }
    #[test]
    fn crontab_respects_timezone_and_dst() {
        assert_eq!(
            next_scheduled(
                Some("0 9 * * 1-5"),
                Some("Europe/Paris"),
                time("2026-10-23T08:00:00Z")
            ),
            Some(time("2026-10-26T08:00:00Z"))
        );
        assert_eq!(
            next_scheduled(
                Some("30 2 * * *"),
                Some("Europe/Paris"),
                time("2026-03-28T02:00:00Z")
            ),
            Some(time("2026-03-30T00:30:00Z"))
        );
        assert_eq!(
            next_scheduled(
                Some("* * * * *"),
                Some("Bad/Zone"),
                time("2026-11-02T00:00:00Z")
            ),
            None
        );
    }
}
