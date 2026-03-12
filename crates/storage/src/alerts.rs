use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow, serde::Serialize)]
pub struct AlertRow {
    pub id: Uuid,
    pub org_id: Uuid,
    pub project_id: Uuid,
    pub issue_id: Option<Uuid>,
    pub kind: String,
    pub fired_at: DateTime<Utc>,
    pub payload_json: Value,
    pub read_at: Option<DateTime<Utc>>,
    pub ignored: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AlertListFilter {
    All,
    Unread,
    Ignored,
}

impl AlertListFilter {
    pub fn parse(raw: Option<&str>) -> Self {
        match raw.unwrap_or("all") {
            "unread" => Self::Unread,
            "ignored" => Self::Ignored,
            _ => Self::All,
        }
    }
}

pub struct InsertAlertParams {
    pub org_id: Uuid,
    pub project_id: Uuid,
    pub issue_id: Option<Uuid>,
    pub kind: String,
    pub payload_json: Value,
}

pub async fn is_suppressed(
    pool: &PgPool,
    org_id: Uuid,
    project_id: Uuid,
    kind: &str,
    issue_id: Option<Uuid>,
) -> Result<bool, sqlx::Error> {
    let mut tx = crate::rls::begin_ingest_transaction(pool, org_id).await?;
    let exists: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1
            FROM alert_suppressions
            WHERE project_id = $1
              AND kind = $2
              AND issue_id IS NOT DISTINCT FROM $3
        )
        "#,
    )
    .bind(project_id)
    .bind(kind)
    .bind(issue_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(exists)
}

pub async fn insert_alert(pool: &PgPool, params: InsertAlertParams) -> Result<Uuid, sqlx::Error> {
    let mut tx = crate::rls::begin_ingest_transaction(pool, params.org_id).await?;
    let id = sqlx::query_scalar(
        r#"
        INSERT INTO alerts (org_id, project_id, issue_id, kind, payload_json)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        "#,
    )
    .bind(params.org_id)
    .bind(params.project_id)
    .bind(params.issue_id)
    .bind(&params.kind)
    .bind(&params.payload_json)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(id)
}

/// Insert an alert unless this project/kind/issue was ignored.
pub async fn insert_alert_unless_suppressed(
    pool: &PgPool,
    params: InsertAlertParams,
) -> Result<Option<Uuid>, sqlx::Error> {
    if is_suppressed(
        pool,
        params.org_id,
        params.project_id,
        &params.kind,
        params.issue_id,
    )
    .await?
    {
        return Ok(None);
    }
    Ok(Some(insert_alert(pool, params).await?))
}

pub async fn list_alerts(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
    limit: i64,
    project_id: Option<Uuid>,
    environment: Option<&str>,
    filter: AlertListFilter,
) -> Result<Vec<AlertRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let filter_unread = matches!(filter, AlertListFilter::Unread);
    let filter_ignored = matches!(filter, AlertListFilter::Ignored);
    let rows = sqlx::query_as::<_, AlertRow>(
        r#"
        SELECT
            a.id,
            a.org_id,
            a.project_id,
            a.issue_id,
            a.kind,
            a.fired_at,
            a.payload_json,
            s.read_at,
            COALESCE(s.ignored, false) AS ignored
        FROM alerts a
        LEFT JOIN issues i ON i.id = a.issue_id
        LEFT JOIN alert_user_states s
            ON s.alert_id = a.id AND s.user_id = $4
        WHERE ($2::uuid IS NULL OR a.project_id = $2)
          AND (
            $3::text IS NULL
            OR i.environment = $3
            OR (a.issue_id IS NULL AND $3 IS NULL)
          )
          AND (
            ($5 AND s.read_at IS NULL AND COALESCE(s.ignored, false) = false)
            OR ($6 AND COALESCE(s.ignored, false) = true)
            OR (NOT $5 AND NOT $6)
          )
        ORDER BY a.fired_at DESC
        LIMIT $1
        "#,
    )
    .bind(limit)
    .bind(project_id)
    .bind(environment)
    .bind(user_id)
    .bind(filter_unread)
    .bind(filter_ignored)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

pub struct PatchAlertParams {
    pub read: Option<bool>,
    pub ignored: Option<bool>,
}

pub async fn patch_alert(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
    alert_id: Uuid,
    params: PatchAlertParams,
) -> Result<Option<AlertRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;

    let alert = sqlx::query_as::<_, (Uuid, Uuid, Option<Uuid>, String)>(
        r#"
        SELECT id, project_id, issue_id, kind
        FROM alerts
        WHERE id = $1
        "#,
    )
    .bind(alert_id)
    .fetch_optional(&mut *tx)
    .await?;

    let Some((_, project_id, issue_id, kind)) = alert else {
        tx.commit().await?;
        return Ok(None);
    };

    sqlx::query(
        r#"
        INSERT INTO alert_user_states (user_id, alert_id, read_at, ignored)
        VALUES ($1, $2, NULL, false)
        ON CONFLICT (user_id, alert_id) DO NOTHING
        "#,
    )
    .bind(user_id)
    .bind(alert_id)
    .execute(&mut *tx)
    .await?;

    if let Some(read) = params.read {
        if read {
            sqlx::query(
                r#"
                UPDATE alert_user_states
                SET read_at = now()
                WHERE user_id = $1 AND alert_id = $2
                "#,
            )
            .bind(user_id)
            .bind(alert_id)
            .execute(&mut *tx)
            .await?;
        } else {
            sqlx::query(
                r#"
                UPDATE alert_user_states
                SET read_at = NULL
                WHERE user_id = $1 AND alert_id = $2
                "#,
            )
            .bind(user_id)
            .bind(alert_id)
            .execute(&mut *tx)
            .await?;
        }
    }

    if let Some(ignored) = params.ignored {
        sqlx::query(
            r#"
            UPDATE alert_user_states
            SET ignored = $3, read_at = CASE WHEN $3 THEN COALESCE(read_at, now()) ELSE read_at END
            WHERE user_id = $1 AND alert_id = $2
            "#,
        )
        .bind(user_id)
        .bind(alert_id)
        .bind(ignored)
        .execute(&mut *tx)
        .await?;

        if ignored {
            sqlx::query(
                r#"
                INSERT INTO alert_suppressions (project_id, kind, issue_id)
                VALUES ($1, $2, $3)
                ON CONFLICT ON CONSTRAINT alert_suppressions_unique DO NOTHING
                "#,
            )
            .bind(project_id)
            .bind(&kind)
            .bind(issue_id)
            .execute(&mut *tx)
            .await?;
        } else {
            sqlx::query(
                r#"
                DELETE FROM alert_suppressions
                WHERE project_id = $1
                  AND kind = $2
                  AND issue_id IS NOT DISTINCT FROM $3
                "#,
            )
            .bind(project_id)
            .bind(&kind)
            .bind(issue_id)
            .execute(&mut *tx)
            .await?;
        }
    }

    let row = sqlx::query_as::<_, AlertRow>(
        r#"
        SELECT
            a.id,
            a.org_id,
            a.project_id,
            a.issue_id,
            a.kind,
            a.fired_at,
            a.payload_json,
            s.read_at,
            COALESCE(s.ignored, false) AS ignored
        FROM alerts a
        LEFT JOIN alert_user_states s
            ON s.alert_id = a.id AND s.user_id = $2
        WHERE a.id = $1
        "#,
    )
    .bind(alert_id)
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(row)
}
