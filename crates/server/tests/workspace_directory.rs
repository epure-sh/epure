mod support;

use reqwest::{Client, StatusCode};
use serde_json::{json, Value};
use uuid::Uuid;

#[tokio::test]
async fn scale_workspace_creation_and_guarded_deletion() {
    std::env::set_var("EPURE_CLOUD", "1");
    let (base, db, server) = support::spawn_test_server().await;
    let client = Client::builder().cookie_store(true).build().unwrap();
    let auth = format!("{base}/api/v1/auth");
    assert_eq!(
        client
            .post(format!("{auth}/login"))
            .json(&json!({"email":"dev@epure.local","password":"devpassword"}))
            .send()
            .await
            .unwrap()
            .status(),
        StatusCode::NO_CONTENT,
    );
    let directory = format!("{auth}/organizations");
    let org: Uuid = "11111111-1111-1111-1111-111111111111".parse().unwrap();
    let switch = |target: Uuid| {
        client
            .post(format!("{auth}/switch-org"))
            .json(&json!({"org_id":target}))
    };
    let create = || {
        client
            .post(&directory)
            .json(&json!({"name":"Customer staging","billing_workspace_id":org}))
    };
    assert_eq!(
        create().send().await.unwrap().status(),
        StatusCode::FORBIDDEN
    );

    sqlx::query("UPDATE organizations SET plan_tier='scale',subscription_status='active',subscription_id=$2 WHERE id=$1")
        .bind(org).bind(Uuid::new_v4().to_string()).execute(&db).await.unwrap();
    let created = create().send().await.unwrap();
    assert_eq!(created.status(), StatusCode::CREATED);
    let created: Value = created.json().await.unwrap();
    let id: Uuid = created["id"].as_str().unwrap().parse().unwrap();
    let state: (String, String, bool, Uuid) = sqlx::query_as(
        "SELECT plan_tier,subscription_status,trial_ends_at IS NULL,billing_workspace_id FROM organizations WHERE id=$1",
    )
    .bind(id)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(state, ("oss".into(), "none".into(), true, org));

    let limits = epure_storage::billing::org_entitlement(&db, id)
        .await
        .unwrap();
    assert_eq!(limits.monthly_events(), Some(1_500_000));
    let child_project: Uuid =
        sqlx::query_scalar("INSERT INTO projects(org_id,name) VALUES($1,'Child') RETURNING id")
            .bind(id)
            .fetch_one(&db)
            .await
            .unwrap();
    assert_eq!(switch(id).send().await.unwrap().status(), StatusCode::OK);
    let visible_projects: Value = client
        .get(format!("{base}/api/v1/projects"))
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap()
        .json()
        .await
        .unwrap();
    let projects = visible_projects["projects"].as_array().unwrap();
    assert_eq!(projects.len(), 1);
    assert_eq!(projects[0]["id"], child_project.to_string());
    assert_eq!(
        client
            .delete(format!("{auth}/account"))
            .json(&json!({"confirm_email":"dev@epure.local","password":"devpassword"}))
            .send()
            .await
            .unwrap()
            .status(),
        StatusCode::CONFLICT,
    );
    assert_eq!(switch(org).send().await.unwrap().status(), StatusCode::OK);
    for (workspace, project, count) in [(org, support::project_id(), 2), (id, child_project, 3)] {
        let issue: Uuid = sqlx::query_scalar("INSERT INTO issues(org_id,project_id,fingerprint) VALUES($1,$2,'shared-quota-test') RETURNING id")
            .bind(workspace).bind(project).fetch_one(&db).await.unwrap();
        sqlx::query("INSERT INTO events(id,org_id,project_id,issue_id,occurred_at,payload_json) SELECT gen_random_uuid(),$1,$2,$3,now(),'{}' FROM generate_series(1,$4)")
            .bind(workspace).bind(project).bind(issue).bind(count).execute(&db).await.unwrap();
    }
    let root_total = epure_storage::events::org_monthly_event_count(&db, org)
        .await
        .unwrap();
    assert!(root_total >= 5);
    assert_eq!(
        epure_storage::events::org_monthly_event_count(&db, id)
            .await
            .unwrap(),
        root_total
    );
    sqlx::query("UPDATE organizations SET plan_tier='pro' WHERE id=$1")
        .bind(org)
        .execute(&db)
        .await
        .unwrap();
    assert!(!epure_storage::billing::org_entitlement(&db, id)
        .await
        .unwrap()
        .can_ingest());
    sqlx::query("UPDATE organizations SET plan_tier='scale' WHERE id=$1")
        .bind(org)
        .execute(&db)
        .await
        .unwrap();
    sqlx::query("DELETE FROM projects WHERE id=$1")
        .bind(child_project)
        .execute(&db)
        .await
        .unwrap();
    sqlx::query("UPDATE organizations SET subscription_status='canceled' WHERE id=$1")
        .bind(org)
        .execute(&db)
        .await
        .unwrap();
    assert!(!epure_storage::billing::org_entitlement(&db, id)
        .await
        .unwrap()
        .can_ingest());
    sqlx::query("UPDATE organizations SET subscription_status='active' WHERE id=$1")
        .bind(org)
        .execute(&db)
        .await
        .unwrap();
    assert!(epure_storage::billing::org_entitlement(&db, id)
        .await
        .unwrap()
        .can_ingest());
    let target = format!("{directory}/{id}");
    let delete = |name: &str| client.delete(&target).json(&json!({"name":name}));
    assert_eq!(
        client
            .patch(&target)
            .json(&json!({"name":"Renamed"}))
            .send()
            .await
            .unwrap()
            .status(),
        StatusCode::NO_CONTENT
    );
    assert_eq!(
        delete("Customer staging").send().await.unwrap().status(),
        StatusCode::CONFLICT
    );
    assert_eq!(switch(id).send().await.unwrap().status(), StatusCode::OK);
    assert_eq!(
        delete("Renamed").send().await.unwrap().status(),
        StatusCode::CONFLICT
    );
    assert_eq!(switch(org).send().await.unwrap().status(), StatusCode::OK);
    let outsider = Uuid::new_v4();
    sqlx::query("INSERT INTO organizations(id,name) VALUES($1,'Other tenant')")
        .bind(outsider)
        .execute(&db)
        .await
        .unwrap();
    assert_eq!(
        client
            .patch(format!("{directory}/{outsider}"))
            .json(&json!({"name":"No access"}))
            .send()
            .await
            .unwrap()
            .status(),
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        delete("Renamed").send().await.unwrap().status(),
        StatusCode::NO_CONTENT
    );
    assert_eq!(
        switch(id).send().await.unwrap().status(),
        StatusCode::FORBIDDEN
    );
    server.abort();
}
