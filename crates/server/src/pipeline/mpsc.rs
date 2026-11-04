use std::time::Instant;
use uuid::Uuid;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum IngestJob {
    StoreEvent {
        event_id: Uuid,
        project_id: Uuid,
        org_id: Uuid,
        fingerprint: String,
        #[serde(with = "json_payload")]
        payload: Vec<u8>,
        user_agent: Option<String>,
        country_code_hint: Option<String>,
        #[serde(skip, default = "Instant::now")]
        accepted_at: Instant,
        /// The SDK supplied this id, so a second delivery is a duplicate, not a new crash.
        client_supplied_id: bool,
    },
    CounterOnly {
        project_id: Uuid,
        org_id: Uuid,
        fingerprint: String,
    },
}

pub fn channel(
    buffer: usize,
) -> (
    tokio::sync::mpsc::Sender<()>,
    tokio::sync::mpsc::Receiver<()>,
) {
    tokio::sync::mpsc::channel(buffer)
}

mod json_payload {
    use serde::{Deserialize, Deserializer, Serializer};
    pub fn serialize<S: Serializer>(bytes: &[u8], serializer: S) -> Result<S::Ok, S::Error> {
        let value: serde_json::Value =
            serde_json::from_slice(bytes).map_err(serde::ser::Error::custom)?;
        serde::Serialize::serialize(&value, serializer)
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Vec<u8>, D::Error> {
        let value = serde_json::Value::deserialize(deserializer)?;
        serde_json::to_vec(&value).map_err(serde::de::Error::custom)
    }
}
