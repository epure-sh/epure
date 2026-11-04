use chrono::{DateTime, Timelike, Utc};
use dashmap::DashMap;
use epure_envelope::{FrameFanInTracker, SessionAggItem, SessionStatus, SimHashLshRouter};
use epure_storage::{IssueCountDelta, SessionBucketDelta, TagFacetDelta, TelemetryDeltas};
use std::sync::atomic::{AtomicI64, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use uuid::Uuid;

/// Identical normalized events stored with a full body, per minute.
const EXACT_RATE_PER_MINUTE: f64 = 100.0;
/// Distinct variants of one throw site stored with a full body, per minute.
const LOCUS_RATE_PER_MINUTE: f64 = 150.0;
/// One crash site may consume at most this share of the hourly project cap.
const DOMINANCE_DENOMINATOR: i32 = 5;
const MAX_VARIANTS: usize = 5;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpikeDecision {
    AllowStore,
    CounterOnly,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpikeVerdict {
    AllowStore,
    SpikeCoalesced { wire_hash: u64 },
}

#[derive(Debug, Clone)]
struct VelocityState {
    fast_ewma: f64,
    slow_ewma: f64,
    last_event: Instant,
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

    fn take(&mut self) -> bool {
        self.refill();
        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
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

struct ExactEntry {
    token_bucket: TokenBucket,
    org_id: Uuid,
    fingerprint: String,
    dropped: u64,
    last_seen_epoch_sec: i64,
}

struct LocusEntry {
    token_bucket: TokenBucket,
    org_id: Uuid,
    fingerprint: String,
    dropped: u64,
    last_seen_epoch_sec: i64,
    hour: u64,
    stored: u32,
    variants: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct PendingSpikeDelta {
    pub project_id: Uuid,
    pub org_id: Uuid,
    pub fingerprint: String,
    pub count_delta: u64,
    pub last_seen: chrono::DateTime<chrono::Utc>,
    pub variants: Vec<String>,
}

pub struct GroupedSpikeInput<'a> {
    pub fingerprint: &'a str,
    pub h_exact: u64,
    pub h_locus: u64,
    pub project_cap_per_hour: i32,
    pub variant_label: &'a str,
}

type SessionBucketMap =
    DashMap<(Uuid, Uuid, String, String, DateTime<Utc>), (AtomicI64, AtomicI64, AtomicI64)>;

#[derive(Debug)]
pub struct SamplerCapacityError;

pub struct SpikeValve {
    admission: std::sync::Mutex<()>,
    pending_retries: std::sync::Mutex<Vec<PendingSpikeDelta>>,
    exact: DashMap<(Uuid, u64), ExactEntry>,
    locus: DashMap<(Uuid, u64), LocusEntry>,
    exact_rate_per_minute: f64,
    locus_rate_per_minute: f64,

    // Stage 1 Wire Filter
    wire_counts: DashMap<(Uuid, u64), (Arc<AtomicU64>, Instant)>,
    wire_to_issue: DashMap<(Uuid, u64), (Uuid, Uuid)>, // (project_id, wire_hash) -> (org_id, issue_id)
    confirmed_issues: DashMap<(Uuid, u64), Uuid>,

    // Real-time Dual-Window EWMA Velocity
    velocity_states: DashMap<Uuid, VelocityState>,

    // In-memory Grouping & LSH State
    pub fan_in_tracker: FrameFanInTracker,
    pub lsh_router: SimHashLshRouter,

    // In-memory Telemetry Accumulators for high-performance micro-batch flushing
    tag_facets: DashMap<(Uuid, Uuid, String, String), AtomicI64>, // (org_id, issue_id, key, val)
    session_buckets: SessionBucketMap, // (org_id, project_id, release, env, bucket_minute)
    issue_counts: DashMap<(Uuid, Uuid, Uuid, String, DateTime<Utc>), AtomicI64>, // (org_id, project_id, issue_id, fingerprint, hour_start)
}

impl SpikeValve {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::with_rates(
            EXACT_RATE_PER_MINUTE,
            LOCUS_RATE_PER_MINUTE,
        ))
    }

    pub fn with_rates(exact_rate_per_minute: f64, locus_rate_per_minute: f64) -> Self {
        Self {
            admission: std::sync::Mutex::new(()),
            pending_retries: std::sync::Mutex::new(Vec::new()),
            exact: DashMap::new(),
            locus: DashMap::new(),
            exact_rate_per_minute,
            locus_rate_per_minute,
            wire_counts: DashMap::new(),
            wire_to_issue: DashMap::new(),
            confirmed_issues: DashMap::new(),
            velocity_states: DashMap::new(),
            fan_in_tracker: FrameFanInTracker::new(),
            lsh_router: SimHashLshRouter::new(),
            tag_facets: DashMap::new(),
            session_buckets: DashMap::new(),
            issue_counts: DashMap::new(),
        }
    }

    /// Fast wire filter checking raw hash before sourcemap lookup.
    /// If an identical payload is seen > 5 times in a 1-second slot, immediately coalesces it.
    pub fn check_wire_spike(&self, project_id: Uuid, wire_hash: u64) -> SpikeVerdict {
        let now = Instant::now();
        let mut entry = self
            .wire_counts
            .entry((project_id, wire_hash))
            .or_insert_with(|| (Arc::new(AtomicU64::new(0)), now));

        if entry.1.elapsed() >= Duration::from_secs(1) {
            entry.0.store(1, Ordering::Relaxed);
            entry.1 = now;
            SpikeVerdict::AllowStore
        } else {
            let count = entry.0.fetch_add(1, Ordering::Relaxed) + 1;
            if count > 5 {
                if let Some(target) = self.wire_to_issue.get(&(project_id, wire_hash)) {
                    let (org_id, issue_id) = *target;
                    let hour_start = Utc::now()
                        .date_naive()
                        .and_hms_opt(Utc::now().hour(), 0, 0)
                        .unwrap()
                        .and_utc();
                    let key = (
                        org_id,
                        project_id,
                        issue_id,
                        format!("wire:{wire_hash:016x}"),
                        hour_start,
                    );
                    let counter = self
                        .issue_counts
                        .entry(key)
                        .or_insert_with(|| AtomicI64::new(0));
                    counter.fetch_add(1, Ordering::Relaxed);
                    return SpikeVerdict::SpikeCoalesced { wire_hash };
                }
                SpikeVerdict::AllowStore
            } else {
                SpikeVerdict::AllowStore
            }
        }
    }

    /// Bridges post-demangle canonical grouping results back to wire hash & confirmed issues.
    pub fn bridge_wire_to_canonical(
        &self,
        org_id: Uuid,
        project_id: Uuid,
        wire_hash: u64,
        canonical_locus: u64,
        issue_id: Uuid,
    ) {
        self.wire_to_issue
            .insert((project_id, wire_hash), (org_id, issue_id));
        self.confirmed_issues
            .insert((project_id, canonical_locus), issue_id);
    }

    pub fn lookup_confirmed_issue(&self, project_id: Uuid, canonical_locus: u64) -> Option<Uuid> {
        self.confirmed_issues
            .get(&(project_id, canonical_locus))
            .map(|r| *r)
    }

    /// Records an event occurrence and evaluates dual-window EWMA velocity.
    /// Returns (fast_ewma, velocity_ratio, is_spike_detected).
    pub fn record_velocity(&self, issue_id: Uuid) -> (f64, f64, bool) {
        let now = Instant::now();
        let mut entry = self
            .velocity_states
            .entry(issue_id)
            .or_insert_with(|| VelocityState {
                fast_ewma: 0.0,
                slow_ewma: 0.0,
                last_event: now,
            });

        let dt = entry.last_event.elapsed().as_secs_f64().max(0.001);
        entry.last_event = now;

        // Exponential decay based on elapsed time
        let alpha_fast = (dt / 60.0).min(1.0);
        let alpha_slow = (dt / 3600.0).min(1.0);

        let current_instant_rate = 1.0 / dt;
        entry.fast_ewma = (1.0 - alpha_fast) * entry.fast_ewma + alpha_fast * current_instant_rate;
        entry.slow_ewma = (1.0 - alpha_slow) * entry.slow_ewma + alpha_slow * current_instant_rate;

        let ratio = entry.fast_ewma / entry.slow_ewma.max(0.01);
        let spike_detected = ratio > 5.0 && entry.fast_ewma > 10.0;

        (entry.fast_ewma, ratio, spike_detected)
    }

    /// Record a tag facet occurrence in memory without touching PostgreSQL.
    pub fn record_tag_facet(&self, org_id: Uuid, issue_id: Uuid, key: &str, value: &str) {
        if key.is_empty() || value.is_empty() {
            return;
        }
        let map_key = (org_id, issue_id, key.to_string(), value.to_string());
        let counter = self
            .tag_facets
            .entry(map_key)
            .or_insert_with(|| AtomicI64::new(0));
        counter.fetch_add(1, Ordering::Relaxed);
    }

    /// Record an extracted session aggregate into the in-memory bucket.
    pub fn record_session_agg(&self, org_id: Uuid, project_id: Uuid, item: &SessionAggItem) {
        let now = Utc::now();
        let bucket_minute = now
            .date_naive()
            .and_hms_opt(now.hour(), now.minute(), 0)
            .unwrap()
            .and_utc();

        let key = (
            org_id,
            project_id,
            item.release.clone(),
            item.environment.clone(),
            bucket_minute,
        );
        let entry = self
            .session_buckets
            .entry(key)
            .or_insert_with(|| (AtomicI64::new(0), AtomicI64::new(0), AtomicI64::new(0)));

        let count = item.count as i64;
        entry.0.fetch_add(count, Ordering::Relaxed);
        match item.status {
            SessionStatus::Crashed => {
                entry.1.fetch_add(count, Ordering::Relaxed);
            }
            SessionStatus::Abnormal => {
                entry.2.fetch_add(count, Ordering::Relaxed);
            }
            _ => {
                if item.errors > 0 {
                    entry.2.fetch_add(count, Ordering::Relaxed);
                }
            }
        }
    }

    pub fn record_issue_count_delta(
        &self,
        org_id: Uuid,
        project_id: Uuid,
        issue_id: Uuid,
        fingerprint: &str,
        delta: i64,
    ) {
        let hour_start = Utc::now()
            .date_naive()
            .and_hms_opt(Utc::now().hour(), 0, 0)
            .unwrap()
            .and_utc();
        let key = (
            org_id,
            project_id,
            issue_id,
            fingerprint.to_string(),
            hour_start,
        );
        let counter = self
            .issue_counts
            .entry(key)
            .or_insert_with(|| AtomicI64::new(0));
        counter.fetch_add(delta, Ordering::Relaxed);
    }

    /// Drains all accumulated in-memory telemetry deltas for bulk flush.
    pub fn take_telemetry_deltas(&self) -> TelemetryDeltas {
        let mut deltas = TelemetryDeltas::default();

        // Drain issue counts
        self.issue_counts.retain(|key, value| {
            let count = value.swap(0, Ordering::Relaxed);
            if count > 0 {
                deltas.issue_counts.push(IssueCountDelta {
                    org_id: key.0,
                    project_id: key.1,
                    issue_id: key.2,
                    fingerprint: key.3.clone(),
                    window_start: key.4,
                    count_delta: count,
                });
            }
            false
        });

        // Drain tag facets
        self.tag_facets.retain(|key, value| {
            let count = value.swap(0, Ordering::Relaxed);
            if count > 0 {
                deltas.tag_facets.push(TagFacetDelta {
                    org_id: key.0,
                    issue_id: key.1,
                    tag_key: key.2.clone(),
                    tag_value: key.3.clone(),
                    count,
                });
            }
            false
        });

        // Drain sessions
        self.session_buckets.retain(|key, value| {
            let started = value.0.swap(0, Ordering::Relaxed);
            let crashed = value.1.swap(0, Ordering::Relaxed);
            let errored = value.2.swap(0, Ordering::Relaxed);

            if started > 0 || crashed > 0 || errored > 0 {
                deltas.sessions.push(SessionBucketDelta {
                    org_id: key.0,
                    project_id: key.1,
                    release: key.2.clone(),
                    environment: key.3.clone(),
                    bucket_minute: key.4,
                    sessions_started: started,
                    sessions_crashed: crashed,
                    sessions_errored: errored,
                    duration_ms_p50: None,
                });
            }
            false
        });

        deltas
    }

    pub fn restore_telemetry_deltas(&self, deltas: TelemetryDeltas) {
        for d in deltas.issue_counts {
            self.issue_counts
                .entry((
                    d.org_id,
                    d.project_id,
                    d.issue_id,
                    d.fingerprint,
                    d.window_start,
                ))
                .or_insert_with(|| AtomicI64::new(0))
                .fetch_add(d.count_delta, Ordering::Relaxed);
        }
        for d in deltas.tag_facets {
            self.tag_facets
                .entry((d.org_id, d.issue_id, d.tag_key, d.tag_value))
                .or_insert_with(|| AtomicI64::new(0))
                .fetch_add(d.count, Ordering::Relaxed);
        }
        for d in deltas.sessions {
            let entry = self
                .session_buckets
                .entry((
                    d.org_id,
                    d.project_id,
                    d.release,
                    d.environment,
                    d.bucket_minute,
                ))
                .or_insert_with(|| (AtomicI64::new(0), AtomicI64::new(0), AtomicI64::new(0)));
            entry.0.fetch_add(d.sessions_started, Ordering::Relaxed);
            entry.1.fetch_add(d.sessions_crashed, Ordering::Relaxed);
            entry.2.fetch_add(d.sessions_errored, Ordering::Relaxed);
        }
    }

    pub fn restore_pending_delta(&self, delta: PendingSpikeDelta) {
        self.pending_retries
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .push(delta);
    }

    pub fn check(&self, fingerprint: &str) -> SpikeDecision {
        self.check_scoped(Uuid::nil(), Uuid::nil(), fingerprint)
    }

    pub fn check_scoped(&self, project_id: Uuid, org_id: Uuid, fingerprint: &str) -> SpikeDecision {
        let hash = fingerprint_hash(fingerprint);
        self.check_grouped(
            project_id,
            org_id,
            GroupedSpikeInput {
                fingerprint,
                h_exact: hash,
                h_locus: hash,
                project_cap_per_hour: 0,
                variant_label: "",
            },
        )
    }

    /// Tier 1 limits one exact variant. Tier 2 limits the whole crash site.
    /// Events refused here must not be charged against the project cap.
    pub fn check_grouped(
        &self,
        project_id: Uuid,
        org_id: Uuid,
        input: GroupedSpikeInput<'_>,
    ) -> SpikeDecision {
        self.check_grouped_inner(project_id, org_id, input, true)
    }
    pub fn classify_grouped(
        &self,
        project_id: Uuid,
        org_id: Uuid,
        input: GroupedSpikeInput<'_>,
    ) -> Result<SpikeDecision, SamplerCapacityError> {
        let _guard = self.admission.lock().unwrap_or_else(|e| e.into_inner());
        self.evict_if_needed();
        if (!self.exact.contains_key(&(project_id, input.h_exact)) && self.exact.len() >= 20000)
            || (!self.locus.contains_key(&(project_id, input.h_locus)) && self.locus.len() >= 20000)
        {
            return Err(SamplerCapacityError);
        }
        if !self.exact.contains_key(&(project_id, input.h_exact))
            && self
                .exact
                .iter()
                .filter(|e| e.key().0 == project_id)
                .count()
                >= 1024
        {
            return Err(SamplerCapacityError);
        }
        if !self.locus.contains_key(&(project_id, input.h_locus))
            && self
                .locus
                .iter()
                .filter(|e| e.key().0 == project_id)
                .count()
                >= 1024
        {
            return Err(SamplerCapacityError);
        }
        Ok(self.check_grouped_inner(project_id, org_id, input, false))
    }
    fn check_grouped_inner(
        &self,
        project_id: Uuid,
        org_id: Uuid,
        input: GroupedSpikeInput<'_>,
        record: bool,
    ) -> SpikeDecision {
        self.evict_if_needed();
        let now = chrono::Utc::now().timestamp();

        {
            let mut exact = self
                .exact
                .entry((project_id, input.h_exact))
                .or_insert_with(|| ExactEntry {
                    token_bucket: TokenBucket::new(self.exact_rate_per_minute),
                    org_id,
                    fingerprint: input.fingerprint.to_string(),
                    dropped: 0,
                    last_seen_epoch_sec: now,
                });
            exact.org_id = org_id;
            exact.fingerprint = input.fingerprint.to_string();
            if !exact.token_bucket.take() {
                if record {
                    exact.dropped = exact.dropped.saturating_add(1);
                }
                exact.last_seen_epoch_sec = now;
                return SpikeDecision::CounterOnly;
            }
        }

        let mut locus = self
            .locus
            .entry((project_id, input.h_locus))
            .or_insert_with(|| LocusEntry {
                token_bucket: TokenBucket::new(self.locus_rate_per_minute),
                org_id,
                fingerprint: input.fingerprint.to_string(),
                dropped: 0,
                last_seen_epoch_sec: now,
                hour: current_hour(),
                stored: 0,
                variants: Vec::new(),
            });
        locus.org_id = org_id;
        locus.fingerprint = input.fingerprint.to_string();
        let hour = current_hour();
        if locus.hour != hour {
            locus.hour = hour;
            locus.stored = 0;
        }

        if !locus.token_bucket.take() {
            if record {
                locus.dropped = locus.dropped.saturating_add(1);
            }
            locus.last_seen_epoch_sec = now;
            remember_variant(&mut locus.variants, input.variant_label);
            return SpikeDecision::CounterOnly;
        }

        let dominance = dominance_limit(input.project_cap_per_hour);
        if dominance > 0 && locus.stored >= dominance {
            if record {
                locus.dropped = locus.dropped.saturating_add(1);
            }
            locus.last_seen_epoch_sec = now;
            remember_variant(&mut locus.variants, input.variant_label);
            return SpikeDecision::CounterOnly;
        }

        locus.stored = locus.stored.saturating_add(1);
        SpikeDecision::AllowStore
    }

    pub fn take_pending_deltas(&self) -> Vec<PendingSpikeDelta> {
        let mut deltas = std::mem::take(
            &mut *self
                .pending_retries
                .lock()
                .unwrap_or_else(|e| e.into_inner()),
        );
        for mut entry in self.exact.iter_mut() {
            if entry.dropped == 0 {
                continue;
            }
            let count = std::mem::take(&mut entry.dropped);
            deltas.push(delta_from(
                entry.key().0,
                entry.org_id,
                &entry.fingerprint,
                count,
                entry.last_seen_epoch_sec,
                Vec::new(),
            ));
        }
        for mut entry in self.locus.iter_mut() {
            if entry.dropped == 0 {
                continue;
            }
            let count = std::mem::take(&mut entry.dropped);
            let variants = std::mem::take(&mut entry.variants);
            deltas.push(delta_from(
                entry.key().0,
                entry.org_id,
                &entry.fingerprint,
                count,
                entry.last_seen_epoch_sec,
                variants,
            ));
        }
        deltas
    }

    fn evict_if_needed(&self) {
        const MAX_KEYS: usize = 20_000;
        const IDLE: Duration = Duration::from_secs(30 * 60);
        if self.exact.len() >= MAX_KEYS {
            self.exact
                .retain(|_, bucket| bucket.token_bucket.last_refill.elapsed() < IDLE);
        }
        if self.locus.len() >= MAX_KEYS {
            self.locus
                .retain(|_, bucket| bucket.token_bucket.last_refill.elapsed() < IDLE);
        }
    }
}

impl Default for SpikeValve {
    fn default() -> Self {
        Self::with_rates(EXACT_RATE_PER_MINUTE, LOCUS_RATE_PER_MINUTE)
    }
}

fn dominance_limit(project_cap_per_hour: i32) -> u32 {
    if project_cap_per_hour <= 0 {
        return 0;
    }
    (project_cap_per_hour / DOMINANCE_DENOMINATOR).max(0) as u32
}

fn remember_variant(variants: &mut Vec<String>, label: &str) {
    let label = label.trim();
    if label.is_empty() || variants.iter().any(|existing| existing == label) {
        return;
    }
    if variants.len() >= MAX_VARIANTS {
        return;
    }
    variants.push(label.to_string());
}

fn delta_from(
    project_id: Uuid,
    org_id: Uuid,
    fingerprint: &str,
    count_delta: u64,
    last_seen_epoch_sec: i64,
    variants: Vec<String>,
) -> PendingSpikeDelta {
    let last_seen =
        chrono::DateTime::from_timestamp(last_seen_epoch_sec, 0).unwrap_or_else(chrono::Utc::now);
    PendingSpikeDelta {
        project_id,
        org_id,
        fingerprint: fingerprint.to_string(),
        count_delta,
        last_seen,
        variants,
    }
}

fn current_hour() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() / 3600)
        .unwrap_or(0)
}

