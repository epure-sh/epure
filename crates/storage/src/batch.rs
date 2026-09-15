use std::time::{Duration, Instant};

use sqlx::PgPool;

use crate::events::InsertEventParams;

const MAX_BATCH_EVENTS: usize = 500;
const MAX_BATCH_INTERVAL: Duration = Duration::from_millis(500);

pub struct EventBatchWriter {
    pool: PgPool,
    events: Vec<InsertEventParams>,
    last_flush: Instant,
}

impl EventBatchWriter {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            events: Vec::with_capacity(MAX_BATCH_EVENTS),
            last_flush: Instant::now(),
        }
    }

    pub async fn push(&mut self, event: InsertEventParams) -> Result<(), sqlx::Error> {
        self.events.push(event);
        if self.should_flush() {
            self.flush().await?;
        }
        Ok(())
    }

    pub async fn flush(&mut self) -> Result<(), sqlx::Error> {
        if self.events.is_empty() {
            return Ok(());
        }

        flush_events(&self.pool, &self.events).await?;
        self.events.clear();
        self.last_flush = Instant::now();
        Ok(())
    }

    fn should_flush(&self) -> bool {
        self.events.len() >= MAX_BATCH_EVENTS
            || self.last_flush.elapsed() >= MAX_BATCH_INTERVAL
    }
}

pub async fn flush_events(pool: &PgPool, events: &[InsertEventParams]) -> Result<(), sqlx::Error> {
    if events.is_empty() {
        return Ok(());
    }

    let mut builder = sqlx::QueryBuilder::new(
        "INSERT INTO events (
            id,
            org_id,
            project_id,
            issue_id,
            occurred_at,
            environment,
            release,
            platform,
            runtime_name,
            runtime_version,
            browser_name,
            os_name,
            country_code,
            user_id,
            user_email,
            payload_json,
            stack_frames,
            breadcrumbs
        ) ",
    );

    builder.push_values(events, |mut row, event| {
        row.push_bind(event.id)
            .push_bind(event.org_id)
            .push_bind(event.project_id)
            .push_bind(event.issue_id)
            .push_bind(event.occurred_at)
            .push_bind(&event.environment)
            .push_bind(&event.release)
            .push_bind(&event.platform)
            .push_bind(&event.runtime_name)
            .push_bind(&event.runtime_version)
            .push_bind(&event.browser_name)
            .push_bind(&event.os_name)
            .push_bind(&event.country_code)
            .push_bind(&event.user_id)
            .push_bind(&event.user_email)
            .push_bind(&event.payload_json)
            .push_bind(&event.stack_frames)
            .push_bind(&event.breadcrumbs);
    });

    builder.build().execute(pool).await?;
    Ok(())
}
