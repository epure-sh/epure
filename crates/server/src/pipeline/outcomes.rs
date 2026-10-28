use dashmap::DashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

const SPIKE_MINUTE_FLOOR: u32 = 30;
const SPIKE_RATIO: u32 = 6;
const DUPLICATE_WINDOW_SECS: i64 = 10 * 60;
const MAX_DUPLICATE_KEYS: usize = 50_000;

struct MinuteWindow {
    minute: u64,
    current: u32,
    previous: u32,
}

#[derive(Debug, Clone)]
pub struct OutcomeDelta {
    pub org_id: Uuid,
    pub project_id: Uuid,
    pub reason: String,
    pub count: u64,
}

#[derive(Debug, Clone)]
pub struct NoiseSpike {
    pub org_id: Uuid,
    pub project_id: Uuid,
    pub rule: String,
    pub detail: String,
    pub count_this_minute: u32,
    pub previous_minute: u32,
}

/// In-memory counts of what happened to events, plus a short duplicate-id cache.
pub struct OutcomeLedger {
    counts: DashMap<(Uuid, Uuid, String), u64>,
    minutes: DashMap<(Uuid, String), MinuteWindow>,
    alerted_hour: DashMap<(Uuid, String), u64>,
    seen_events: DashMap<(Uuid, Uuid), i64>,
    lag_ms: AtomicU64,
}

impl OutcomeLedger {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            counts: DashMap::new(),
            minutes: DashMap::new(),
            alerted_hour: DashMap::new(),
            seen_events: DashMap::new(),
            lag_ms: AtomicU64::new(0),
        })
    }

    pub fn record(
        &self,
        org_id: Uuid,
        project_id: Uuid,
        reason: &str,
        count: u64,
    ) -> Option<NoiseSpike> {
        if count == 0 || reason.is_empty() {
            return None;
        }
        *self
            .counts
            .entry((org_id, project_id, reason.to_string()))
            .or_insert(0) += count;
        if !reason.starts_with("noise:") {
            return None;
        }
        self.note_noise_minute(org_id, project_id, reason, count)
    }

    pub fn take(&self) -> Vec<OutcomeDelta> {
        let mut deltas = Vec::new();
        self.counts.retain(|key, count| {
            if *count == 0 {
                return false;
            }
            deltas.push(OutcomeDelta {
                org_id: key.0,
                project_id: key.1,
                reason: key.2.clone(),
                count: *count,
            });
            false
        });
        deltas
    }

    pub fn release_event_id(&self, project_id: Uuid, event_id: Uuid) {
        self.seen_events.remove(&(project_id, event_id));
    }

    /// `true` when this client event id has not been accepted in the last 10 minutes.
    pub fn claim_event_id(&self, project_id: Uuid, event_id: Uuid) -> bool {
        let now = chrono::Utc::now().timestamp();
        if self.seen_events.len() > MAX_DUPLICATE_KEYS {
            let cutoff = now - DUPLICATE_WINDOW_SECS;
            self.seen_events.retain(|_, seen| *seen >= cutoff);
        }
        match self.seen_events.entry((project_id, event_id)) {
            dashmap::mapref::entry::Entry::Occupied(entry) => {
                now - *entry.get() >= DUPLICATE_WINDOW_SECS && {
                    // The previous sighting expired. Treat this delivery as new.
                    *entry.into_ref() = now;
                    true
                }
            }
            dashmap::mapref::entry::Entry::Vacant(entry) => {
                entry.insert(now);
                true
            }
        }
    }

    pub fn note_lag_ms(&self, lag_ms: u64) {
        self.lag_ms.store(lag_ms, Ordering::Relaxed);
    }

    pub fn lag_ms(&self) -> u64 {
        self.lag_ms.load(Ordering::Relaxed)
    }

    fn note_noise_minute(
        &self,
        org_id: Uuid,
        project_id: Uuid,
        reason: &str,
        count: u64,
    ) -> Option<NoiseSpike> {
        let minute = current_minute();
        let added = u32::try_from(count).unwrap_or(u32::MAX);
        let mut window = self
            .minutes
            .entry((project_id, reason.to_string()))
            .or_insert(MinuteWindow {
                minute,
                current: 0,
                previous: 0,
            });
        if window.minute != minute {
            let gap = minute.saturating_sub(window.minute);
            if gap == 1 {
                window.previous = window.current;
            } else {
                window.previous = 0;
            }
            window.minute = minute;
            window.current = 0;
        }
        window.current = window.current.saturating_add(added);
        let current = window.current;
        let previous = window.previous;
        drop(window);

        let threshold = previous.saturating_mul(SPIKE_RATIO).max(SPIKE_MINUTE_FLOOR);
        if current < threshold || previous > 0 && current < previous.saturating_mul(SPIKE_RATIO) {
            return None;
        }
        let hour = current_minute() / 60;
        match self.alerted_hour.entry((project_id, reason.to_string())) {
            dashmap::mapref::entry::Entry::Occupied(mut entry) => {
                if *entry.get() == hour {
                    return None;
                }
                *entry.get_mut() = hour;
            }
            dashmap::mapref::entry::Entry::Vacant(entry) => {
                entry.insert(hour);
            }
        }
        let rule = reason.trim_start_matches("noise:").to_string();
        Some(NoiseSpike {
            org_id,
            project_id,
            rule,
            detail: reason.to_string(),
            count_this_minute: current,
            previous_minute: previous,
        })
    }
}

impl Default for OutcomeLedger {
    fn default() -> Self {
        Self {
            counts: DashMap::new(),
            minutes: DashMap::new(),
            alerted_hour: DashMap::new(),
            seen_events: DashMap::new(),
            lag_ms: AtomicU64::new(0),
        }
    }
}

fn current_minute() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() / 60)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn duplicate_event_id_is_claimed_once() {
        let ledger = OutcomeLedger::default();
        let project = Uuid::new_v4();
        let event = Uuid::new_v4();
        assert!(ledger.claim_event_id(project, event));
        assert!(!ledger.claim_event_id(project, event));
        assert!(ledger.claim_event_id(project, Uuid::new_v4()));
    }

    #[test]
    fn quiet_noise_rule_alerts_once_when_it_jumps() {
        let ledger = OutcomeLedger::default();
        let org = Uuid::new_v4();
        let project = Uuid::new_v4();
        assert!(ledger
            .record(org, project, "noise:chunk_load", 10)
            .is_none());
        let spike = ledger
            .record(org, project, "noise:chunk_load", 25)
            .expect("spike");
        assert_eq!(spike.count_this_minute, 35);
        assert!(ledger
            .record(org, project, "noise:chunk_load", 100)
            .is_none());
        let deltas = ledger.take();
        let total: u64 = deltas.iter().map(|delta| delta.count).sum();
        assert_eq!(total, 135);
    }

    #[test]
    fn stored_events_do_not_raise_a_noise_alert() {
        let ledger = OutcomeLedger::default();
        assert!(ledger
            .record(Uuid::new_v4(), Uuid::new_v4(), "queued", 1_000)
            .is_none());
    }
}