fn fingerprint_hash(fingerprint: &str) -> u64 {
    // FNV-1a. Legacy string keys only; persisted fingerprints use XXH64.
    let mut hash = 0xcbf2_9ce4_8422_2325u64;
    for byte in fingerprint.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100_0000_01b3);
    }
    hash
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

        assert_eq!(stored_count, 100);
        assert_eq!(suppressed_count, 9_900);

        let deltas = valve.take_pending_deltas();
        assert_eq!(deltas.len(), 1);
        assert_eq!(deltas[0].count_delta, 9_900);
        assert_eq!(
            stored_count as u64 + deltas[0].count_delta,
            total_events as u64
        );

        let second_take = valve.take_pending_deltas();
        assert!(second_take.is_empty());
    }

    #[test]
    fn fingerprint_isolation_under_flood() {
        let valve = SpikeValve::default();
        let flooded_fp = "fp:webhook_timeout";
        let innocent_fp = "fp:auth_npe";

        for _ in 0..250 {
            let _ = valve.check(flooded_fp);
        }
        assert_eq!(valve.check(flooded_fp), SpikeDecision::CounterOnly);
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
        assert_eq!(
            valve.check_scoped(proj_b, org_b, common_fp),
            SpikeDecision::AllowStore
        );
    }

    #[test]
    fn locus_valve_coalesces_polymorphic_variants() {
        let valve = SpikeValve::with_rates(10_000.0, 150.0);
        let project = Uuid::new_v4();
        let org = Uuid::new_v4();
        let mut stored = 0;
        let mut coalesced = 0;
        for index in 0..4_000 {
            let decision = valve.check_grouped(
                project,
                org,
                GroupedSpikeInput {
                    fingerprint: "locus-issue",
                    h_exact: index,
                    h_locus: 7,
                    project_cap_per_hour: 5_000,
                    variant_label: &format!("caller-{index} | timed out after <NUM>ms"),
                },
            );
            match decision {
                SpikeDecision::AllowStore => stored += 1,
                SpikeDecision::CounterOnly => coalesced += 1,
            }
        }
        assert_eq!(stored, 150);
        assert_eq!(coalesced, 3_850);
        let deltas = valve.take_pending_deltas();
        let total: u64 = deltas.iter().map(|delta| delta.count_delta).sum();
        assert_eq!(total, 3_850);
        assert!(deltas
            .iter()
            .all(|delta| delta.fingerprint == "locus-issue"));
        let variants: usize = deltas.iter().map(|delta| delta.variants.len()).sum();
        assert_eq!(variants, 5);
    }

    #[test]
    fn dominance_reserves_quota_for_other_crash_sites() {
        let valve = SpikeValve::with_rates(10_000.0, 10_000.0);
        let project = Uuid::new_v4();
        let org = Uuid::new_v4();
        let mut stored = 0;
        for _ in 0..1_200 {
            if valve.check_grouped(
                project,
                org,
                GroupedSpikeInput {
                    fingerprint: "hot-locus",
                    h_exact: 1,
                    h_locus: 1,
                    project_cap_per_hour: 5_000,
                    variant_label: "",
                },
            ) == SpikeDecision::AllowStore
            {
                stored += 1;
            }
        }
        // 20% of 5,000.
        assert_eq!(stored, 1_000);
        assert_eq!(
            valve.check_grouped(
                project,
                org,
                GroupedSpikeInput {
                    fingerprint: "other-locus",
                    h_exact: 2,
                    h_locus: 2,
                    project_cap_per_hour: 5_000,
                    variant_label: "",
                },
            ),
            SpikeDecision::AllowStore
        );
    }

    #[test]
    fn wire_spike_valve_coalesces_fast_repeats_and_bridges() {
        let valve = SpikeValve::default();
        let org_id = Uuid::new_v4();
        let project_id = Uuid::new_v4();
        let issue_id = Uuid::new_v4();
        let wire_hash = 0xabcdef1234567890u64;
        let locus = 42u64;

        valve.bridge_wire_to_canonical(org_id, project_id, wire_hash, locus, issue_id);
        assert_eq!(
            valve.lookup_confirmed_issue(project_id, locus),
            Some(issue_id)
        );

        // First 5 events in same slot allowed
        for _ in 0..5 {
            assert_eq!(
                valve.check_wire_spike(project_id, wire_hash),
                SpikeVerdict::AllowStore
            );
        }

        // 6th event coalesced
        assert_eq!(
            valve.check_wire_spike(project_id, wire_hash),
            SpikeVerdict::SpikeCoalesced { wire_hash }
        );

        let deltas = valve.take_telemetry_deltas();
        assert_eq!(deltas.issue_counts.len(), 1);
        assert_eq!(deltas.issue_counts[0].count_delta, 1);
        assert_eq!(deltas.issue_counts[0].issue_id, issue_id);
        assert_eq!(deltas.issue_counts[0].org_id, org_id);
    }

    #[test]
    fn in_ram_tag_facets_and_session_buckets_collected() {
        let valve = SpikeValve::default();
        let org_id = Uuid::new_v4();
        let project_id = Uuid::new_v4();
        let issue_id = Uuid::new_v4();

        valve.record_tag_facet(org_id, issue_id, "browser", "Chrome");
        valve.record_tag_facet(org_id, issue_id, "browser", "Chrome");
        valve.record_tag_facet(org_id, issue_id, "os", "macOS");

        let session_item = SessionAggItem {
            release: "v1.2.3".to_string(),
            environment: "production".to_string(),
            status: SessionStatus::Crashed,
            errors: 1,
            distinct_id: None,
            count: 3,
        };
        valve.record_session_agg(org_id, project_id, &session_item);

        let deltas = valve.take_telemetry_deltas();
        assert_eq!(deltas.tag_facets.len(), 2);
        assert_eq!(deltas.sessions.len(), 1);
        assert_eq!(deltas.sessions[0].sessions_started, 3);
        assert_eq!(deltas.sessions[0].sessions_crashed, 3);
        assert_eq!(deltas.sessions[0].org_id, org_id);
    }
}

