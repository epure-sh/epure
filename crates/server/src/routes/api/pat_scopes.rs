use axum::http::{Method, StatusCode};
use epure_auth::AgentTokenSession;
use epure_storage::agent_tokens;

/// Which PAT scopes are required for this request (empty = session cookie only, no PAT check).
pub fn pat_missing_scopes(method: &Method, path: &str, scopes: &[String]) -> Option<StatusCode> {
    let path = path.strip_prefix("/api/v1").unwrap_or(path);

    if path.starts_with("/auth") {
        return Some(StatusCode::FORBIDDEN);
    }

    let needs_read = || {
        if !agent_tokens::has_scope(scopes, agent_tokens::SCOPE_READ_AGENT) {
            return Some(StatusCode::FORBIDDEN);
        }
        None
    };

    let needs_triage = || {
        if !agent_tokens::has_scope(scopes, agent_tokens::SCOPE_WRITE_TRIAGE) {
            return Some(StatusCode::FORBIDDEN);
        }
        None
    };

    let needs_admin = || {
        if !agent_tokens::has_scope(scopes, agent_tokens::SCOPE_WRITE_ADMIN) {
            return Some(StatusCode::FORBIDDEN);
        }
        None
    };

    if method == Method::GET || method == Method::HEAD {
        if path.starts_with("/agent-tokens") || path.starts_with("/invitations") {
            return needs_admin();
        }
        return needs_read();
    }

    if path.starts_with("/agent-tokens") {
        return needs_admin();
    }

    if path == "/issues/trends" {
        return needs_read();
    }

    if path.starts_with("/issues")
        || path.starts_with("/agent/issues")
        || path.starts_with("/alerts/")
    {
        return needs_triage();
    }

    if path.starts_with("/agent/") && *method != Method::GET {
        return needs_triage();
    }

    if path.starts_with("/webhooks")
        || path.starts_with("/alert-rules")
        || path.starts_with("/dsn-keys")
        || path.starts_with("/members")
        || path.starts_with("/invitations")
    {
        return needs_admin();
    }

    if path.starts_with("/projects") {
        return needs_admin();
    }

    if path.starts_with("/setup") {
        if *method == Method::POST {
            return needs_read();
        }
        if *method == Method::PATCH {
            return needs_triage();
        }
    }

    if path == "/issues/merge" || path == "/issues/split" {
        return needs_triage();
    }

    if *method != Method::GET && *method != Method::HEAD {
        return Some(StatusCode::FORBIDDEN);
    }

    needs_read()
}

pub fn session_from_pat(agent: &AgentTokenSession, email: String) -> epure_auth::DashboardSession {
    epure_auth::DashboardSession {
        user_id: agent.user_id,
        org_id: agent.org_id,
        email,
        role: agent.role.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use epure_storage::agent_tokens::{SCOPE_READ_AGENT, SCOPE_WRITE_ADMIN, SCOPE_WRITE_TRIAGE};

    fn scopes(read: bool, triage: bool, admin: bool) -> Vec<String> {
        let mut s = Vec::new();
        if read {
            s.push(SCOPE_READ_AGENT.to_string());
        }
        if triage {
            s.push(SCOPE_WRITE_TRIAGE.to_string());
        }
        if admin {
            s.push(SCOPE_WRITE_ADMIN.to_string());
        }
        s
    }

    #[test]
    fn read_only_allows_get_issues_blocks_patch() {
        let s = scopes(true, false, false);
        assert!(pat_missing_scopes(&Method::GET, "/api/v1/issues", &s).is_none());
        assert_eq!(
            pat_missing_scopes(&Method::PATCH, "/api/v1/issues/uuid", &s),
            Some(StatusCode::FORBIDDEN)
        );
    }

    #[test]
    fn admin_list_requires_write_admin() {
        let s = scopes(true, false, false);
        assert_eq!(
            pat_missing_scopes(&Method::GET, "/api/v1/agent-tokens", &s),
            Some(StatusCode::FORBIDDEN)
        );
        let full = scopes(true, false, true);
        assert!(pat_missing_scopes(&Method::GET, "/api/v1/agent-tokens", &full).is_none());
    }

    #[test]
    fn post_projects_requires_admin() {
        let s = scopes(true, true, false);
        assert_eq!(
            pat_missing_scopes(&Method::POST, "/api/v1/projects", &s),
            Some(StatusCode::FORBIDDEN)
        );
    }

    #[test]
    fn post_issues_trends_is_read() {
        let s = scopes(true, false, false);
        assert!(pat_missing_scopes(&Method::POST, "/api/v1/issues/trends", &s).is_none());
    }

    #[test]
    fn triage_scope_allows_patch_issue() {
        let s = scopes(true, true, false);
        assert!(pat_missing_scopes(&Method::PATCH, "/api/v1/issues/uuid", &s).is_none());
        assert!(pat_missing_scopes(&Method::PATCH, "/api/v1/agent/issues/uuid", &s).is_none());
    }

    #[test]
    fn invitations_require_admin_even_with_triage() {
        let triage = scopes(true, true, false);
        assert_eq!(
            pat_missing_scopes(&Method::POST, "/api/v1/invitations", &triage),
            Some(StatusCode::FORBIDDEN)
        );
        assert_eq!(
            pat_missing_scopes(&Method::GET, "/api/v1/invitations", &triage),
            Some(StatusCode::FORBIDDEN)
        );
        let admin = scopes(true, false, true);
        assert!(pat_missing_scopes(&Method::POST, "/api/v1/invitations", &admin).is_none());
        assert!(pat_missing_scopes(&Method::DELETE, "/api/v1/invitations/uuid", &admin).is_none());
    }

    #[test]
    fn unknown_mutation_is_denied() {
        let triage = scopes(true, true, false);
        assert_eq!(
            pat_missing_scopes(&Method::POST, "/api/v1/not-a-route", &triage),
            Some(StatusCode::FORBIDDEN)
        );
    }

    #[test]
    fn auth_paths_always_forbidden_for_pat() {
        let s = scopes(true, true, true);
        assert_eq!(
            pat_missing_scopes(&Method::POST, "/api/v1/auth/login", &s),
            Some(StatusCode::FORBIDDEN)
        );
    }
}
