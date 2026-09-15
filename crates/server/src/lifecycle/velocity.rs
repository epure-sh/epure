use dashmap::DashMap;
use std::collections::VecDeque;
use std::sync::Arc;
use std::time::{Duration, Instant};
use uuid::Uuid;

const DEFAULT_WINDOW: Duration = Duration::from_secs(15 * 60);
const SPIKE_RATIO: f64 = 4.0;
const MIN_BASELINE: u32 = 1;

#[derive(Debug, Clone)]
pub struct VelocitySpike {
    pub current_window: u32,
    pub previous_window: u32,
    pub ratio: f64,
}

struct IssueVelocity {
    timestamps: VecDeque<Instant>,
}

fn window_duration() -> Duration {
    std::env::var("EPURE_VELOCITY_WINDOW_SECS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|seconds| *seconds > 0)
        .map(Duration::from_secs)
        .unwrap_or(DEFAULT_WINDOW)
}

impl IssueVelocity {
    fn record(&mut self, now: Instant) -> Option<VelocitySpike> {
        let window = window_duration();
        self.timestamps.push_back(now);
        self.prune(now, window);

        let current = self.count_in(now - window, now);
        let previous = self.count_in(now - window * 2, now - window);

        if previous < MIN_BASELINE {
            return None;
        }

        let ratio = current as f64 / previous as f64;
        if ratio > SPIKE_RATIO {
            Some(VelocitySpike {
                current_window: current,
                previous_window: previous,
                ratio,
            })
        } else {
            None
        }
    }

    fn prune(&mut self, now: Instant, window: Duration) {
        let cutoff = now - window * 2;
        while self
            .timestamps
            .front()
            .is_some_and(|timestamp| *timestamp < cutoff)
        {
            self.timestamps.pop_front();
        }
    }

    fn count_in(&self, start: Instant, end: Instant) -> u32 {
        self.timestamps
            .iter()
            .filter(|timestamp| **timestamp >= start && **timestamp < end)
            .count() as u32
    }
}

pub struct VelocityTracker {
    issues: DashMap<Uuid, IssueVelocity>,
}

impl VelocityTracker {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            issues: DashMap::new(),
        })
    }

    pub fn record(&self, issue_id: Uuid) -> Option<VelocitySpike> {
        self.record_at(issue_id, Instant::now())
    }

    fn record_at(&self, issue_id: Uuid, now: Instant) -> Option<VelocitySpike> {
        let mut entry = self
            .issues
            .entry(issue_id)
            .or_insert_with(|| IssueVelocity {
                timestamps: VecDeque::new(),
            });
        entry.record(now)
    }
}

impl Default for VelocityTracker {
    fn default() -> Self {
        Self {
            issues: DashMap::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_spike_over_300_percent() {
        let tracker = VelocityTracker::default();
        let issue_id = Uuid::new_v4();
        let now = Instant::now();

        for index in 0..5 {
            assert!(
                tracker
                    .record_at(issue_id, now - Duration::from_secs(20 * 60) + Duration::from_millis(index))
                    .is_none()
            );
        }

        for index in 0..25 {
            tracker.record_at(
                issue_id,
                now - Duration::from_secs(5 * 60) + Duration::from_millis(index),
            );
        }

        let spike = tracker.record_at(issue_id, now);
        assert!(spike.is_some());
        let spike = spike.expect("spike");
        assert!(spike.ratio > SPIKE_RATIO);
    }
}
