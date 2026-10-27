use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, serde::Serialize, sqlx::FromRow)]
pub struct ExportedEvent {
    pub id: Uuid,
    pub occurred_at: chrono::DateTime<chrono::Utc>,
    pub environment: Option<String>,
    pub release: Option<String>,
    pub user_id: Option<String>,
    pub user_email: Option<String>,
    pub payload_json: Value,
}

#[derive(Debug, Clone, Copy, serde::Serialize)]
pub struct ErasureOutcome {
    pub events_deleted: i64,
    pub feedback_deleted: i64,
}

#[derive(Debug, Clone, Copy, serde::Serialize)]
pub struct StripOutcome {
    pub events_updated: i64,
    pub feedback_cleared: i64,
}

fn match_sql() -> &'static str {
    r#"
        (
            user_id = ANY($2)
            OR lower(user_email) = ANY($2)
            OR payload_json #>> '{user,id}' = ANY($2)
            OR lower(payload_json #>> '{user,email}') = ANY($2)
        )
    "#
}

pub async fn erase_subject(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    keys: &[String],
) -> Result<ErasureOutcome, sqlx::Error> {
    if keys.is_empty() {
        return Ok(ErasureOutcome {
            events_deleted: 0,
            feedback_deleted: 0,
        });
    }

    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let project_exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1 AND org_id = $2)")
            .bind(project_id)
            .bind(org_id)
            .fetch_one(&mut *tx)
            .await?;
    if !project_exists {
        tx.commit().await?;
        return Ok(ErasureOutcome {
            events_deleted: 0,
            feedback_deleted: 0,
        });
    }

    let doomed: Vec<(Uuid, Uuid)> = sqlx::query_as(&format!(
        "SELECT id, issue_id FROM events WHERE project_id = $1 AND {}",
        match_sql()
    ))
    .bind(project_id)
    .bind(keys)
    .fetch_all(&mut *tx)
    .await?;

    if doomed.is_empty() {
        tx.commit().await?;
        return Ok(ErasureOutcome {
            events_deleted: 0,
            feedback_deleted: 0,
        });
    }

    let event_ids: Vec<Uuid> = doomed.iter().map(|(id, _)| *id).collect();
    let issue_ids: Vec<Uuid> = doomed.iter().map(|(_, issue_id)| *issue_id).collect();

    let feedback_deleted = sqlx::query("DELETE FROM user_feedback WHERE event_id = ANY($1)")
        .bind(&event_ids)
        .execute(&mut *tx)
        .await?
        .rows_affected() as i64;

    let events_deleted = sqlx::query("DELETE FROM events WHERE id = ANY($1)")
        .bind(&event_ids)
        .execute(&mut *tx)
        .await?
        .rows_affected() as i64;

    sqlx::query(
        r#"
        DELETE FROM issue_unique_users
        WHERE issue_id = ANY($1)
          AND user_key = ANY($2)
        "#,
    )
    .bind(&issue_ids)
    .bind(keys)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        UPDATE issues i
        SET unique_user_count = (
            SELECT COUNT(*)::int FROM issue_unique_users u WHERE u.issue_id = i.id
        )
        WHERE i.id = ANY($1)
        "#,
    )
    .bind(&issue_ids)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(ErasureOutcome {
        events_deleted,
        feedback_deleted,
    })
}

pub async fn export_subject(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    keys: &[String],
) -> Result<(i64, Vec<ExportedEvent>), sqlx::Error> {
    if keys.is_empty() {
        return Ok((0, Vec::new()));
    }

    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let total: i64 = sqlx::query_scalar(&format!(
        "SELECT COUNT(*)::bigint FROM events WHERE project_id = $1 AND {}",
        match_sql()
    ))
    .bind(project_id)
    .bind(keys)
    .fetch_one(&mut *tx)
    .await?;

    let rows = sqlx::query_as::<_, ExportedEvent>(&format!(
        r#"
        SELECT id, occurred_at, environment, release, user_id, user_email, payload_json
        FROM events
        WHERE project_id = $1 AND {}
        ORDER BY occurred_at DESC
        LIMIT 2000
        "#,
        match_sql()
    ))
    .bind(project_id)
    .bind(keys)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok((total, rows))
}

pub async fn strip_stored_identifiers(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
) -> Result<Option<StripOutcome>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let project_exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1)")
            .bind(project_id)
            .fetch_one(&mut *tx)
            .await?;
    if !project_exists {
        tx.commit().await?;
        return Ok(None);
    }

    let events_updated = sqlx::query(
        r#"
        UPDATE events
        SET
            user_email = NULL,
            user_id = CASE WHEN position('@' in coalesce(user_id, '')) > 0 THEN NULL ELSE user_id END,
            payload_json = payload_json
                #- '{user,email}'
                #- '{user,username}'
                #- '{user,name}'
                #- '{user,ip_address}'
                #- '{user,geo,city}'
                #- '{user,geo,region}'
                #- '{user,geo,latitude}'
                #- '{user,geo,longitude}'
        WHERE project_id = $1
          AND (
            user_email IS NOT NULL
            OR position('@' in coalesce(user_id, '')) > 0
            OR payload_json #> '{user,email}' IS NOT NULL
            OR payload_json #> '{user,username}' IS NOT NULL
            OR payload_json #> '{user,name}' IS NOT NULL
            OR payload_json #> '{user,ip_address}' IS NOT NULL
            OR payload_json #> '{user,geo,city}' IS NOT NULL
          )
        "#,
    )
    .bind(project_id)
    .execute(&mut *tx)
    .await?
    .rows_affected() as i64;

    sqlx::query(
        r#"
        UPDATE events
        SET payload_json = payload_json #- '{user,id}'
        WHERE project_id = $1
          AND position('@' in coalesce(payload_json #>> '{user,id}', '')) > 0
        "#,
    )
    .bind(project_id)
    .execute(&mut *tx)
    .await?;

    let feedback_cleared = sqlx::query(
        r#"
        UPDATE user_feedback
        SET email = NULL, name = NULL
        WHERE project_id = $1
          AND (email IS NOT NULL OR name IS NOT NULL)
        "#,
    )
    .bind(project_id)
    .execute(&mut *tx)
    .await?
    .rows_affected() as i64;

    sqlx::query(
        r#"
        DELETE FROM issue_unique_users u
        USING issues i
        WHERE u.issue_id = i.id
          AND i.project_id = $1
          AND position('@' in u.user_key) > 0
        "#,
    )
    .bind(project_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        UPDATE issues i
        SET unique_user_count = (
            SELECT COUNT(*)::int FROM issue_unique_users u WHERE u.issue_id = i.id
        )
        WHERE i.project_id = $1
        "#,
    )
    .bind(project_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Some(StripOutcome {
        events_updated,
        feedback_cleared,
    }))
}
