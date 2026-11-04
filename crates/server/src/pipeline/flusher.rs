use chrono::{DateTime, Timelike, Utc};
use epure_storage::persist::{self, PersistCounterDelta};
use epure_storage::PgPool;
use std::sync::Arc;
use std::time::Duration;
use tracing::error;

use crate::pipeline::outcomes::OutcomeLedger;
use crate::pipeline::spike::SpikeValve;

const FLUSH_INTERVAL: Duration = Duration::from_millis(250);

pub async fn run_spike_flusher(
    pool: PgPool,
    spike_valve: Arc<SpikeValve>,
    outcomes: Arc<OutcomeLedger>,
    shutdown: Arc<tokio::sync::Notify>,
) {
    let mut interval = tokio::time::interval(FLUSH_INTERVAL);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    loop {
        tokio::select! {
            _ = interval.tick() => {
                flush_telemetry_deltas(&pool, &spike_valve).await;
                flush_pending_deltas(&pool, &spike_valve).await;
                flush_outcomes(&pool, &outcomes).await;
            }
            _ = shutdown.notified() => {
                flush_telemetry_deltas(&pool, &spike_valve).await;
                flush_pending_deltas(&pool, &spike_valve).await;
                flush_outcomes(&pool, &outcomes).await;
                break;
            }
        }
    }
}

async fn flush_telemetry_deltas(pool: &PgPool, spike_valve: &SpikeValve) {
    let deltas = spike_valve.take_telemetry_deltas();
    if deltas.issue_counts.is_empty() && deltas.tag_facets.is_empty() && deltas.sessions.is_empty()
    {
        return;
    }

    if let Err(err) = persist::flush_all_telemetry_deltas(pool, &deltas).await {
        spike_valve.restore_telemetry_deltas(deltas);
        error!(error = %err, "failed to bulk flush telemetry deltas; retained for retry");
    }
}

async fn flush_pending_deltas(pool: &PgPool, spike_valve: &SpikeValve) {
    let deltas = spike_valve.take_pending_deltas();
    if deltas.is_empty() {
        return;
    }

    for delta in deltas {
        let window_start = window_hour_start(delta.last_seen);
        if let Err(err) = persist::persist_counter_delta(
            pool,
            PersistCounterDelta {
                org_id: delta.org_id,
                project_id: delta.project_id,
                fingerprint: delta.fingerprint.clone(),
                count_delta: delta.count_delta as i64,
                occurred_at: delta.last_seen,
                window_start,
                variants: delta.variants.clone(),
            },
        )
        .await
        {
            error!(error = %err, project_id = %delta.project_id, "failed to flush spike counter delta; retained for retry");
            spike_valve.restore_pending_delta(delta);
        }
    }
}

async fn flush_outcomes(pool: &PgPool, outcomes: &OutcomeLedger) {
    let deltas = outcomes.take();
    for delta in deltas {
        let window_start = window_hour_start(chrono::Utc::now());
        if let Err(err) = epure_storage::noise::add_outcome(
            pool,
            delta.org_id,
            delta.project_id,
            window_start,
            &delta.reason,
            delta.count as i64,
        )
        .await
        {
            outcomes.record(delta.org_id, delta.project_id, &delta.reason, delta.count);
            error!(error = %err, reason = %delta.reason, "failed to flush ingest outcome; retained for retry");
        }
    }
}

fn window_hour_start(now: DateTime<Utc>) -> DateTime<Utc> {
    now.date_naive()
        .and_hms_opt(now.hour(), 0, 0)
        .unwrap()
        .and_utc()
}

#[cfg(test)]
mod audit_tests {
    use super::*;
    use uuid::Uuid;

    #[tokio::test]
    async fn failed_database_flush_retains_counters_facets_and_outcomes() {
        let pool = sqlx::postgres::PgPoolOptions::new()
            .connect_lazy("postgres://unused:unused@127.0.0.1:1/unused")
            .unwrap();
        pool.close().await;
        let valve = SpikeValve::default();
        let org = Uuid::new_v4();
        let project = Uuid::new_v4();
        let issue = Uuid::new_v4();
        valve.record_issue_count_delta(org, project, issue, "fp", 17);
        valve.record_tag_facet(org, issue, "browser", "Firefox");
        flush_telemetry_deltas(&pool, &valve).await;
        let retained = valve.take_telemetry_deltas();
        assert_eq!(retained.issue_counts[0].count_delta, 17);
        assert_eq!(retained.tag_facets[0].count, 1);
        let ledger = OutcomeLedger::new();
        ledger.record(org, project, "stored", 23);
        flush_outcomes(&pool, &ledger).await;
        assert_eq!(ledger.take()[0].count, 23);
        let pending = crate::pipeline::spike::PendingSpikeDelta {
            org_id: org,
            project_id: project,
            fingerprint: "fp".into(),
            count_delta: 9,
            last_seen: Utc::now(),
            variants: vec!["real variant".into()],
        };
        valve.restore_pending_delta(pending);
        flush_pending_deltas(&pool, &valve).await;
        let pending = valve.take_pending_deltas();
        assert_eq!(pending[0].count_delta, 9);
        assert_eq!(pending[0].variants, vec!["real variant"]);
    }
}