#[cfg(test)]
mod audit_tests {
    use super::*;
    #[test]
    fn unbound_wire_flood_is_never_discarded() {
        let valve = SpikeValve::default();
        let project = Uuid::new_v4();
        for _ in 0..100 {
            assert_eq!(
                valve.check_wire_spike(project, 42),
                SpikeVerdict::AllowStore
            );
        }
    }
    #[test]
    fn concurrent_counter_drains_conserve_every_increment() {
        let valve = Arc::new(SpikeValve::default());
        let (org, project, issue) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
        let done = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let handles: Vec<_> = (0..8)
            .map(|_| {
                let valve = valve.clone();
                let done = done.clone();
                std::thread::spawn(move || {
                    for _ in 0..20000 {
                        valve.record_issue_count_delta(org, project, issue, "fp", 1);
                        valve.record_tag_facet(org, issue, "key", "value");
                    }
                    done.fetch_add(1, Ordering::SeqCst);
                })
            })
            .collect();
        let (mut counts, mut tags) = (0, 0);
        while done.load(Ordering::SeqCst) < 8 {
            let d = valve.take_telemetry_deltas();
            counts += d.issue_counts.iter().map(|v| v.count_delta).sum::<i64>();
            tags += d.tag_facets.iter().map(|v| v.count).sum::<i64>();
            std::thread::yield_now();
        }
        for h in handles {
            h.join().unwrap();
        }
        let d = valve.take_telemetry_deltas();
        counts += d.issue_counts.iter().map(|v| v.count_delta).sum::<i64>();
        tags += d.tag_facets.iter().map(|v| v.count).sum::<i64>();
        assert_eq!(counts, 160000);
        assert_eq!(tags, 160000);
    }
}

