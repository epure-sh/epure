use epure_core::PlanTier;
use epure_storage::{connect_pools, projects, rls, run_migrations};
use uuid::Uuid;

fn legacy_pro_org() -> Uuid {
    Uuid::parse_str("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa").unwrap()
}

fn legacy_pro_user() -> Uuid {
    Uuid::parse_str("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb").unwrap()
}

#[test]
fn legacy_builder_pro_parses_to_cloud_pro_unlimited_projects() {
    let tier = PlanTier::parse_tier("builder_pro").expect("parse");
    assert_eq!(tier, PlanTier::Pro);
    assert_eq!(tier.default_limits().max_projects, u32::MAX);
}

#[tokio::test]
async fn org_plan_and_project_count_sees_legacy_tier_under_rls() {
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
        VALUES ($1, 'Cloud Pro Org', 'pro')
        ON CONFLICT (id) DO UPDATE SET plan_tier = 'pro'
        "#,
    )
    .bind(legacy_pro_org())
    .execute(&migrate_pool)
    .await
    .expect("seed org");

    sqlx::query(
        r#"
        INSERT INTO users (id, email)
        VALUES ($1, 'legacy-pro@test.com')
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .bind(legacy_pro_user())
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
    .bind(legacy_pro_org())
    .bind(legacy_pro_user())
    .execute(&migrate_pool)
    .await
    .expect("seed membership");

    let (plan_tier, count) = rls::with_request_user(legacy_pro_user(), async {
        projects::org_plan_and_project_count(&pools.app, legacy_pro_org())
            .await
            .expect("quota query")
    })
    .await;

    assert_eq!(plan_tier, "pro");
    assert_eq!(count, 0);
    let max = PlanTier::parse_tier(&plan_tier)
        .expect("canonical tier")
        .default_limits()
        .max_projects;
    assert_eq!(max, u32::MAX);
}
