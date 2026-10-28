use dashmap::DashMap;
use epure_envelope::NoisePolicy;
use epure_storage::PgPool;
use std::time::{Duration, Instant};
use uuid::Uuid;

const TTL: Duration = Duration::from_secs(30);

/// Short cache so a burst does not read the noise policy on every request.
pub struct NoisePolicyCache {
    entries: DashMap<Uuid, (Instant, NoisePolicy)>,
}

impl NoisePolicyCache {
    pub fn new() -> Self {
        Self {
            entries: DashMap::new(),
        }
    }

    pub async fn get(&self, pool: &PgPool, org_id: Uuid, project_id: Uuid) -> NoisePolicy {
        if let Some(hit) = self.entries.get(&project_id) {
            if hit.value().0.elapsed() < TTL {
                return hit.value().1.clone();
            }
        }
        let policy = epure_storage::noise::get_noise_policy(pool, org_id, project_id)
            .await
            .unwrap_or_default();
        self.entries
            .insert(project_id, (Instant::now(), policy.clone()));
        policy
    }

    pub fn invalidate(&self, project_id: Uuid) {
        self.entries.remove(&project_id);
    }
}

impl Default for NoisePolicyCache {
    fn default() -> Self {
        Self::new()
    }
}
