import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchOAuthInfo, submitOAuthAuthorize, verifyDeviceCode, approveDeviceCode, fetchConnectedApps } from "./api";

test("OAuth browser and device clients call the versioned API routes", async () => {
  const original = globalThis.fetch; const calls: string[] = [];
  globalThis.fetch = async (input) => { calls.push(String(input)); return new Response(JSON.stringify({ organizations: [], connected_apps: [] }), { headers: {"content-type":"application/json"} }); };
  try {
    await fetchOAuthInfo("epure-cli", "http://127.0.0.1:1234/callback");
    await submitOAuthAuthorize({ client_id:"epure-cli", org_id:"workspace", redirect_uri:"http://127.0.0.1:1234/callback", code_challenge:"challenge" });
    await verifyDeviceCode("ABCD"); await approveDeviceCode("ABCD", "workspace"); await fetchConnectedApps();
    assert.ok(calls.every(path => path.startsWith("/api/v1/"))); assert.ok(calls[0]?.includes("redirect_uri="));
  } finally { globalThis.fetch = original; }
});

test("an unexpected HTML response produces a useful error instead of a JSON parsing exception", async () => {
  const original = globalThis.fetch; globalThis.fetch = async () => new Response("<!doctype html><html></html>");
  try { await assert.rejects(fetchOAuthInfo("epure-cli"), /Unexpected server response/); }
  finally { globalThis.fetch = original; }
});
