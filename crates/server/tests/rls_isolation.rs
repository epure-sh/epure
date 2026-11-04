use epure_storage::{connect, connect_pools, issues, rls, run_migrations};
use sqlx::PgPool;
use uuid::Uuid;

fn org_a() -> Uuid {
    Uuid::parse_str("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa").unwrap()
}

fn org_b() -> Uuid {
    Uuid::parse_str("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb").unwrap()
}

fn project_a() -> Uuid {
    Uuid::parse_str("cccccccc-cccc-cccc-cccc-cccccccccccc").unwrap()
}

fn project_b() -> Uuid {
    Uuid::parse_str("dddddddd-dddd-dddd-dddd-dddddddddddd").unwrap()
}

fn user_a() -> Uuid {
    Uuid::parse_str("aa11aa11-aa11-aa11-aa11-aa11aa11aa11").unwrap()
}

fn user_b() -> Uuid {
    Uuid::parse_str("bb22bb22-bb22-bb22-bb22-bb22bb22bb22").unwrap()
}

#[tokio::test]
async fn org_a_cannot_read_org_b_rows() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url).await.expect("connect migrate pool");
    run_migrations(&migrate_pool).await.expect("run migrations");

    let pools = connect_pools(&database_url).await.expect("connect pools");
    seed_two_orgs(&migrate_pool).await.expect("seed orgs");

    let org_a_issues = rls::with_request_user(user_a(), count_issues(&pools.app, org_a()))
        .await
        .expect("count org a");
    let org_b_issues = rls::with_request_user(user_b(), count_issues(&pools.app, org_b()))
        .await
        .expect("count org b");
    assert_eq!(org_a_issues, 1);
    assert_eq!(org_b_issues, 1);

    let cross_org = rls::with_request_user(
        user_b(),
        count_issues_where_org(&pools.app, org_b(), org_a()),
    )
    .await
    .expect("cross-org query");
    assert_eq!(cross_org, 0);

    let cross_events = rls::with_request_user(
        user_b(),
        count_events_where_org(&pools.app, org_b(), org_a()),
    )
    .await
    .expect("cross-org events");
    assert_eq!(cross_events, 0);
}

#[tokio::test]
async fn alert_rule_cannot_bind_other_org_project() {
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url).await.expect("connect migrate pool");
    run_migrations(&migrate_pool).await.expect("run migrations");
    let pools = connect_pools(&database_url).await.expect("connect pools");
    seed_two_orgs(&migrate_pool).await.expect("seed orgs");

    let result = rls::with_request_user(user_a(), async {
        let mut tx = rls::begin_org_transaction(&pools.app, org_a()).await?;
        sqlx::query(
            r#"
            INSERT INTO alert_rules (org_id, project_id, name, kind)
            VALUES ($1, $2, 'cross', 'issue_created')
            "#,
        )
        .bind(org_a())
        .bind(project_b())
        .execute(&mut *tx)
        .await
    })
    .await;

    assert!(result.is_err(), "cross-org project bind must fail");
}

async fn count_issues(pool: &PgPool, org_id: Uuid) -> Result<i64, sqlx::Error> {
    let mut tx = rls::begin_org_transaction(pool, org_id).await?;
    let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*)::bigint FROM issues")
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(count)
}

async fn count_issues_where_org(
    pool: &PgPool,
    session_org: Uuid,
    target_org: Uuid,
) -> Result<i64, sqlx::Error> {
    let mut tx = rls::begin_org_transaction(pool, session_org).await?;
    let count = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)::bigint
        FROM issues
        WHERE org_id = $1
        "#,
    )
    .bind(target_org)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(count)
}

async fn count_events_where_org(
    pool: &PgPool,
    session_org: Uuid,
    target_org: Uuid,
) -> Result<i64, sqlx::Error> {
    let mut tx = rls::begin_org_transaction(pool, session_org).await?;
    let count = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)::bigint
        FROM events
        WHERE org_id = $1
        "#,
    )
    .bind(target_org)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(count)
}

async fn seed_two_orgs(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        DELETE FROM issues
        WHERE org_id IN ($1, $2)
        "#,
    )
    .bind(org_a())
    .bind(org_b())
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO organizations (id, name)
        VALUES ($1, 'Org A'), ($2, 'Org B')
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .bind(org_a())
    .bind(org_b())
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO projects (id, org_id, name, slug, retention_days)
        VALUES ($1, $3, 'Project A', 'project-a', 30),
               ($2, $4, 'Project B', 'project-b', 30)
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .bind(project_a())
    .bind(project_b())
    .bind(org_a())
    .bind(org_b())
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO users (id, email)
        VALUES ($1, 'a@rls.test'), ($2, 'b@rls.test')
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .bind(user_a())
    .bind(user_b())
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO org_members (org_id, user_id, role)
        VALUES ($1, $3, 'owner'), ($2, $4, 'owner')
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(org_a())
    .bind(org_b())
    .bind(user_a())
    .bind(user_b())
    .execute(pool)
    .await?;

    let now = chrono::Utc::now();
    issues::upsert_issue(
        pool,
        issues::UpsertIssueParams {
            org_id: org_a(),
            project_id: project_a(),
            fingerprint: "fp-org-a".to_string(),
            title: Some("Org A issue".to_string()),
            level: Some("error".to_string()),
            environment: Some("production".to_string()),
            release: None,
            occurred_at: now,
            increment_by: 3,
            grouping: None,
            rollup: epure_storage::issues::IssueRollup::default(),
        },
    )
    .await?;

    issues::upsert_issue(
        pool,
        issues::UpsertIssueParams {
            org_id: org_b(),
            project_id: project_b(),
            fingerprint: "fp-org-b".to_string(),
            title: Some("Org B issue".to_string()),
            level: Some("error".to_string()),
            environment: Some("production".to_string()),
            release: None,
            occurred_at: now,
            increment_by: 1,
            grouping: None,
            rollup: epure_storage::issues::IssueRollup::default(),
        },
    )
    .await?;

    Ok(())
}

