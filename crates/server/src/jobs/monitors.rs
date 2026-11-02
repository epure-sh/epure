use crate::lifecycle::webhooks::{dispatch_event, WebhookContext};
use epure_storage::{monitor_deadlines::evaluate_deadlines, monitors::MonitorRow, PgPool};
use uuid::Uuid;

pub async fn run_monitor_job(maintenance: PgPool, ingest: PgPool) {
    let mut tick = tokio::time::interval(std::time::Duration::from_secs(10));
    tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        tick.tick().await;
        if let Err(e) = run_monitor_once(&maintenance, &ingest, chrono::Utc::now()).await {
            tracing::error!("monitor deadline evaluation failed: {e}");
        }
    }
}

pub async fn run_monitor_once(
    maintenance: &PgPool,
    ingest: &PgPool,
    now: chrono::DateTime<chrono::Utc>,
) -> Result<(), sqlx::Error> {
    evaluate_deadlines(maintenance, now).await?;
    // Keep the claim until its dispatch is recorded. Outbox requests are durable;
    // email errors remain visible and get at most three bounded attempts.
    for _ in 0..100 {
        let mut tx = maintenance.begin().await?;
        let item=sqlx::query_as::<_,(Uuid,Uuid,Option<Uuid>,String,i32)>(
            "SELECT id,monitor_id,issue_id,kind,attempts FROM monitor_transitions WHERE processed_at IS NULL AND attempts<3 ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED"
        ).fetch_optional(&mut *tx).await?;
        let Some((id, monitor_id, issue_id, kind, attempts)) = item else {
            break;
        };
        let monitor=sqlx::query_as::<_,MonitorRow>(
            "SELECT id,org_id,project_id,slug,name,schedule,schedule_type,timezone,status,last_check_in_at,last_duration_ms,next_check_in_at,environment,checkin_margin_mins,max_runtime_mins,failure_issue_threshold,paused,created_at,updated_at FROM monitors WHERE id=$1"
        ).bind(monitor_id).fetch_one(&mut *tx).await?;
        if !monitor.paused && attempts == 0 {
            dispatch_event(
                ingest,
                monitor.org_id,
                if kind == "recovered" {
                    "monitor_recovered"
                } else {
                    "issue_created"
                },
                &WebhookContext {
                    project_id: monitor.project_id,
                    issue_id: issue_id.unwrap_or(Uuid::nil()),
                    title: Some(format!(
                        "Cron {}: {kind}",
                        monitor.name.as_deref().unwrap_or(&monitor.slug)
                    )),
                    status: kind.clone(),
                    release: None,
                    event_count: 0,
                },
            )
            .await;
        }
        let error = if monitor.paused {
            None
        } else {
            send_monitor_email(ingest, &monitor, &kind, issue_id)
                .await
                .err()
        };
        sqlx::query("UPDATE monitor_transitions SET attempts=attempts+1,last_error=$2,processed_at=CASE WHEN $2::text IS NULL OR attempts>=2 THEN now() ELSE NULL END WHERE id=$1")
            .bind(id).bind(error).execute(&mut *tx).await?;
        tx.commit().await?;
    }
    Ok(())
}

async fn send_monitor_email(
    pool: &PgPool,
    monitor: &MonitorRow,
    kind: &str,
    issue_id: Option<Uuid>,
) -> Result<(), String> {
    let settings=sqlx::query_as::<_,(bool,Option<Vec<String>>,bool,bool)>(
        "SELECT email_alerts_enabled,email_alert_recipients,email_alert_on_regression,email_alert_on_spike FROM ingest_get_project_email_alert_settings($1,$2)"
    ).bind(monitor.org_id).bind(monitor.project_id).fetch_optional(pool).await.map_err(|e|e.to_string())?;
    let Some((enabled, recipients, _, _)) = settings else {
        return Ok(());
    };
    if !enabled || crate::lifecycle::resend::resend_api_key().is_none() {
        return Ok(());
    }
    let recipients = if let Some(recipients) = recipients.filter(|r| !r.is_empty()) {
        recipients
    } else {
        sqlx::query_scalar::<_, String>("SELECT email::text FROM ingest_get_org_member_emails($1)")
            .bind(monitor.org_id)
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?
    };
    if recipients.is_empty() {
        return Ok(());
    }
    let name = monitor.name.as_deref().unwrap_or(&monitor.slug);
    let subject = format!("[Cron {kind}] {name}");
    let text = format!(
        "Cron {name}: {kind}.\nProject: {}\nIssue: {}",
        monitor.project_id,
        issue_id.map(|id| id.to_string()).unwrap_or_default()
    );
    let html = format!(
        "<pre>{}</pre>",
        text.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
    );
    crate::lifecycle::resend::send_resend_email(recipients, subject, html, text)
        .await
        .map(|_| ())
}