#[cfg(test)]
mod bounded_admission_tests {
    use super::*;
    #[test]
    fn high_cardinality_project_is_bounded_without_blocking_another_project() {
        let valve = SpikeValve::default();
        let project = Uuid::new_v4();
        let org = Uuid::new_v4();
        for n in 0..1024 {
            assert!(valve
                .classify_grouped(
                    project,
                    org,
                    GroupedSpikeInput {
                        fingerprint: "fp",
                        h_exact: n,
                        h_locus: n,
                        project_cap_per_hour: 0,
                        variant_label: ""
                    }
                )
                .is_ok());
        }
        assert!(valve
            .classify_grouped(
                project,
                org,
                GroupedSpikeInput {
                    fingerprint: "new",
                    h_exact: 1025,
                    h_locus: 1025,
                    project_cap_per_hour: 0,
                    variant_label: ""
                }
            )
            .is_err());
        assert_eq!(valve.exact.len(), 1024);
        assert_eq!(valve.locus.len(), 1024);
        assert!(valve
            .classify_grouped(
                Uuid::new_v4(),
                org,
                GroupedSpikeInput {
                    fingerprint: "cold",
                    h_exact: 1,
                    h_locus: 1,
                    project_cap_per_hour: 0,
                    variant_label: ""
                }
            )
            .is_ok());
        assert!(valve.take_pending_deltas().is_empty());
    }
}
