use chrono::{DateTime, Utc};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

pub fn hash_invite_token(token: &str) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hasher.finalize().to_vec()
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct MemberRow {
    pub user_id: Uuid,
    pub email: String,
    pub display_name: Option<String>,
    pub role: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct InvitationRow {
    pub id: Uuid,
    pub email: String,
    pub role: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct PendingInvitation {
    pub id: Uuid,
    pub org_id: Uuid,
    pub role: String,
    pub email: String,
}

pub async fn list_members(pool: &PgPool, org_id: Uuid) -> Result<Vec<MemberRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let rows = sqlx::query_as::<_, MemberRow>(
        r#"
        SELECT om.user_id, u.email::text AS email, u.display_name, om.role, om.created_at
        FROM org_members om
        INNER JOIN users u ON u.id = om.user_id
        WHERE om.org_id = $1
        ORDER BY om.created_at ASC
        "#,
    )
    .bind(org_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

pub async fn list_invitations(
    pool: &PgPool,
    org_id: Uuid,
) -> Result<Vec<InvitationRow>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let rows = sqlx::query_as::<_, InvitationRow>(
        r#"
        SELECT id, email::text AS email, role, expires_at, created_at
        FROM org_invitations
        WHERE org_id = $1
          AND accepted_at IS NULL
          AND expires_at > now()
        ORDER BY created_at DESC
        "#,
    )
    .bind(org_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

pub async fn create_invitation(
    pool: &PgPool,
    org_id: Uuid,
    email: &str,
    role: &str,
    token_hash: &[u8],
    expires_at: DateTime<Utc>,
) -> Result<InvitationRow, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let row = sqlx::query_as::<_, InvitationRow>(
        r#"
        INSERT INTO org_invitations (email, org_id, role, token_hash, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email::text AS email, role, expires_at, created_at
        "#,
    )
    .bind(email)
    .bind(org_id)
    .bind(role)
    .bind(token_hash)
    .bind(expires_at)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(row)
}

pub async fn delete_invitation(
    pool: &PgPool,
    org_id: Uuid,
    invitation_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let result = sqlx::query(
        r#"
        DELETE FROM org_invitations
        WHERE id = $1 AND org_id = $2 AND accepted_at IS NULL
        "#,
    )
    .bind(invitation_id)
    .bind(org_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(result.rows_affected() > 0)
}

pub async fn find_pending_invitation_by_token(
    pool: &PgPool,
    token: &str,
) -> Result<Option<PendingInvitation>, sqlx::Error> {
    let token_hash = hash_invite_token(token);
    sqlx::query_as::<_, PendingInvitation>(
        r#"
        SELECT id, org_id, role, email
        FROM auth_lookup_invitation($1)
        "#,
    )
    .bind(token_hash)
    .fetch_optional(pool)
    .await
}

pub async fn accept_invitation(
    pool: &PgPool,
    invitation_id: Uuid,
    user_id: Uuid,
    org_id: Uuid,
    role: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("SELECT auth_accept_invitation($1, $2, $3, $4)")
        .bind(invitation_id)
        .bind(user_id)
        .bind(org_id)
        .bind(role)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn accept_invitation_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    invitation_id: Uuid,
    user_id: Uuid,
    org_id: Uuid,
    role: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("SELECT auth_accept_invitation($1, $2, $3, $4)")
        .bind(invitation_id)
        .bind(user_id)
        .bind(org_id)
        .bind(role)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn get_member_role(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
) -> Result<Option<String>, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let role = sqlx::query_scalar(
        r#"
        SELECT role
        FROM org_members
        WHERE org_id = $1 AND user_id = $2
        "#,
    )
    .bind(org_id)
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(role)
}

pub async fn count_owners(pool: &PgPool, org_id: Uuid) -> Result<i64, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let count = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint
        FROM org_members
        WHERE org_id = $1 AND role = 'owner'
        "#,
    )
    .bind(org_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(count)
}

pub async fn update_member_role(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
    role: &str,
) -> Result<bool, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let result = sqlx::query(
        r#"
        UPDATE org_members
        SET role = $3
        WHERE org_id = $1 AND user_id = $2
        "#,
    )
    .bind(org_id)
    .bind(user_id)
    .bind(role)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(result.rows_affected() > 0)
}

pub async fn remove_member(
    pool: &PgPool,
    org_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let mut tx = crate::rls::begin_org_transaction(pool, org_id).await?;
    let result = sqlx::query(
        r#"
        DELETE FROM org_members
        WHERE org_id = $1 AND user_id = $2
        "#,
    )
    .bind(org_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(result.rows_affected() > 0)
}
