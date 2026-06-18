use epure_storage::{projects, PgPool};
use dashmap::DashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IngestAllowance {
    Allowed,
    Denied,
}

#[derive(Clone)]
pub struct IngestCapTracker {
    counters: Arc<DashMap<Uuid, (u64, u32)>>,
    caps: Arc<DashMap<Uuid, (u64, i32)>>,
    cap_alerts: Arc<DashMap<Uuid, u64>>,
}

impl IngestCapTracker {
    pub fn new() -> Self {
        Self {
            counters: Arc::new(DashMap::new()),
            caps: Arc::new(DashMap::new()),
            cap_alerts: Arc::new(DashMap::new()),
        }
    }

    fn current_hour() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_secs() / 3600)
            .unwrap_or(0)
    }

    async fn cap_for_project(
        &self,
        pool: &PgPool,
        project_id: Uuid,
    ) -> Result<i32, epure_storage::StorageError> {
        let hour = Self::current_hour();
        if let Some(entry) = self.caps.get(&project_id) {
            if entry.0 == hour {
                return Ok(entry.1);
            }
        }

        let cap = projects::ingest_cap_for_project(pool, project_id).await?;
        self.caps.insert(project_id, (hour, cap));
        Ok(cap)
    }

    /// Returns whether an ingest-cap alert should fire (once per project per hour).
    pub fn take_cap_alert_slot(&self, project_id: Uuid) -> bool {
        let hour = Self::current_hour();
        match self.cap_alerts.entry(project_id) {
            dashmap::mapref::entry::Entry::Occupied(mut entry) => {
                if *entry.get() == hour {
                    false
                } else {
                    *entry.get_mut() = hour;
                    true
                }
            }
            dashmap::mapref::entry::Entry::Vacant(entry) => {
                entry.insert(hour);
                true
            }
        }
    }

    pub async fn allow_ingest(
        &self,
        pool: &PgPool,
        project_id: Uuid,
    ) -> Result<IngestAllowance, epure_storage::StorageError> {
        let cap = self.cap_for_project(pool, project_id).await?;
        if cap <= 0 {
            return Ok(IngestAllowance::Denied);
        }

        let hour = Self::current_hour();
        let mut entry = self.counters.entry(project_id).or_insert((hour, 0));
        if entry.0 != hour {
            *entry = (hour, 0);
        }

        if entry.1 >= cap as u32 {
            return Ok(IngestAllowance::Denied);
        }

        entry.1 += 1;
        Ok(IngestAllowance::Allowed)
    }
}

impl Default for IngestCapTracker {
    fn default() -> Self {
        Self::new()
    }
}
