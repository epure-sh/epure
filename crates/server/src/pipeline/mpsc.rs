use std::time::Instant;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub enum IngestJob {
    StoreEvent {
        event_id: Uuid,
        project_id: Uuid,
        org_id: Uuid,
        fingerprint: String,
        payload: Vec<u8>,
        user_agent: Option<String>,
        country_code_hint: Option<String>,
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
    tokio::sync::mpsc::Sender<IngestJob>,
    tokio::sync::mpsc::Receiver<IngestJob>,
) {
    tokio::sync::mpsc::channel(buffer)
}
