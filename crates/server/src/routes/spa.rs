use axum::{
    body::Body,
    http::{header, HeaderValue, Method, Request, StatusCode, Uri},
    response::{IntoResponse, Response},
};

use crate::embed::WebAssets;

fn cache_control_for(path: &str) -> HeaderValue {
    if path == "index.html" || path.ends_with(".html") {
        HeaderValue::from_static("no-cache")
    } else {
        HeaderValue::from_static("public, max-age=31536000, immutable")
    }
}

fn asset_response(path: &str, content: rust_embed::EmbeddedFile) -> Response {
    let mime = mime_guess::from_path(path).first_or_octet_stream();
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime.as_ref())
        .header(header::CACHE_CONTROL, cache_control_for(path))
        .body(Body::from(content.data.into_owned()))
        .unwrap()
}

pub async fn serve_embedded(uri: Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');

    if path.is_empty() {
        return index_html_response();
    }

    if let Some(content) = WebAssets::get(path) {
        return asset_response(path, content);
    }

    if path.contains('.') {
        return StatusCode::NOT_FOUND.into_response();
    }

    index_html_response()
}

fn index_html_response() -> Response {
    match WebAssets::get("index.html") {
        Some(content) => asset_response("index.html", content),
        None => (
            StatusCode::NOT_FOUND,
            "SPA assets not embedded — run `cd web && npm run build` before `cargo build`",
        )
            .into_response(),
    }
}

pub async fn spa_fallback(req: Request<Body>) -> impl IntoResponse {
    if req.method() != Method::GET && req.method() != Method::HEAD {
        return StatusCode::NOT_FOUND.into_response();
    }

    serve_embedded(req.uri().clone()).await.into_response()
}
