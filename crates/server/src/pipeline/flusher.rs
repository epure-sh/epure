use chrono::{DateTime, Timelike, Utc};
use epure_storage::persist::{self, PersistCounterDelta};
use epure_storage::PgPool;
use std::sync::Arc;
use std::time::Duration;
use tracing::error;

use crate::pipeline::outcomes::OutcomeLedger;
use crate::pipeline::spike::SpikeValve;

const FLUSH_INTERVAL: Duration = Duration::from_secs(5);

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
                flush_pending_deltas(&pool, &spike_valve).await;
                flush_outcomes(&pool, &outcomes).await;
            }
            _ = shutdown.notified() => {
                flush_pending_deltas(&pool, &spike_valve).await;
                flush_outcomes(&pool, &outcomes).await;
                break;
            }
        }
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
                fingerprint: delta.fingerprint,
                count_delta: delta.count_delta as i64,
                occurred_at: delta.last_seen,
                window_start,
                variants: delta.variants,
            },
        )
        .await
        {
            error!(error = %err, project_id = %delta.project_id, "failed to flush spike counter delta");
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
            error!(error = %err, reason = %delta.reason, "failed to flush ingest outcome");
        }
    }
}

fn window_hour_start(now: DateTime<Utc>) -> DateTime<Utc> {
    now.date_naive()
        .and_hms_opt(now.hour(), 0, 0)
        .unwrap()
        .and_utc()
}
