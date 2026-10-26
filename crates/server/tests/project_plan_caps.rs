use epure_storage::{connect_pools, projects, rls, run_migrations};
use uuid::Uuid;

fn canary_org() -> Uuid {
    Uuid::parse_str("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa").unwrap()
}

fn canary_user() -> Uuid {
    Uuid::parse_str("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb").unwrap()
}

#[tokio::test]
async fn org_plan_and_project_count_respects_rls_for_capped_tier() {
    let database_url = match std::env::var("DATABASE_URL") {
        Ok(url) => url,
        Err(_) => return,
    };

    let migrate_pool = epure_storage::connect(&database_url)
        .await
        .expect("connect migrate pool");
    run_migrations(&migrate_pool).await.expect("run migrations");
    let pools = connect_pools(&database_url).await.expect("connect pools");

    sqlx::query(
        r#"
        INSERT INTO organizations (id, name, plan_tier)
        VALUES ($1, 'Canary Org', 'canary_sandbox')
        ON CONFLICT (id) DO UPDATE SET plan_tier = 'canary_sandbox'
        "#,
    )
    .bind(canary_org())
    .execute(&migrate_pool)
    .await
    .expect("seed org");

    sqlx::query(
        r#"
        INSERT INTO users (id, email)
        VALUES ($1, 'canary-cap@test.com')
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .bind(canary_user())
    .execute(&migrate_pool)
    .await
    .expect("seed user");

    sqlx::query(
        r#"
        INSERT INTO org_members (org_id, user_id, role)
        VALUES ($1, $2, 'owner')
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(canary_org())
    .bind(canary_user())
    .execute(&migrate_pool)
    .await
    .expect("seed membership");

    sqlx::query("DELETE FROM projects WHERE org_id = $1")
        .bind(canary_org())
        .execute(&migrate_pool)
        .await
        .expect("clear projects");

    sqlx::query(
        r#"
        INSERT INTO projects (org_id, name, slug)
        VALUES ($1, 'Only Project', 'only-project')
        "#,
    )
    .bind(canary_org())
    .execute(&migrate_pool)
    .await
    .expect("seed project");

    let (plan_tier, count) = rls::with_request_user(canary_user(), async {
        projects::org_plan_and_project_count(&pools.app, canary_org())
            .await
            .expect("quota query")
    })
    .await;

    assert_eq!(plan_tier, "canary_sandbox");
    assert_eq!(count, 1);
}
