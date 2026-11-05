//! Cloud billing notices: quota at 80% and 100%, trial ending in 3 days, trial ended.
//!
//! Each notice is claimed in `billing_notices` before sending and released if
//! the email fails, so every org gets at most one email per kind and period.

use chrono::{DateTime, Utc};
use epure_storage::PgPool;
use std::time::Duration;
use tracing::{error, info, warn};
use uuid::Uuid;

const INTERVAL: Duration = Duration::from_secs(60 * 60);

pub async fn run_billing_notice_job(pool: PgPool) {
    if !epure_core::entitlement::is_cloud() {
        return;
    }
    let mut interval = tokio::time::interval(INTERVAL);
    loop {
        interval.tick().await;
        if crate::lifecycle::resend::resend_api_key().is_none() {
            continue;
        }
        if let Err(err) = run_once(&pool).await {
            error!("billing notice job failed: {err}");
        }
    }
}

#[derive(sqlx::FromRow)]
struct UsageRow {
    org_id: Uuid,
    org_name: String,
    plan_tier: String,
    stored: i64,
}

#[derive(sqlx::FromRow)]
struct TrialRow {
    org_id: Uuid,
    org_name: String,
    trial_ends_at: DateTime<Utc>,
}

pub async fn run_once(pool: &PgPool) -> Result<(), sqlx::Error> {
    let period = Utc::now().format("%Y-%m").to_string();
    let usage: Vec<UsageRow> = sqlx::query_as(
        r#"
        SELECT o.id AS org_id, o.name AS org_name, o.plan_tier,
               ingest_org_monthly_stored_events(o.id) AS stored
        FROM organizations o
        WHERE o.plan_tier <> 'oss'
          AND o.subscription_status IN ('active', 'past_due', 'trialing')
        "#,
    )
    .fetch_all(pool)
    .await?;

    for row in usage {
        let Some(tier) = epure_core::PlanTier::parse_tier(&row.plan_tier) else {
            continue;
        };
        let limit = tier.monthly_events();
        if limit == u64::MAX || limit == 0 {
            continue;
        }
        let used = row.stored.max(0) as u64;
        let kind = if used >= limit {
            "quota_100"
        } else if used * 10 >= limit * 8 {
            "quota_80"
        } else {
            continue;
        };
        let (subject, text) = quota_email(&row.org_name, used, limit, kind == "quota_100");
        notify(pool, row.org_id, &period, kind, &subject, &text).await?;
    }

    let trials: Vec<TrialRow> = sqlx::query_as(
        r#"
        SELECT id AS org_id, name AS org_name, trial_ends_at
        FROM organizations
        WHERE subscription_status = 'trialing' AND subscription_id IS NULL
          AND trial_ends_at IS NOT NULL AND trial_ends_at < now() + interval '3 days'
        "#,
    )
    .fetch_all(pool)
    .await?;
    for row in trials {
        let ended = row.trial_ends_at <= Utc::now();
        let kind = if ended { "trial_ended" } else { "trial_ending" };
        let trial_period = row.trial_ends_at.format("%Y-%m-%d").to_string();
        let (subject, text) = trial_email(&row.org_name, row.trial_ends_at, ended);
        notify(pool, row.org_id, &trial_period, kind, &subject, &text).await?;
    }
    Ok(())
}

async fn notify(
    pool: &PgPool,
    org_id: Uuid,
    period: &str,
    kind: &str,
    subject: &str,
    text: &str,
) -> Result<(), sqlx::Error> {
    let claimed: Option<i32> = sqlx::query_scalar(
        "INSERT INTO billing_notices (org_id, period, kind) VALUES ($1, $2, $3) \
         ON CONFLICT DO NOTHING RETURNING 1",
    )
    .bind(org_id)
    .bind(period)
    .bind(kind)
    .fetch_optional(pool)
    .await?;
    if claimed.is_none() {
        return Ok(());
    }
    let recipients: Vec<String> =
        sqlx::query_scalar("SELECT email FROM billing_org_admin_emails($1)")
            .bind(org_id)
            .fetch_all(pool)
            .await?;
    if recipients.is_empty() {
        return Ok(());
    }
    let html = format!(
        "<pre style=\"font-family:ui-monospace,monospace\">{}</pre>",
        text.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
    );
    match crate::lifecycle::resend::send_resend_email(
        recipients,
        subject.to_string(),
        html,
        text.to_string(),
    )
    .await
    {
        Ok(_) => info!(%org_id, kind, "billing notice sent"),
        Err(err) => {
            warn!(%org_id, kind, error = %err, "billing notice failed; will retry");
            sqlx::query(
                "DELETE FROM billing_notices WHERE org_id = $1 AND period = $2 AND kind = $3",
            )
            .bind(org_id)
            .bind(period)
            .bind(kind)
            .execute(pool)
            .await?;
        }
    }
    Ok(())
}

fn billing_url() -> String {
    format!(
        "{}/billing",
        std::env::var("EPURE_PUBLIC_URL")
            .unwrap_or_else(|_| "https://app.epure.sh".to_string())
            .trim_end_matches('/')
    )
}

fn quota_email(org: &str, used: u64, limit: u64, full: bool) -> (String, String) {
    if full {
        (
            format!("{org} used its monthly events"),
            format!(
                "{org} has stored {used} of {limit} events this month.\n\n\
                 Epure keeps working: every occurrence is still counted, and the first event of \
                 each new or regressed issue is still stored. Repeat payloads are no longer kept \
                 until the next month or a larger plan.\n\n\
                 There is no automatic overage. Plans: {}\n",
                billing_url()
            ),
        )
    } else {
        (
            format!("{org} is at 80% of its monthly events"),
            format!(
                "{org} has stored {used} of {limit} events this month.\n\n\
                 Nothing changes yet. At 100%, Epure keeps counting every occurrence and keeps \
                 the first event of new issues. There is no automatic overage.\n\n\
                 Plans: {}\n",
                billing_url()
            ),
        )
    }
}

fn trial_email(org: &str, ends_at: DateTime<Utc>, ended: bool) -> (String, String) {
    let date = ends_at.format("%-d %B %Y").to_string();
    if ended {
        (
            format!("{org}: your Epure trial has ended"),
            format!(
                "The trial for {org} ended on {date}. New events are no longer accepted.\n\n\
                 Your issues and history stay readable. Choose a plan to resume: {}\n",
                billing_url()
            ),
        )
    } else {
        (
            format!("{org}: your Epure trial ends on {date}"),
            format!(
                "The trial for {org} ends on {date}. After that, new events are not accepted \
                 until you choose a plan. Your data stays readable.\n\n\
                 Plans: {}\n",
                billing_url()
            ),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quota_email_promises_counting_not_overage() {
        let (subject, text) = quota_email("Acme", 200_000, 200_000, true);
        assert!(subject.contains("Acme"));
        assert!(text.contains("still counted"));
        assert!(text.contains("no automatic overage"));
        let (_, text) = quota_email("Acme", 160_000, 200_000, false);
        assert!(text.contains("Nothing changes yet"));
    }

    #[test]
    fn trial_email_states_data_stays_readable() {
        let (_, text) = trial_email("Acme", Utc::now(), true);
        assert!(text.contains("stay readable"));
    }
}
