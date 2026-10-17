use chrono::{DateTime, Timelike, Utc};
use epure_storage::persist::{self, PersistCounterDelta};
use epure_storage::PgPool;
use std::sync::Arc;
use std::time::Duration;
use tracing::error;

use crate::pipeline::spike::SpikeValve;

const FLUSH_INTERVAL: Duration = Duration::from_secs(5);

pub async fn run_spike_flusher(pool: PgPool, spike_valve: Arc<SpikeValve>) {
    let mut interval = tokio::time::interval(FLUSH_INTERVAL);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    loop {
        interval.tick().await;
        let deltas = spike_valve.take_pending_deltas();
        if deltas.is_empty() {
            continue;
        }

        for delta in deltas {
            let window_start = window_hour_start(delta.last_seen);
            if let Err(err) = persist::persist_counter_delta(
                &pool,
                PersistCounterDelta {
                    org_id: delta.org_id,
                    project_id: delta.project_id,
                    fingerprint: delta.fingerprint,
                    count_delta: delta.count_delta as i64,
                    occurred_at: delta.last_seen,
                    window_start,
                },
            )
            .await
            {
                error!(error = %err, project_id = %delta.project_id, "failed to flush spike counter delta");
            }
        }
    }
}

fn window_hour_start(now: DateTime<Utc>) -> DateTime<Utc> {
    now.date_naive()
        .and_hms_opt(now.hour(), 0, 0)
        .unwrap()
        .and_utc()
}
