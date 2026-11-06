use dashmap::DashMap;
use std::collections::VecDeque;
use std::sync::Arc;
use std::time::{Duration, Instant};
use uuid::Uuid;

const DEFAULT_WINDOW: Duration = Duration::from_secs(15 * 60);
pub const SPIKE_RATIO: f64 = 4.0;
const MIN_BASELINE: u32 = 1;

#[derive(Debug, Clone)]
pub struct VelocitySpike {
    pub current_window: u32,
    pub previous_window: u32,
    pub ratio: f64,
}

#[derive(Debug, Clone)]
pub struct VelocitySnapshot {
    pub current_window: u32,
    pub previous_window: u32,
    pub ratio: f64,
}

struct IssueVelocity {
    timestamps: VecDeque<(Instant, u32)>,
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
    /// Insert one occurrence, then return the window that includes it.
    fn record(&mut self, now: Instant) -> Option<VelocitySnapshot> {
        let window = window_duration();
        let width = (window / 128).max(Duration::from_millis(1));
        if let Some((_, count)) = self
            .timestamps
            .back_mut()
            .filter(|(at, _)| now.saturating_duration_since(*at) < width)
        {
            *count = count.saturating_add(1);
        } else {
            self.timestamps.push_back((now, 1));
        }
        while self.timestamps.len() > 258 {
            self.timestamps.pop_front();
        }
        self.view(now)
    }

    /// Read the current and previous windows. Does not insert an occurrence.
    fn view(&mut self, now: Instant) -> Option<VelocitySnapshot> {
        let window = window_duration();
        self.prune(now, window);

        let current = self.count_in(now - window, now);
        let previous = self.count_in(now - window * 2, now - window);

        if previous < MIN_BASELINE {
            return None;
        }

        let ratio = current as f64 / previous as f64;
        Some(VelocitySnapshot {
            current_window: current,
            previous_window: previous,
            ratio,
        })
    }

    fn prune(&mut self, now: Instant, window: Duration) {
        let cutoff = now - window * 2;
        while self
            .timestamps
            .front()
            .is_some_and(|(timestamp, _)| *timestamp < cutoff)
        {
            self.timestamps.pop_front();
        }
    }

    fn count_in(&self, start: Instant, end: Instant) -> u32 {
        self.timestamps
            .iter()
            .filter(|(timestamp, _)| *timestamp >= start && *timestamp < end)
            .map(|(_, count)| *count)
            .fold(0, u32::saturating_add)
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

    /// Window after prior `record` calls. Does not count another event.
    pub fn snapshot(&self, issue_id: Uuid) -> Option<VelocitySnapshot> {
        self.snapshot_at(issue_id, Instant::now())
    }

    fn record_at(&self, issue_id: Uuid, now: Instant) -> Option<VelocitySpike> {
        self.write_at(issue_id, now).and_then(|snap| {
            if snap.ratio > SPIKE_RATIO {
                Some(VelocitySpike {
                    current_window: snap.current_window,
                    previous_window: snap.previous_window,
                    ratio: snap.ratio,
                })
            } else {
                None
            }
        })
    }

    fn write_at(&self, issue_id: Uuid, now: Instant) -> Option<VelocitySnapshot> {
        if self.issues.len() >= 5000 && !self.issues.contains_key(&issue_id) {
            self.issues.retain(|_, issue| {
                issue.prune(now, window_duration());
                !issue.timestamps.is_empty()
            });
            if self.issues.len() >= 5000 {
                return None;
            }
        }
        let mut entry = self
            .issues
            .entry(issue_id)
            .or_insert_with(|| IssueVelocity {
                timestamps: VecDeque::new(),
            });
        let snap = entry.record(now);
        let empty = entry.timestamps.is_empty();
        drop(entry);
        if empty {
            self.issues.remove(&issue_id);
        }
        if self.issues.len() > 20_000 {
            self.issues.retain(|_, issue| !issue.timestamps.is_empty());
        }
        snap
    }

    fn snapshot_at(&self, issue_id: Uuid, now: Instant) -> Option<VelocitySnapshot> {
        let mut entry = self.issues.get_mut(&issue_id)?;
        entry.view(now)
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
            assert!(tracker
                .record_at(
                    issue_id,
                    now - Duration::from_secs(20 * 60) + Duration::from_millis(index)
                )
                .is_none());
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

    #[test]
    fn snapshot_does_not_count_another_event() {
        let tracker = VelocityTracker::default();
        let issue_id = Uuid::new_v4();
        let now = Instant::now();

        for index in 0..4 {
            tracker.record_at(
                issue_id,
                now - Duration::from_secs(20 * 60) + Duration::from_millis(index),
            );
        }
        for index in 0..4 {
            tracker.record_at(
                issue_id,
                now - Duration::from_secs(5 * 60) + Duration::from_millis(index),
            );
        }

        let first = tracker.snapshot_at(issue_id, now).expect("window");
        let second = tracker.snapshot_at(issue_id, now).expect("same window");
        assert_eq!(first.current_window, second.current_window);
        assert_eq!(first.previous_window, second.previous_window);
        assert_eq!(first.current_window, 4);
        assert_eq!(first.previous_window, 4);
    }
}
