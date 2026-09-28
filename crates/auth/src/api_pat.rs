use uuid::Uuid;

/// Present when the request authenticated with a personal access token.
#[derive(Clone, Debug)]
pub struct ApiPatAuth {
    pub token_id: Uuid,
    pub scopes: Vec<String>,
}
