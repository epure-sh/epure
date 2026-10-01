mod support;

use epure_envelope::preview_fingerprint;
use epure_storage::{counters, events};
use flate2::write::GzEncoder;
use flate2::Compression;
use std::fs;
use std::io::Write;
use std::time::Duration;
use support::{fixture_path, project_id, spawn_test_server, PUBLIC_KEY};

/// Every language folder under fixtures/sentry that ships an envelope.
const ENVELOPE_LANGUAGES: &[&str] = &[
    "browser", "node", "go", "ruby", "php", "java", "dotnet", "python",
];

fn gzip_bytes(raw: &[u8]) -> Vec<u8> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(raw).expect("gzip write");
    encoder.finish().expect("gzip finish")
}

async fn post_envelope(
    client: &reqwest::Client,
    url: &str,
    body: Vec<u8>,
    content_encoding: Option<&str>,
    auth_header: Option<String>,
) -> reqwest::Response {
    let mut req = client
        .post(url)
        .header("Content-Type", "application/x-sentry-envelope")
        .body(body);
    if let Some(auth) = auth_header {
        req = req.header("X-Sentry-Auth", auth);
    }
    if let Some(encoding) = content_encoding {
        req = req.header("Content-Encoding", encoding);
    }
    req.send().await.expect("post envelope")
}

fn public_key_auth() -> String {
    format!("Sentry sentry_version=7, sentry_key={PUBLIC_KEY}")
}

