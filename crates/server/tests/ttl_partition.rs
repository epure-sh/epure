mod support;

use chrono::{TimeZone, Utc};
use epure_server::jobs::ttl::run_ttl_once;
use epure_storage::{connect, connect_pools, partitions, run_migrations};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

fn org_id() -> Uuid {
    Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap()
}

fn project_id() -> Uuid {
    Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap()
}

#[tokio::test]
async fn ttl_drops_old_partition_preserving_issue_counts() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url)
        .await
        .expect("connect migrate pool");
    run_migrations(&migrate_pool)
        .await
        .expect("run migrations");

    let pools = connect_pools(&database_url).await.expect("connect pools");
    support::seed_dev_pool(&pools.ingest).await.expect("seed dev");

    let partition_name = partitions::create_partition_for_month(&pools.ingest, 2020, 1)
        .await
        .expect("create backdated partition");
    assert!(
        partitions::partition_exists(&pools.ingest, &partition_name)
            .await
            .expect("partition exists")
    );

    let issue_id = Uuid::new_v4();
    let event_id = Uuid::new_v4();
    let fingerprint = format!("ttl-test-fp-{}", Uuid::new_v4());
    let occurred_at = Utc.with_ymd_and_hms(2020, 1, 15, 12, 0, 0).unwrap();

    sqlx::query(
        r#"
        INSERT INTO issues (
            id, org_id, project_id, fingerprint, title, status, first_seen_at, last_seen_at, event_count
        )
        VALUES ($1, $2, $3, $4, 'TTL test issue', 'unresolved', $5, $5, 7)
        "#,
    )
    .bind(issue_id)
    .bind(org_id())
    .bind(project_id())
    .bind(&fingerprint)
    .bind(occurred_at)
    .execute(&pools.ingest)
    .await
    .expect("insert issue");

    sqlx::query(
        r#"
        INSERT INTO events (
            id, org_id, project_id, issue_id, occurred_at, payload_json
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(event_id)
    .bind(org_id())
    .bind(project_id())
    .bind(issue_id)
    .bind(occurred_at)
    .bind(json!({"message": "old event"}))
    .execute(&pools.ingest)
    .await
    .expect("insert backdated event");

    let dropped = run_ttl_once(&pools.ingest)
        .await
        .expect("run ttl once");
    assert!(
        dropped.iter().any(|name| name == &partition_name),
        "expected partition {partition_name} to be dropped, got: {dropped:?}"
    );
    assert!(
        !partitions::partition_exists(&pools.ingest, &partition_name)
            .await
            .expect("partition exists check")
    );

    let event_count = issue_event_count(&pools.ingest, issue_id)
        .await
        .expect("issue event count");
    assert_eq!(event_count, 7);
}

async fn issue_event_count(pool: &PgPool, issue_id: Uuid) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar("SELECT event_count FROM issues WHERE id = $1")
        .bind(issue_id)
        .fetch_one(pool)
        .await
}
