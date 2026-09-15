use epure_auth::DashboardSession;
use axum::http::StatusCode;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Role {
    Member = 1,
    Admin = 2,
    Owner = 3,
}

impl Role {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "member" => Some(Self::Member),
            "admin" => Some(Self::Admin),
            "owner" => Some(Self::Owner),
            _ => None,
        }
    }
}

pub fn require_min_role(dashboard: &DashboardSession, min: Role) -> Result<(), StatusCode> {
    let Some(current) = Role::parse(&dashboard.role) else {
        return Err(StatusCode::FORBIDDEN);
    };

    if current >= min {
        Ok(())
    } else {
        Err(StatusCode::FORBIDDEN)
    }
}

pub fn validate_member_role(role: &str) -> bool {
    Role::parse(role).is_some()
}