/// Verifies that `flush_all_telemetry_deltas` correctly groups a mixed-org batch
/// by org_id, switches transaction-local RLS context for each group, and never writes
/// org A's counts into org B's rows (or vice-versa).
#[tokio::test]
async fn multi_org_batch_isolation_in_flush_all_telemetry_deltas() {
    use chrono::Utc;
    use epure_storage::issues::{IssueRollup, UpsertIssueParams};
    use epure_storage::persist::{
        flush_all_telemetry_deltas, resolve_or_create_issue, IssueCountDelta, TelemetryDeltas,
    };

    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
    let migrate_pool = connect(&database_url).await.expect("connect migrate pool");
    run_migrations(&migrate_pool).await.expect("run migrations");

    seed_two_orgs(&migrate_pool).await.expect("seed orgs");

    let pools = connect_pools(&database_url)
        .await
        .expect("restricted pools");
    let ingest_pool = &pools.ingest;
    let now = Utc::now();

    // Resolve (or create) one issue per org via the ingest path
    let params_a = UpsertIssueParams {
        org_id: org_a(),
        project_id: project_a(),
        fingerprint: "batch-iso-fp-a".to_string(),
        title: Some("Batch Iso A".to_string()),
        level: Some("error".to_string()),
        environment: Some("production".to_string()),
        release: None,
        occurred_at: now,
        increment_by: 0,
        grouping: None,
        rollup: IssueRollup::default(),
    };
    let (issue_a, _) = resolve_or_create_issue(
        ingest_pool,
        org_a(),
        project_a(),
        "batch-iso-fp-a",
        &params_a,
    )
    .await
    .expect("resolve issue a");

    let params_b = UpsertIssueParams {
        org_id: org_b(),
        project_id: project_b(),
        fingerprint: "batch-iso-fp-b".to_string(),
        title: Some("Batch Iso B".to_string()),
        level: Some("error".to_string()),
        environment: Some("production".to_string()),
        release: None,
        occurred_at: now,
        increment_by: 0,
        grouping: None,
        rollup: IssueRollup::default(),
    };
    let (issue_b, _) = resolve_or_create_issue(
        ingest_pool,
        org_b(),
        project_b(),
        "batch-iso-fp-b",
        &params_b,
    )
    .await
    .expect("resolve issue b");

    sqlx::query("UPDATE issues SET event_count=0 WHERE id = ANY($1)")
        .bind(vec![issue_a, issue_b])
        .execute(&migrate_pool)
        .await
        .unwrap();
    // Build a mixed-org TelemetryDeltas batch: 3 for org A, 5 for org B
    let deltas = TelemetryDeltas {
        issue_counts: vec![
            IssueCountDelta {
                org_id: org_a(),
                project_id: project_a(),
                issue_id: issue_a,
                fingerprint: "batch-iso-fp-a".to_string(),
                window_start: now,
                count_delta: 3,
            },
            IssueCountDelta {
                org_id: org_b(),
                project_id: project_b(),
                issue_id: issue_b,
                fingerprint: "batch-iso-fp-b".to_string(),
                window_start: now,
                count_delta: 5,
            },
        ],
        tag_facets: vec![],
        sessions: vec![],
    };

    flush_all_telemetry_deltas(ingest_pool, &deltas)
        .await
        .expect("flush deltas");

    // Org A's issue should have event_count = 0 (initial insert) + 3 (delta) = 3
    let count_a: i64 = sqlx::query_scalar("SELECT event_count FROM issues WHERE id = $1")
        .bind(issue_a)
        .fetch_one(&migrate_pool)
        .await
        .expect("query issue a");
    assert_eq!(count_a, 3, "org A event_count should be exactly 3");

    // Org B's issue should have event_count = 0 (initial insert) + 5 (delta) = 5
    let count_b: i64 = sqlx::query_scalar("SELECT event_count FROM issues WHERE id = $1")
        .bind(issue_b)
        .fetch_one(&migrate_pool)
        .await
        .expect("query issue b");
    assert_eq!(count_b, 5, "org B event_count should be exactly 5");

    // RLS check: with org A ingest context, org B's issue must be invisible
    let mut tx_a = rls::begin_ingest_transaction(ingest_pool, org_a())
        .await
        .expect("begin ingest tx for org a");
    let visible_from_a: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM issues WHERE id = $1")
        .bind(issue_b)
        .fetch_one(&mut *tx_a)
        .await
        .expect("rls check");
    tx_a.rollback().await.ok();
    assert_eq!(
        visible_from_a, 0,
        "org B's issue must not be visible under org A ingest RLS context"
    );
}
