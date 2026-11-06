mod support;

use reqwest::multipart::{Form, Part};
use serde_json::{json, Value};
use sha1::Digest;
use std::{
    io::{Cursor, Write},
    time::Duration,
};
use support::{project_id, spawn_test_server};

fn sha1_hex(bytes: &[u8]) -> String {
    let mut hasher = sha1::Sha1::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

#[tokio::test]
async fn chunk_upload_and_assembly_end_to_end() {
    let (base_url, pool, server) = spawn_test_server().await;
    let anonymous = reqwest::Client::new();
    let client = reqwest::Client::builder()
        .cookie_store(true)
        .build()
        .unwrap();
    let org_slug = "acme-corp";
    let version = "v2.0.0";

    let url = format!("{base_url}/api/0/organizations/{org_slug}/chunk-upload/");
    assert_eq!(
        anonymous
            .post(&url)
            .multipart(Form::new())
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
    assert_eq!(
        client
            .post(format!("{base_url}/api/v1/auth/login"))
            .json(&serde_json::json!({"email":"dev@epure.local","password":"devpassword"}))
            .send()
            .await
            .unwrap()
            .status(),
        204
    );
    assert_eq!(
        client
            .post(format!(
                "{base_url}/api/0/organizations/another-tenant/chunk-upload/"
            ))
            .multipart(Form::new())
            .send()
            .await
            .unwrap()
            .status(),
        404
    );

    let token_response = client
        .post(format!("{base_url}/api/v1/agent-tokens"))
        .json(&serde_json::json!({"label":"Source maps","scopes":["write:sourcemaps"]}))
        .send()
        .await
        .unwrap();
    assert_eq!(token_response.status(), 201);
    let token_response: serde_json::Value = token_response.json().await.unwrap();
    let token = token_response["token"]["token"].as_str().unwrap();
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::AUTHORIZATION,
        format!("Bearer {token}").parse().unwrap(),
    );
    let client = reqwest::Client::builder()
        .default_headers(headers)
        .build()
        .unwrap();
    assert_eq!(
        client
            .get(format!("{base_url}/api/v1/projects"))
            .send()
            .await
            .unwrap()
            .status(),
        403
    );

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

    // Upload a JS source bundle to a non-default project, then resolve a
    // release-less frame through the same Debug ID sent by the SDK.
    let debug_id = uuid::Uuid::new_v4().to_string();
    let org_id: uuid::Uuid = "11111111-1111-1111-1111-111111111111".parse().unwrap();
    let project: uuid::Uuid =
        sqlx::query_scalar("INSERT INTO projects(org_id,name,slug) VALUES($1,$2,$2) RETURNING id")
            .bind(org_id)
            .bind(format!("bundle-{}", uuid::Uuid::new_v4()))
            .fetch_one(&pool)
            .await
            .unwrap();
    sqlx::query(
        "INSERT INTO dsn_keys(project_id, public_key, secret_key) VALUES($1,$2,convert_to('bundle-secret','UTF8'))",
    ).bind(project).bind(&debug_id).execute(&pool).await.unwrap();
    let bundle = source_bundle(&debug_id);
    let bundle_digest = sha1_hex(&bundle);
    let bundle_url = format!("{base_url}/api/0/organizations/{org_slug}/artifactbundle/assemble/");
    let body = json!({"checksum":bundle_digest,"chunks":[bundle_digest],"projects":[project]});
    let assemble = || client.post(&bundle_url).json(&body);
    let missing: Value = assemble()
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap()
        .json()
        .await
        .unwrap();
    assert_eq!(missing["missingChunks"], json!([bundle_digest]));
    assert_eq!(
        client
            .post(&url)
            .multipart(Form::new().part("file", Part::bytes(bundle).file_name(bundle_digest),))
            .send()
            .await
            .unwrap()
            .status(),
        200,
    );
    for _ in 0..2 {
        let assembled: Value = assemble()
            .send()
            .await
            .unwrap()
            .error_for_status()
            .unwrap()
            .json()
            .await
            .unwrap();
        assert_eq!(assembled["state"], "ok", "{assembled}");
    }
    let artifact_count: i64 =
        sqlx::query_scalar("SELECT count(*) FROM release_artifacts WHERE debug_id=$1")
            .bind(&debug_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(artifact_count, 1);

    let event: Value = anonymous.post(format!("{base_url}/api/{project}/store/"))
        .header("X-Sentry-Auth", format!("Sentry sentry_version=7, sentry_key={debug_id}, sentry_secret=bundle-secret"))
        .json(&json!({
            "platform":"javascript",
            "debug_meta":{"images":[{"type":"sourcemap","code_file":"https://test.example/app.min.js","debug_id":debug_id}]},
            "exception":{"values":[{"type":"TypeError","value":"Bundle smoke test","stacktrace":{"frames":[
                {"abs_path":"https://test.example/app.min.js","filename":"app.min.js","lineno":1,"colno":10,"in_app":true}
            ]}}]},
        }))
        .send().await.unwrap().error_for_status().unwrap().json().await.unwrap();
    let id: uuid::Uuid = event["id"].as_str().unwrap().parse().unwrap();
    let frames: Value = tokio::time::timeout(Duration::from_secs(5), async {
        loop {
            if let Some(frames) = sqlx::query_scalar("SELECT stack_frames FROM events WHERE id=$1")
                .bind(id)
                .fetch_optional(&pool)
                .await
                .unwrap()
            {
                break frames;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    })
    .await
    .expect("bundle event stored");
    assert_eq!(frames[0]["filename"], "src/app.ts", "{frames}");
    assert_eq!(frames[0]["demangled"], true, "{frames}");
    assert_eq!(frames[0]["function"], "throwError", "{frames}");

    server.abort();
}

fn source_bundle(debug_id: &str) -> Vec<u8> {
    let mut archive = zip::ZipWriter::new(Cursor::new(Vec::new()));
    let deflated = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    archive.start_file("manifest.json", deflated).unwrap();
    serde_json::to_writer(&mut archive, &json!({
        "files":{"files/app.min.js.map":{"type":"source_map","url":"~/app.min.js.map","headers":{"debug-id":debug_id}}}
    })).unwrap();
    archive
        .start_file("files/app.min.js.map", deflated)
        .unwrap();
    archive
        .write_all(include_bytes!(
            "../../../fixtures/processing/app.min.js.map"
        ))
        .unwrap();
    archive.finish().unwrap().into_inner()
}
