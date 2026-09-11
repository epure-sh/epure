use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::dsn_keys;

/// Well-known project ids from `scripts/seed-dev.sql` / `seed-heavy.sql`.
const DEV_SEED_PROJECTS: [Uuid; 3] = [
    Uuid::from_u128(0x550e8400_e29b_41d4_a716_446655440000),
    Uuid::from_u128(0x660e8400_e29b_41d4_a716_446655440001),
    Uuid::from_u128(0x770e8400_e29b_41d4_a716_446655440002),
];

pub fn is_dev_seed_project(project_id: Uuid) -> bool {
    DEV_SEED_PROJECTS.contains(&project_id)
}

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

async fn project_has_any_issue(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let exists = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1
            FROM issues
            WHERE project_id = $1
              AND merge_parent_id IS NULL
        )
        "#,
    )
    .bind(project_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(exists)
}

async fn fetch_setup_row(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: Uuid,
    org_id: Uuid,
    project_id: Uuid,
) -> Result<Option<SetupProgressRow>, sqlx::Error> {
    sqlx::query_as::<_, SetupProgressRow>(
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
    .fetch_optional(&mut **tx)
    .await
}

pub async fn get_setup_progress(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
    project_id: Uuid,
) -> Result<SetupProgressRow, sqlx::Error> {
    let row = fetch_setup_row_optional(pool, org_id, user_id, project_id).await?;
    reconcile_setup_progress(pool, org_id, user_id, project_id, row).await
}

async fn fetch_setup_row_optional(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
    project_id: Uuid,
) -> Result<SetupProgressRow, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = fetch_setup_row(&mut tx, user_id, org_id, project_id).await?;
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

async fn reconcile_setup_progress(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
    project_id: Uuid,
    row: SetupProgressRow,
) -> Result<SetupProgressRow, sqlx::Error> {
    let has_key = dsn_keys::first_active_public_key(pool, org_id, project_id)
        .await?
        .is_some();

    let mut dsn_copied_at = row.dsn_copied_at;
    if !has_key {
        dsn_copied_at = None;
    }

    let has_issue = project_has_any_issue(pool, org_id, project_id).await?;
    let seeded = is_dev_seed_project(project_id);
    let should_complete = seeded || has_issue || row.completed_at.is_some();

    let project_named = row.project_named || should_complete;
    let (first_issue_seen_at, completed_at) = if should_complete {
        let seen_at = row
            .first_issue_seen_at
            .or(row.completed_at)
            .unwrap_or_else(Utc::now);
        (Some(seen_at), Some(row.completed_at.unwrap_or(seen_at)))
    } else {
        (None, None)
    };

    if row.project_named == project_named
        && row.dsn_copied_at == dsn_copied_at
        && row.first_issue_seen_at == first_issue_seen_at
        && row.completed_at == completed_at
    {
        return Ok(SetupProgressRow {
            project_named,
            dsn_copied_at,
            first_issue_seen_at,
            completed_at,
            ..row
        });
    }

    let now = Utc::now();
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let updated = sqlx::query_as::<_, SetupProgressRow>(
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
            project_named = user_setup_progress.project_named OR EXCLUDED.project_named,
            dsn_copied_at = EXCLUDED.dsn_copied_at,
            first_issue_seen_at = EXCLUDED.first_issue_seen_at,
            completed_at = EXCLUDED.completed_at,
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
    Ok(updated)
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
    let first_issue_seen_at = existing.as_ref().and_then(|r| r.first_issue_seen_at);
    let completed_at = existing.as_ref().and_then(|r| r.completed_at);

    if patch.project_named == Some(true) {
        project_named = true;
    }

    if patch.dsn_copied == Some(true) && dsn_copied_at.is_none() {
        let has_key = dsn_keys::first_active_public_key(pool, org_id, project_id)
            .await?
            .is_some();
        if !has_key {
            return Err(sqlx::Error::RowNotFound);
        }
        dsn_copied_at = Some(now);
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
    reconcile_setup_progress(pool, org_id, user_id, project_id, row).await
}
