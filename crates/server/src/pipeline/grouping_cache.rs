use epure_envelope::{hash_from_i64, GroupingSeed, MultiFingerprint, ProjectGroupingIndex};
use epure_storage::{issues, PgPool};
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use uuid::Uuid;

/// Process-local pigeonhole index. The durable issue key is still the locus
/// fingerprint; this cache only attaches adjacent line-buckets to an issue
/// that was already stored.
pub struct GroupingCache {
    projects: Mutex<HashMap<Uuid, ProjectGroupingIndex>>,
    loaded: Mutex<HashSet<Uuid>>,
}

impl GroupingCache {
    pub fn new() -> Self {
        Self {
            projects: Mutex::new(HashMap::new()),
            loaded: Mutex::new(HashSet::new()),
        }
    }

    pub async fn resolve_issue_key(
        &self,
        pool: &PgPool,
        org_id: Uuid,
        project_id: Uuid,
        fp: &MultiFingerprint,
    ) -> String {
        if fp.custom {
            return fp.fingerprint.clone();
        }
        if let Err(err) = self.ensure_loaded(pool, org_id, project_id).await {
            tracing::warn!(error = %err, "grouping index warm failed");
        }
        let projects = self.projects.lock().unwrap_or_else(|err| err.into_inner());
        projects
            .get(&project_id)
            .and_then(|index| index.resolve(fp))
            .unwrap_or_else(|| fp.fingerprint.clone())
    }

    pub fn observe(&self, project_id: Uuid, fp: &MultiFingerprint, issue_fingerprint: &str) {
        if fp.custom {
            return;
        }
        let mut projects = self.projects.lock().unwrap_or_else(|err| err.into_inner());
        projects
            .entry(project_id)
            .or_default()
            .observe(fp, issue_fingerprint);
    }

    async fn ensure_loaded(
        &self,
        pool: &PgPool,
        org_id: Uuid,
        project_id: Uuid,
    ) -> Result<(), epure_storage::StorageError> {
        {
            let loaded = self.loaded.lock().unwrap_or_else(|err| err.into_inner());
            if loaded.contains(&project_id) {
                return Ok(());
            }
        }
        let rows = issues::load_grouping_seeds(pool, org_id, project_id).await?;
        let mut loaded = self.loaded.lock().unwrap_or_else(|err| err.into_inner());
        if loaded.contains(&project_id) {
            return Ok(());
        }
        let mut projects = self.projects.lock().unwrap_or_else(|err| err.into_inner());
        let index = projects.entry(project_id).or_default();
        for row in rows {
            let anchor = &row.grouping_anchor;
            index.load_seed(&GroupingSeed {
                fingerprint: row.fingerprint,
                h_exact: hash_from_i64(row.h_exact),
                h_locus: hash_from_i64(row.h_locus),
                h_sim: hash_from_i64(row.h_sim),
                exception_type: row.exception_type.unwrap_or_default(),
                file: anchor
                    .get("file")
                    .and_then(|value| value.as_str())
                    .unwrap_or("")
                    .to_string(),
                function: anchor
                    .get("function")
                    .and_then(|value| value.as_str())
                    .unwrap_or("")
                    .to_string(),
                line_bucket: anchor
                    .get("line_bucket")
                    .and_then(|value| value.as_u64())
                    .unwrap_or(0) as u32,
                col_bucket: anchor
                    .get("col_bucket")
                    .and_then(|value| value.as_u64())
                    .unwrap_or(0) as u32,
            });
        }
        loaded.insert(project_id);
        Ok(())
    }
}

impl Default for GroupingCache {
    fn default() -> Self {
        Self::new()
    }
}
