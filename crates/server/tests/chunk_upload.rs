mod support;

use reqwest::multipart::{Form, Part};
use sha1::Digest;
use support::{project_id, spawn_test_server};

fn sha1_hex(bytes: &[u8]) -> String {
    let mut hasher = sha1::Sha1::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

#[tokio::test]
async fn chunk_upload_and_assembly_end_to_end() {
    let (base_url, pool, server) = spawn_test_server().await;
    let client = reqwest::Client::new();
    let org_slug = "acme-corp";
    let version = "v2.0.0";

    // 1. GET chunk-upload configuration
    let resp = client
        .get(format!(
            "{base_url}/api/0/organizations/{org_slug}/chunk-upload/"
        ))
        .send()
        .await
        .expect("get chunk upload");
    assert_eq!(resp.status(), reqwest::StatusCode::OK);
    let config: serde_json::Value = resp.json().await.expect("json config");
    assert_eq!(config["chunkSize"], 8388608);
    assert_eq!(config["hashAlgorithm"], "sha1");

    // 2. Prepare sample sourcemap and chunks
    let chunk1_data = b"{\"version\":3,\"file\":\"bundle.js\",";
    let chunk2_data = b"\"sources\":[\"src/index.ts\"],\"mappings\":\"AAAA;\"}";
    let mut whole_data = Vec::new();
    whole_data.extend_from_slice(chunk1_data);
    whole_data.extend_from_slice(chunk2_data);

    let chunk1_sha1 = sha1_hex(chunk1_data);
    let chunk2_sha1 = sha1_hex(chunk2_data);
    let whole_sha1 = sha1_hex(&whole_data);

    // 3. POST multipart chunk upload
    let form = Form::new()
        .part(
            chunk1_sha1.clone(),
            Part::bytes(chunk1_data.to_vec()).file_name(chunk1_sha1.clone()),
        )
        .part(
            chunk2_sha1.clone(),
            Part::bytes(chunk2_data.to_vec()).file_name(chunk2_sha1.clone()),
        );

    let upload_resp = client
        .post(format!(
            "{base_url}/api/0/organizations/{org_slug}/chunk-upload/"
        ))
        .multipart(form)
        .send()
        .await
        .expect("upload chunks");
    assert_eq!(upload_resp.status(), reqwest::StatusCode::OK);

    // 4. Test missing chunks assemble request
    let missing_resp = client
        .post(format!(
            "{base_url}/api/0/organizations/{org_slug}/releases/{version}/assemble/"
        ))
        .json(&serde_json::json!({
            "checksum": "nonexistent",
            "name": "~/missing.map",
            "chunks": ["0123456789abcdef0123456789abcdef01234567"]
        }))
        .send()
        .await
        .expect("missing assemble");
    assert_eq!(missing_resp.status(), reqwest::StatusCode::OK);
    let missing_body: serde_json::Value = missing_resp.json().await.expect("json body");
    assert_eq!(missing_body["state"], "not_found");
    assert_eq!(
        missing_body["missingChunks"],
        serde_json::json!(["0123456789abcdef0123456789abcdef01234567"])
    );

    // 5. Assemble release artifact
    let assemble_resp = client
        .post(format!(
            "{base_url}/api/0/organizations/{org_slug}/releases/{version}/assemble/"
        ))
        .json(&serde_json::json!({
            "checksum": whole_sha1,
            "name": "~/dist/bundle.js.map",
            "chunks": [chunk1_sha1, chunk2_sha1]
        }))
        .send()
        .await
        .expect("assemble release");
    assert_eq!(assemble_resp.status(), reqwest::StatusCode::OK);
    let assemble_body: serde_json::Value = assemble_resp.json().await.expect("json body");
    assert_eq!(assemble_body["state"], "ok");
    assert_eq!(assemble_body["missingChunks"], serde_json::json!([]));

    // 6. Verify database and disk storage
    let artifact: (String, String) = sqlx::query_as(
        r#"
        SELECT ra.name, ra.storage_path
        FROM release_artifacts ra
        JOIN releases r ON r.id = ra.release_id
        WHERE r.project_id = $1 AND r.version = $2 AND ra.name = '~/dist/bundle.js.map'
        "#,
    )
    .bind(project_id())
    .bind(version)
    .fetch_one(&pool)
    .await
    .expect("fetch assembled artifact");

    assert_eq!(artifact.0, "~/dist/bundle.js.map");
    let on_disk_bytes = tokio::fs::read(&artifact.1)
        .await
        .expect("read assembled file on disk");
    assert_eq!(on_disk_bytes, whole_data);

    // 7. DIFs assemble with debug_id
    let difs_resp = client
        .post(format!(
            "{base_url}/api/0/projects/{org_slug}/acme-web/files/difs/assemble/"
        ))
        .json(&serde_json::json!({
            whole_sha1.clone(): {
                "name": "app.debug",
                "debug_id": "AAAA-BBBB-CCCC-DDDD",
                "chunks": [chunk1_sha1, chunk2_sha1]
            }
        }))
        .send()
        .await
        .expect("difs assemble");
    assert_eq!(difs_resp.status(), reqwest::StatusCode::OK);
    let difs_body: serde_json::Value = difs_resp.json().await.expect("difs body");
    assert_eq!(difs_body[&whole_sha1]["state"], "ok");

    let debug_id: Option<String> = sqlx::query_scalar(
        r#"
        SELECT ra.debug_id
        FROM release_artifacts ra
        JOIN releases r ON r.id = ra.release_id
        WHERE r.project_id = $1 AND r.version = 'difs' AND ra.name = 'app.debug'
        "#,
    )
    .bind(project_id())
    .fetch_optional(&pool)
    .await
    .expect("fetch dif artifact");

    assert_eq!(debug_id.as_deref(), Some("AAAA-BBBB-CCCC-DDDD"));

    server.abort();
}
