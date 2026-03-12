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
        },
    )
    .await?;

    Ok(())
}
