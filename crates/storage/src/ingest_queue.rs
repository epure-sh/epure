use crate::{rls, PgPool};
use chrono::{DateTime, Utc};
use epure_envelope::{hash_to_i64, MultiFingerprint};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow)]
pub struct QueuedEvent {
    pub org_id: Uuid,
    pub project_id: Uuid,
    pub event_id: Uuid,
    pub job: Option<Value>,
    pub lease_token: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}
#[derive(serde::Serialize, sqlx::FromRow)]
pub struct BacklogStats {
    pub pending: i64,
    pub bytes: i64,
    pub dead: i64,
    pub oldest_ms: i64,
}
pub async fn enqueue(
    pool: &PgPool,
    org: Uuid,
    project: Uuid,
    event: Uuid,
    job: Value,
) -> Result<String, sqlx::Error> {
    sqlx::query_scalar("SELECT ingest_enqueue($1,$2,$3,$4,$5,$6)")
        .bind(org)
        .bind(project)
        .bind(event)
        .bind(job)
        .bind(512_i64 * 1024 * 1024)
        .bind(64_i64 * 1024 * 1024)
        .fetch_one(pool)
        .await
}
pub async fn claim(pool: &PgPool) -> Result<Vec<QueuedEvent>, sqlx::Error> {
    sqlx::query_as(
        "SELECT org_id,project_id,event_id,job,lease_token,created_at FROM ingest_claim(64)",
    )
    .fetch_all(pool)
    .await
}
pub async fn finish(pool: &PgPool, row: &QueuedEvent) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar("SELECT ingest_finish($1,$2,$3)")
        .bind(row.project_id)
        .bind(row.event_id)
        .bind(row.lease_token)
        .fetch_one(pool)
        .await
}
pub async fn retry(pool: &PgPool, row: &QueuedEvent, error: &str) -> Result<(), sqlx::Error> {
    sqlx::query("SELECT ingest_retry($1,$2,$3,$4)")
        .bind(row.project_id)
        .bind(row.event_id)
        .bind(row.lease_token)
        .bind(error)
        .execute(pool)
        .await?;
    Ok(())
}
pub async fn stats(pool: &PgPool) -> Result<BacklogStats, sqlx::Error> {
    sqlx::query_as("SELECT * FROM ingest_backlog_stats()")
        .fetch_one(pool)
        .await
}

