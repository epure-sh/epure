use dashmap::DashMap;
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

pub struct SpikeValve {
    exact: DashMap<(Uuid, u64), ExactEntry>,
    locus: DashMap<(Uuid, u64), LocusEntry>,
    exact_rate_per_minute: f64,
    locus_rate_per_minute: f64,
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
            exact: DashMap::new(),
            locus: DashMap::new(),
            exact_rate_per_minute,
            locus_rate_per_minute,
        }
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
                exact.dropped = exact.dropped.saturating_add(1);
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
            locus.dropped = locus.dropped.saturating_add(1);
            locus.last_seen_epoch_sec = now;
            remember_variant(&mut locus.variants, input.variant_label);
            return SpikeDecision::CounterOnly;
        }

        let dominance = dominance_limit(input.project_cap_per_hour);
        if dominance > 0 && locus.stored >= dominance {
            locus.dropped = locus.dropped.saturating_add(1);
            locus.last_seen_epoch_sec = now;
            remember_variant(&mut locus.variants, input.variant_label);
            return SpikeDecision::CounterOnly;
        }

        locus.stored = locus.stored.saturating_add(1);
        SpikeDecision::AllowStore
    }

    pub fn take_pending_deltas(&self) -> Vec<PendingSpikeDelta> {
        let mut deltas = Vec::new();
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
}
