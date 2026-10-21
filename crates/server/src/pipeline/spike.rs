use dashmap::DashMap;
use std::sync::atomic::{AtomicI64, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use uuid::Uuid;

const DEFAULT_RATE_PER_MINUTE: f64 = 100.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpikeDecision {
    AllowStore,
    CounterOnly,
}

struct TokenBucket {
    tokens: f64,
    last_refill: Instant,
    rate_per_minute: f64,
}

impl TokenBucket {
    fn new(rate_per_minute: f64) -> Self {
        Self {
            tokens: rate_per_minute,
            last_refill: Instant::now(),
            rate_per_minute,
        }
    }

    fn check(&mut self) -> SpikeDecision {
        self.refill();
        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            SpikeDecision::AllowStore
        } else {
            SpikeDecision::CounterOnly
        }
    }

    fn refill(&mut self) {
        let elapsed = self.last_refill.elapsed();
        if elapsed.is_zero() {
            return;
        }
        let added = (elapsed.as_secs_f64() / 60.0) * self.rate_per_minute;
        self.tokens = (self.tokens + added).min(self.rate_per_minute);
        self.last_refill = Instant::now();
    }
}

pub struct RamValveEntry {
    token_bucket: TokenBucket,
    pub org_id: Uuid,
    pub dropped_counter: AtomicU64,
    pub last_seen_epoch_sec: AtomicI64,
}

#[derive(Debug, Clone)]
pub struct PendingSpikeDelta {
    pub project_id: Uuid,
    pub org_id: Uuid,
    pub fingerprint: String,
    pub count_delta: u64,
    pub last_seen: chrono::DateTime<chrono::Utc>,
}

pub struct SpikeValve {
    buckets: DashMap<(Uuid, String), RamValveEntry>,
    rate_per_minute: f64,
}

impl SpikeValve {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            buckets: DashMap::new(),
            rate_per_minute: DEFAULT_RATE_PER_MINUTE,
        })
    }

    pub fn check(&self, fingerprint: &str) -> SpikeDecision {
        self.check_scoped(Uuid::nil(), Uuid::nil(), fingerprint)
    }

    pub fn check_scoped(&self, project_id: Uuid, org_id: Uuid, fingerprint: &str) -> SpikeDecision {
        self.evict_if_needed();
        let key = (project_id, fingerprint.to_string());
        let mut entry = self.buckets.entry(key).or_insert_with(|| RamValveEntry {
            token_bucket: TokenBucket::new(self.rate_per_minute),
            org_id,
            dropped_counter: AtomicU64::new(0),
            last_seen_epoch_sec: AtomicI64::new(chrono::Utc::now().timestamp()),
        });

        let decision = entry.token_bucket.check();
        if decision == SpikeDecision::CounterOnly {
            entry.dropped_counter.fetch_add(1, Ordering::Relaxed);
            entry
                .last_seen_epoch_sec
                .store(chrono::Utc::now().timestamp(), Ordering::Relaxed);
        }
        decision
    }

    pub fn take_pending_deltas(&self) -> Vec<PendingSpikeDelta> {
        let mut deltas = Vec::new();
        for entry in self.buckets.iter_mut() {
            let count = entry.dropped_counter.swap(0, Ordering::Relaxed);
            if count > 0 {
                let sec = entry.last_seen_epoch_sec.load(Ordering::Relaxed);
                let last_seen =
                    chrono::DateTime::from_timestamp(sec, 0).unwrap_or_else(chrono::Utc::now);
                deltas.push(PendingSpikeDelta {
                    project_id: entry.key().0,
                    org_id: entry.org_id,
                    fingerprint: entry.key().1.clone(),
                    count_delta: count,
                    last_seen,
                });
            }
        }
        deltas
    }

    fn evict_if_needed(&self) {
        const MAX_KEYS: usize = 20_000;
        const IDLE: Duration = Duration::from_secs(30 * 60);
        if self.buckets.len() < MAX_KEYS {
            return;
        }
        self.buckets
            .retain(|_, bucket| bucket.token_bucket.last_refill.elapsed() < IDLE);
    }
}

impl Default for SpikeValve {
    fn default() -> Self {
        Self {
            buckets: DashMap::new(),
            rate_per_minute: DEFAULT_RATE_PER_MINUTE,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saturates_after_rate_limit() {
        let valve = SpikeValve::default();
        let fingerprint = "fp:test";

        for _ in 0..100 {
            assert_eq!(valve.check(fingerprint), SpikeDecision::AllowStore);
        }
        assert_eq!(valve.check(fingerprint), SpikeDecision::CounterOnly);
        let deltas = valve.take_pending_deltas();
        assert_eq!(deltas.len(), 1);
        assert_eq!(deltas[0].count_delta, 1);
    }

    #[test]
    fn exact_occurrence_counting_on_massive_flood() {
        let valve = SpikeValve::default();
        let fingerprint = "fp:infinite_loop";
        let total_events = 10_000;

        let mut stored_count = 0;
        let mut suppressed_count = 0;

        for _ in 0..total_events {
            match valve.check(fingerprint) {
                SpikeDecision::AllowStore => stored_count += 1,
                SpikeDecision::CounterOnly => suppressed_count += 1,
            }
        }

        // 100 diagnostic stack payloads stored in database
        assert_eq!(stored_count, 100);
        // 9,900 duplicate hits suppressed to prevent database overload & $0 overages
        assert_eq!(suppressed_count, 9_900);

        let deltas = valve.take_pending_deltas();
        assert_eq!(deltas.len(), 1);
        assert_eq!(deltas[0].count_delta, 9_900);
        assert_eq!(
            stored_count as u64 + deltas[0].count_delta,
            total_events as u64
        );

        // Taking deltas resets the in-memory counter
        let second_take = valve.take_pending_deltas();
        assert!(second_take.is_empty());
    }

    #[test]
    fn fingerprint_isolation_under_flood() {
        let valve = SpikeValve::default();
        let flooded_fp = "fp:webhook_timeout";
        let innocent_fp = "fp:auth_npe";

        // Saturate flooded_fp with 250 events
        for _ in 0..250 {
            let _ = valve.check(flooded_fp);
        }
        assert_eq!(valve.check(flooded_fp), SpikeDecision::CounterOnly);

        // Innocent fingerprint must NOT be choked by the neighbor's spike
        assert_eq!(valve.check(innocent_fp), SpikeDecision::AllowStore);
    }

    #[test]
    fn project_and_org_scoped_isolation() {
        let valve = SpikeValve::default();
        let org_a = Uuid::new_v4();
        let org_b = Uuid::new_v4();
        let proj_a = Uuid::new_v4();
        let proj_b = Uuid::new_v4();
        let common_fp = "fp:generic_type_error";

        // Saturate proj_a in org_a
        for _ in 0..100 {
            assert_eq!(
                valve.check_scoped(proj_a, org_a, common_fp),
                SpikeDecision::AllowStore
            );
        }
        assert_eq!(
            valve.check_scoped(proj_a, org_a, common_fp),
            SpikeDecision::CounterOnly
        );

        // proj_b in org_b sharing the same fingerprint string is completely isolated
        assert_eq!(
            valve.check_scoped(proj_b, org_b, common_fp),
            SpikeDecision::AllowStore
        );
    }
}