pub async fn resolve_grouping(
    pool: &PgPool,
    org: Uuid,
    project: Uuid,
    raw: &str,
    fp: &MultiFingerprint,
) -> Result<String, sqlx::Error> {
    let mut tx = rls::begin_ingest_transaction(pool, org).await?;
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,81))")
        .bind(project.to_string())
        .execute(&mut *tx)
        .await?;
    let alias: Option<String> = sqlx::query_scalar(
        "SELECT fingerprint FROM ingest_group_aliases WHERE project_id=$1 AND raw_key=$2",
    )
    .bind(project)
    .bind(raw)
    .fetch_optional(&mut *tx)
    .await?;
    if let Some(alias) = alias {
        let root:Option<String>=sqlx::query_scalar("WITH RECURSIVE chain AS (SELECT id,fingerprint,merge_parent_id,0 depth FROM issues WHERE project_id=$1 AND fingerprint=$2 UNION ALL SELECT i.id,i.fingerprint,i.merge_parent_id,c.depth+1 FROM issues i JOIN chain c ON i.id=c.merge_parent_id WHERE c.depth<32) SELECT fingerprint FROM chain WHERE merge_parent_id IS NULL LIMIT 1").bind(project).bind(&alias).fetch_optional(&mut *tx).await?;
        tx.commit().await?;
        return Ok(root.unwrap_or(alias));
    }
    let chosen = if fp.custom {
        fp.fingerprint.clone()
    } else {
        sqlx::query_scalar::<_,String>(r#"SELECT fingerprint FROM (SELECT fingerprint,h_locus,h_sim,grouping_anchor,created_at,id FROM issues WHERE project_id=$1 AND merge_parent_id IS NULL
 AND ingest_group_scope(exception_type,grouping_anchor->>'file',grouping_anchor->>'function',grouping_anchor->>'template')=ingest_group_scope($2,$3,$4,$5)
 ORDER BY created_at DESC,id LIMIT 128) candidates WHERE (h_locus=$6 OR (h_sim IS NOT NULL AND abs(COALESCE((grouping_anchor->>'line_bucket')::bigint,0)-$7)<=1 AND bit_count((h_sim # $8)::bit(64))<=3))
 ORDER BY created_at,id LIMIT 1"#).bind(project).bind(&fp.exception_type).bind(&fp.throw_file).bind(&fp.throw_function).bind(&fp.templated_value).bind(hash_to_i64(fp.h_locus)).bind(i64::from(fp.line_bucket)).bind(hash_to_i64(fp.h_sim)).fetch_optional(&mut *tx).await?.unwrap_or_else(||fp.fingerprint.clone())
    };
    sqlx::query("INSERT INTO ingest_group_aliases(org_id,project_id,raw_key,fingerprint) VALUES($1,$2,$3,$4)").bind(org).bind(project).bind(raw).bind(&chosen).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(chosen)
}
/// Set-based application: receipts, exact counts and backlog accounting share one commit.
pub async fn apply_counter_batch(
    pool: &PgPool,
    rows: &[QueuedEvent],
) -> Result<Vec<Uuid>, sqlx::Error> {
    let mut result = Vec::new();
    let mut orgs: std::collections::BTreeMap<Uuid, Vec<&QueuedEvent>> =
        std::collections::BTreeMap::new();
    for row in rows {
        orgs.entry(row.org_id).or_default().push(row);
    }
    for (org, rows) in orgs {
        let mut tx = rls::begin_ingest_transaction(pool, org).await?;
        sqlx::query("SELECT ingest_lock_budget()")
            .execute(&mut *tx)
            .await?;
        let projects: Vec<_> = rows.iter().map(|r| r.project_id).collect();
        let events: Vec<_> = rows.iter().map(|r| r.event_id).collect();
        let tokens: Vec<_> = rows.iter().map(|r| r.lease_token).collect();
        let done=sqlx::query_scalar::<_,Uuid>(r#"
 WITH valid AS MATERIALIZED (
 SELECT i.*,root.id AS issue_id,root.fingerprint FROM ingest_inbox i
 JOIN UNNEST($1::uuid[],$2::uuid[],$3::uuid[]) q(project_id,event_id,token) ON i.project_id=q.project_id AND i.event_id=q.event_id AND i.lease_token=q.token
 JOIN ingest_group_aliases a ON a.project_id=i.project_id AND a.raw_key=i.job #>> '{CounterOnly,fingerprint}'
 JOIN LATERAL (WITH RECURSIVE chain AS (
 SELECT id,fingerprint,merge_parent_id,0 depth FROM issues WHERE project_id=i.project_id AND fingerprint=a.fingerprint
 UNION ALL SELECT p.id,p.fingerprint,p.merge_parent_id,c.depth+1 FROM issues p JOIN chain c ON p.id=c.merge_parent_id WHERE c.depth<32)
 SELECT id,fingerprint FROM chain WHERE merge_parent_id IS NULL LIMIT 1) root ON true
 WHERE i.status='processing'
 ), counts AS (SELECT issue_id,count(*)::bigint n,max(created_at) seen FROM valid GROUP BY issue_id),
 applied AS (UPDATE issues i SET event_count=i.event_count+c.n,spike_coalesced=i.spike_coalesced+c.n,last_seen_at=GREATEST(i.last_seen_at,c.seen) FROM counts c WHERE i.id=c.issue_id),
 counters AS (INSERT INTO issue_counters(project_id,fingerprint,window_start,count,bodies_stored)
 SELECT project_id,fingerprint,date_trunc('hour',created_at),count(*),0 FROM valid GROUP BY project_id,fingerprint,date_trunc('hour',created_at)
 ON CONFLICT(project_id,fingerprint,window_start) DO UPDATE SET count=issue_counters.count+EXCLUDED.count),
 done AS (UPDATE ingest_inbox i SET status='done',job=NULL,bytes=0,lease_token=NULL,leased_until=NULL,last_error=NULL
 FROM valid v WHERE i.project_id=v.project_id AND i.event_id=v.event_id RETURNING v.org_id,v.bytes,i.event_id),
 budgets AS MATERIALIZED (SELECT ingest_release_budget($4,(SELECT count(*) FROM done),COALESCE((SELECT sum(bytes)::bigint FROM done),0)))
 SELECT d.event_id FROM done d CROSS JOIN budgets
 "#).bind(projects).bind(events).bind(tokens).bind(org).fetch_all(&mut *tx).await?;
        tx.commit().await?;
        result.extend(done);
    }
    Ok(result)
}

pub async fn received(
    pool: &PgPool,
    org: Uuid,
    project: Uuid,
    event: Uuid,
) -> Result<bool, sqlx::Error> {
    let mut tx = rls::begin_ingest_transaction(pool, org).await?;
    let value = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM ingest_inbox WHERE project_id=$1 AND event_id=$2)",
    )
    .bind(project)
    .bind(event)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(value)
}