async fn wait_for_fingerprint(pool: &sqlx::PgPool, fingerprint: &str) {
    for _ in 0..40 {
        let event_count =
            counters::total_event_count_for_fingerprint(pool, project_id(), fingerprint)
                .await
                .expect("issue count");
        if event_count >= 1 {
            return;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    panic!("timed out waiting for fingerprint {fingerprint}");
}

#[tokio::test]
async fn envelope_ingest_persists_issue_row() {
    let (base_url, pool, server) = spawn_test_server().await;
    let body = fs::read(fixture_path("browser", "envelope.txt")).expect("browser fixture");
    let fingerprint = preview_fingerprint(
        &epure_envelope::parse_envelope(&body)
            .expect("parse envelope")
            .event_payload,
    );

    let client = reqwest::Client::new();
    let response = post_envelope(
        &client,
        &format!("{}/api/{}/envelope/", base_url, project_id()),
        body,
        None,
        Some(public_key_auth()),
    )
    .await;
    assert_eq!(response.status(), reqwest::StatusCode::ACCEPTED);

    wait_for_fingerprint(&pool, &fingerprint).await;

    let stored_events = events::count_events_for_project(&pool, project_id())
        .await
        .expect("events count");
    assert!(stored_events >= 1);

    server.abort();
}

/// Matrix: every SDK fixture × raw + gzip (PHP/Laravel/Java/Ruby/.NET default path).
#[tokio::test]
async fn envelope_ingest_accepts_every_sdk_fixture_raw_and_gzip() {
    let (base_url, pool, server) = spawn_test_server().await;
    let client = reqwest::Client::new();
    let url = format!("{}/api/{}/envelope/", base_url, project_id());

    for language in ENVELOPE_LANGUAGES {
        let raw = fs::read(fixture_path(language, "envelope.txt"))
            .unwrap_or_else(|err| panic!("read {language} fixture: {err}"));
        let fingerprint = preview_fingerprint(
            &epure_envelope::parse_envelope(&raw)
                .unwrap_or_else(|err| panic!("parse {language}: {err:?}"))
                .event_payload,
        );

        let raw_response =
            post_envelope(&client, &url, raw.clone(), None, Some(public_key_auth())).await;
        assert_eq!(
            raw_response.status(),
            reqwest::StatusCode::ACCEPTED,
            "{language} raw envelope must return 202"
        );
        wait_for_fingerprint(&pool, &fingerprint).await;

        let gzip_response = post_envelope(
            &client,
            &url,
            gzip_bytes(&raw),
            Some("gzip"),
            Some(public_key_auth()),
        )
        .await;
        assert_eq!(
            gzip_response.status(),
            reqwest::StatusCode::ACCEPTED,
            "{language} gzip envelope must return 202"
        );
    }

    let stored_events = events::count_events_for_project(&pool, project_id())
        .await
        .expect("events count");
    assert!(
        stored_events >= ENVELOPE_LANGUAGES.len() as i64,
        "expected >= {} events, got {stored_events}",
        ENVELOPE_LANGUAGES.len()
    );

    server.abort();
}

#[tokio::test]
async fn envelope_ingest_accepts_gzip_without_content_encoding_header() {
    let (base_url, _pool, server) = spawn_test_server().await;
    let client = reqwest::Client::new();
    let raw = fs::read(fixture_path("php", "envelope.txt")).expect("php fixture");

    let response = post_envelope(
        &client,
        &format!("{}/api/{}/envelope/", base_url, project_id()),
        gzip_bytes(&raw),
        None,
        Some(public_key_auth()),
    )
    .await;
    assert_eq!(response.status(), reqwest::StatusCode::ACCEPTED);

    server.abort();
}

#[tokio::test]
async fn envelope_ingest_accepts_laravel_like_multi_item_gzip() {
    let (base_url, pool, server) = spawn_test_server().await;
    let client = reqwest::Client::new();

    let session = r#"{"sid":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","status":"ok"}"#;
    let event = r#"{"level":"error","platform":"php","exception":{"values":[{"type":"ErrorException","value":"Laravel multi-item envelope"}]}}"#;
    let body = format!(
        "{}\n{}\n{}\n{}\n{}\n",
        r#"{"event_id":"660e8400-e29b-41d4-a716-4466554400aa","sdk":{"name":"sentry.php.laravel","version":"4.8.0"}}"#,
        format!(r#"{{"type":"session","length":{}}}"#, session.len()),
        session,
        format!(r#"{{"type":"event","length":{}}}"#, event.len()),
        event,
    );
    let fingerprint = preview_fingerprint(event.as_bytes());

    let response = post_envelope(
        &client,
        &format!("{}/api/{}/envelope/", base_url, project_id()),
        gzip_bytes(body.as_bytes()),
        Some("gzip"),
        Some(public_key_auth()),
    )
    .await;
    assert_eq!(response.status(), reqwest::StatusCode::ACCEPTED);
    wait_for_fingerprint(&pool, &fingerprint).await;

    server.abort();
}

#[tokio::test]
async fn envelope_ingest_accepts_numeric_dsn_and_query_auth() {
    let (base_url, pool, server) = spawn_test_server().await;
    let dsn_project_id: i64 =
        sqlx::query_scalar("SELECT dsn_project_id FROM projects WHERE id = $1")
            .bind(project_id())
            .fetch_one(&pool)
            .await
            .expect("dsn project id");

    let body = fs::read(fixture_path("go", "envelope.txt")).expect("go fixture");
    let fingerprint = preview_fingerprint(
        &epure_envelope::parse_envelope(&body)
            .expect("parse go")
            .event_payload,
    );

    let client = reqwest::Client::new();
    let url = format!(
        "{}/api/{dsn_project_id}/envelope/?sentry_key={PUBLIC_KEY}&sentry_version=7",
        base_url
    );
    let response = post_envelope(&client, &url, gzip_bytes(&body), Some("gzip"), None).await;
    assert_eq!(
        response.status(),
        reqwest::StatusCode::ACCEPTED,
        "numeric DSN + query auth + gzip must work"
    );
    wait_for_fingerprint(&pool, &fingerprint).await;

    server.abort();
}

#[tokio::test]
async fn envelope_ingest_accepts_crlf_gzip_dotnet_style() {
    let (base_url, pool, server) = spawn_test_server().await;
    let event = r#"{"level":"error","platform":"csharp","exception":{"values":[{"type":"System.Exception","value":"CRLF envelope"}]}}"#;
    let body = format!(
        "{}\r\n{}\r\n{}\r\n",
        r#"{"event_id":"770e8400-e29b-41d4-a716-4466554400bb","sdk":{"name":"sentry.dotnet","version":"4.9.0"}}"#,
        format!(r#"{{"type":"event","length":{}}}"#, event.len()),
        event,
    );
    let fingerprint = preview_fingerprint(event.as_bytes());
    let client = reqwest::Client::new();
    let response = post_envelope(
        &client,
        &format!("{}/api/{}/envelope/", base_url, project_id()),
        gzip_bytes(body.as_bytes()),
        Some("gzip"),
        Some(public_key_auth()),
    )
    .await;
    assert_eq!(response.status(), reqwest::StatusCode::ACCEPTED);
    wait_for_fingerprint(&pool, &fingerprint).await;
    server.abort();
}

#[tokio::test]
async fn envelope_ingest_rejects_garbage_binary_as_malformed() {
    let (base_url, _pool, server) = spawn_test_server().await;
    let client = reqwest::Client::new();
    let response = post_envelope(
        &client,
        &format!("{}/api/{}/envelope/", base_url, project_id()),
        b"\x00\xffnot-gzip".to_vec(),
        None,
        Some(public_key_auth()),
    )
    .await;
    assert_eq!(response.status(), reqwest::StatusCode::BAD_REQUEST);
    let body = response.text().await.expect("body");
    assert!(
        body.contains("invalid_envelope"),
        "expected invalid_envelope, got {body}"
    );
    server.abort();
}
