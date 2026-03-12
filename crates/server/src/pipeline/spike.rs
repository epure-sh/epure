use dashmap::DashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

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

pub struct SpikeValve {
    buckets: DashMap<String, TokenBucket>,
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
        self.evict_if_needed();
        let mut entry = self
            .buckets
            .entry(fingerprint.to_string())
            .or_insert_with(|| TokenBucket::new(self.rate_per_minute));
        entry.check()
    }

    fn evict_if_needed(&self) {
        const MAX_KEYS: usize = 20_000;
        const IDLE: Duration = Duration::from_secs(30 * 60);
        if self.buckets.len() < MAX_KEYS {
            return;
        }
        self.buckets
            .retain(|_, bucket| bucket.last_refill.elapsed() < IDLE);
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
    }
}
