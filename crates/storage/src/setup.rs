use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct SetupProgressRow {
    pub user_id: Uuid,
    pub org_id: Uuid,
    pub project_id: Uuid,
    pub project_named: bool,
    pub dsn_copied_at: Option<DateTime<Utc>>,
    pub first_issue_seen_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Default)]
pub struct PatchSetupProgress {
    pub project_named: Option<bool>,
    pub dsn_copied: Option<bool>,
    pub first_issue_seen: Option<bool>,
}

pub async fn get_setup_progress(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
    project_id: Uuid,
) -> Result<SetupProgressRow, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;

    let row = sqlx::query_as::<_, SetupProgressRow>(
        r#"
        SELECT
            user_id,
            org_id,
            project_id,
            project_named,
            dsn_copied_at,
            first_issue_seen_at,
            completed_at,
            updated_at
        FROM user_setup_progress
        WHERE user_id = $1 AND org_id = $2 AND project_id = $3
        "#,
    )
    .bind(user_id)
    .bind(org_id)
    .bind(project_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(row.unwrap_or(SetupProgressRow {
        user_id,
        org_id,
        project_id,
        project_named: false,
        dsn_copied_at: None,
        first_issue_seen_at: None,
        completed_at: None,
        updated_at: Utc::now(),
    }))
}

pub async fn upsert_setup_progress(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
    project_id: Uuid,
    patch: PatchSetupProgress,
) -> Result<SetupProgressRow, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;

    let existing = sqlx::query_as::<_, SetupProgressRow>(
        r#"
        SELECT
            user_id,
            org_id,
            project_id,
            project_named,
            dsn_copied_at,
            first_issue_seen_at,
            completed_at,
            updated_at
        FROM user_setup_progress
        WHERE user_id = $1 AND org_id = $2 AND project_id = $3
        "#,
    )
    .bind(user_id)
    .bind(org_id)
    .bind(project_id)
    .fetch_optional(&mut *tx)
    .await?;

    let now = Utc::now();
    let mut project_named = existing.as_ref().map(|r| r.project_named).unwrap_or(false);
    let mut dsn_copied_at = existing.as_ref().and_then(|r| r.dsn_copied_at);
    let mut first_issue_seen_at = existing.as_ref().and_then(|r| r.first_issue_seen_at);
    let mut completed_at = existing.as_ref().and_then(|r| r.completed_at);

    if patch.project_named == Some(true) {
        project_named = true;
    }

    if patch.dsn_copied == Some(true) && dsn_copied_at.is_none() {
        dsn_copied_at = Some(now);
    }

    if patch.first_issue_seen == Some(true) && first_issue_seen_at.is_none() {
        first_issue_seen_at = Some(now);
        completed_at = Some(now);
    }

    let row = sqlx::query_as::<_, SetupProgressRow>(
        r#"
        INSERT INTO user_setup_progress (
            user_id,
            org_id,
            project_id,
            project_named,
            dsn_copied_at,
            first_issue_seen_at,
            completed_at,
            updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (user_id, org_id, project_id)
        DO UPDATE SET
            project_named = EXCLUDED.project_named,
            dsn_copied_at = COALESCE(user_setup_progress.dsn_copied_at, EXCLUDED.dsn_copied_at),
            first_issue_seen_at = COALESCE(
                user_setup_progress.first_issue_seen_at,
                EXCLUDED.first_issue_seen_at
            ),
            completed_at = COALESCE(user_setup_progress.completed_at, EXCLUDED.completed_at),
            updated_at = EXCLUDED.updated_at
        RETURNING
            user_id,
            org_id,
            project_id,
            project_named,
            dsn_copied_at,
            first_issue_seen_at,
            completed_at,
            updated_at
        "#,
    )
    .bind(user_id)
    .bind(org_id)
    .bind(project_id)
    .bind(project_named)
    .bind(dsn_copied_at)
    .bind(first_issue_seen_at)
    .bind(completed_at)
    .bind(now)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(row)
}
