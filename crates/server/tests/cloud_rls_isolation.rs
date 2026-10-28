use epure_storage::{connect, connect_pools, issues, rls, run_migrations};
use sqlx::PgPool;
use uuid::Uuid;

fn agency_org() -> Uuid {
    Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap()
}

fn client_org_a() -> Uuid {
    Uuid::parse_str("22222222-2222-2222-2222-222222222222").unwrap()
}

fn client_org_b() -> Uuid {
    Uuid::parse_str("33333333-3333-3333-3333-333333333333").unwrap()
}

fn project_client_a() -> Uuid {
    Uuid::parse_str("44444444-4444-4444-4444-444444444444").unwrap()
}

fn project_client_b() -> Uuid {
    Uuid::parse_str("55555555-5555-5555-5555-555555555555").unwrap()
}

fn agency_user() -> Uuid {
    Uuid::parse_str("66666666-6666-6666-6666-666666666666").unwrap()
}

fn client_a_user() -> Uuid {
    Uuid::parse_str("77777777-7777-7777-7777-777777777777").unwrap()
}

#[tokio::test]
async fn agency_parent_can_access_sub_tenants_while_clients_are_strictly_isolated() {
    let database_url = match std::env::var("DATABASE_URL") {
        Ok(url) => url,
        Err(_) => return, // Skip test if no live PostgreSQL is provided in env
    };

    let migrate_pool = connect(&database_url).await.expect("connect migrate pool");
    run_migrations(&migrate_pool).await.expect("run migrations");
    let pools = connect_pools(&database_url).await.expect("connect pools");

    seed_agency_hierarchy(&migrate_pool)
        .await
        .expect("seed agency hierarchy");

    // Client A user in Client A org sees only Client A issues
    let client_a_count = rls::with_request_user(client_a_user(), async {
        let mut tx = rls::TenantTx::begin_org(&pools.app, client_org_a()).await?;
        let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*)::bigint FROM issues")
            .fetch_one(tx.conn())
            .await?;
        tx.commit().await?;
        Ok::<_, sqlx::Error>(count)
    })
    .await
    .expect("count client A issues");
    assert_eq!(client_a_count, 1);

    // Client A user cannot see Client B issues
    let cross_client_count = rls::with_request_user(client_a_user(), async {
        let mut tx = rls::TenantTx::begin_org(&pools.app, client_org_a()).await?;
        let count =
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*)::bigint FROM issues WHERE org_id = $1")
                .bind(client_org_b())
                .fetch_one(tx.conn())
                .await?;
        tx.commit().await?;
        Ok::<_, sqlx::Error>(count)
    })
    .await
    .expect("query cross client");
    assert_eq!(cross_client_count, 0);

    // Agency Parent user can manage and view child client organizations under agency hierarchy
    let agency_visible_orgs = rls::with_request_user(agency_user(), async {
        let mut tx = rls::TenantTx::begin_org(&pools.app, agency_org()).await?;
        let count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*)::bigint FROM organizations WHERE parent_agency_id = $1",
        )
        .bind(agency_org())
        .fetch_one(tx.conn())
        .await?;
        tx.commit().await?;
        Ok::<_, sqlx::Error>(count)
    })
    .await
    .expect("query agency client orgs");
    assert_eq!(agency_visible_orgs, 2);
}

async fn seed_agency_hierarchy(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM issues WHERE org_id IN ($1, $2, $3)")
        .bind(agency_org())
        .bind(client_org_a())
        .bind(client_org_b())
        .execute(pool)
        .await?;

    sqlx::query(
        r#"
        INSERT INTO organizations (id, name, plan_tier)
        VALUES ($1, 'Acme Agency', 'scale')
        ON CONFLICT (id) DO UPDATE SET plan_tier = 'scale'
        "#,
    )
    .bind(agency_org())
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO organizations (id, name, plan_tier, parent_agency_id)
        VALUES ($1, 'Client Alpha', 'scale', $3),
               ($2, 'Client Beta', 'scale', $3)
        ON CONFLICT (id) DO UPDATE SET parent_agency_id = EXCLUDED.parent_agency_id
        "#,
    )
    .bind(client_org_a())
    .bind(client_org_b())
    .bind(agency_org())
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO users (id, email)
        VALUES ($1, 'agency@test.com'), ($2, 'client_a@test.com')
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .bind(agency_user())
    .bind(client_a_user())
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO org_members (org_id, user_id, role)
        VALUES ($1, $2, 'owner'), ($3, $4, 'client_viewer')
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(agency_org())
    .bind(agency_user())
    .bind(client_org_a())
    .bind(client_a_user())
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO projects (id, org_id, name, slug)
        VALUES ($1, $3, 'Alpha App', 'alpha-app'),
               ($2, $4, 'Beta App', 'beta-app')
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .bind(project_client_a())
    .bind(project_client_b())
    .bind(client_org_a())
    .bind(client_org_b())
    .execute(pool)
    .await?;

    let now = chrono::Utc::now();
    issues::upsert_issue(
        pool,
        issues::UpsertIssueParams {
            org_id: client_org_a(),
            project_id: project_client_a(),
            fingerprint: "fp-client-a".to_string(),
            title: Some("Client A issue".to_string()),
            level: Some("error".to_string()),
            environment: Some("production".to_string()),
            release: None,
            occurred_at: now,
            increment_by: 1,
            grouping: None,
        },
    )
    .await?;

    issues::upsert_issue(
        pool,
        issues::UpsertIssueParams {
            org_id: client_org_b(),
            project_id: project_client_b(),
            fingerprint: "fp-client-b".to_string(),
            title: Some("Client B issue".to_string()),
            level: Some("error".to_string()),
            environment: Some("production".to_string()),
            release: None,
            occurred_at: now,
            increment_by: 1,
            grouping: None,
        },
    )
    .await?;

    Ok(())
}
