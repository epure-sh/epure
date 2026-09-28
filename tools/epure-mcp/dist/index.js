#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { API_CATALOG, epureFetch, epureJson } from "./client.js";
import { assertEpureApiPath } from "./path.js";
if (!process.env.EPURE_TOKEN) {
    console.error("EPURE_TOKEN is required (epure_pat_… from workspace Settings → Agent tokens)");
    process.exit(2);
}
const server = new McpServer({
    name: "epure",
    version: "0.2.0",
});
server.resource("epure-api-catalog", "epure://api/catalog", { mimeType: "text/plain", description: "Full Epure REST API surface for PAT-authenticated calls" }, async () => ({
    contents: [{ uri: "epure://api/catalog", mimeType: "text/plain", text: API_CATALOG }],
}));
server.tool("epure_api", "Call any Epure /api/v1 endpoint (issues, projects, webhooks, DSN, stats, setup, agent queue/context). Server enforces PAT scopes and RBAC.", {
    method: z.enum(["GET", "POST", "PATCH", "DELETE"]),
    path: z
        .string()
        .describe("Path starting with /api/v1/… e.g. /api/v1/issues?q=is:unresolved"),
    body: z.record(z.unknown()).optional().describe("JSON body for POST/PATCH"),
}, async ({ method, path, body }) => {
    const safePath = assertEpureApiPath(path);
    const init = { method };
    if (body && method !== "GET") {
        init.body = JSON.stringify(body);
    }
    const response = await epureFetch(safePath, init);
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`Epure API ${response.status}: ${text}`);
    }
    return { content: [{ type: "text", text: text || "(empty)" }] };
});
server.tool("epure_queue", "Prioritized unresolved issues — start here before fixing.", {
    project_id: z.string().uuid().optional(),
    environment: z.string().optional(),
    limit: z.number().int().min(1).max(50).optional(),
    q: z.string().optional(),
}, async ({ project_id, environment, limit, q }) => {
    const params = new URLSearchParams();
    if (project_id)
        params.set("project_id", project_id);
    if (environment)
        params.set("environment", environment);
    if (limit != null)
        params.set("limit", String(limit));
    if (q)
        params.set("q", q);
    const suffix = params.toString();
    const data = await epureJson(`/api/v1/agent/queue${suffix ? `?${suffix}` : ""}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("epure_issue_context", "Fix-ready markdown + stack for one issue.", {
    issue_id: z.string().uuid(),
    format: z.enum(["markdown", "json"]).optional(),
    event: z.string().optional(),
}, async ({ issue_id, format, event }) => {
    const params = new URLSearchParams();
    params.set("format", format ?? "markdown");
    if (event)
        params.set("event", event);
    const path = `/api/v1/agent/issues/${issue_id}/context?${params.toString()}`;
    if ((format ?? "markdown") === "markdown") {
        const response = await epureFetch(path);
        const text = await response.text();
        if (!response.ok)
            throw new Error(`Epure API ${response.status}: ${text}`);
        return { content: [{ type: "text", text }] };
    }
    const data = await epureJson(path);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("epure_issue_snooze", "Snooze an issue (hours, occurrences, or users). Requires write:triage.", {
    issue_id: z.string().uuid(),
    mode: z.enum(["hours", "occurrences", "users", "4h", "100", "10"]),
}, async ({ issue_id, mode }) => {
    const data = await epureJson(`/api/v1/issues/${issue_id}/snooze`, {
        method: "POST",
        body: JSON.stringify({ mode }),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("epure_alerts_unread", "Unread alerts with issue_id when present.", {
    project_id: z.string().uuid().optional(),
    environment: z.string().optional(),
    limit: z.number().int().min(1).max(200).optional(),
}, async ({ project_id, environment, limit }) => {
    const params = new URLSearchParams({ view: "unread" });
    if (project_id)
        params.set("project_id", project_id);
    if (environment)
        params.set("environment", environment);
    if (limit != null)
        params.set("limit", String(limit));
    const data = await epureJson(`/api/v1/alerts?${params.toString()}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("epure_triage_resolve", "Resolve issue after fix verified. Requires write:triage.", {
    issue_id: z.string().uuid(),
    release: z.string().optional(),
}, async ({ issue_id, release }) => {
    const body = { status: "resolved" };
    if (release)
        body.resolved_in_release = release;
    const data = await epureJson(`/api/v1/issues/${issue_id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("epure_triage_ignore", "Ignore issue. Requires write:triage.", { issue_id: z.string().uuid() }, async ({ issue_id }) => {
    const data = await epureJson(`/api/v1/issues/${issue_id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "ignored" }),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("epure_triage_reopen", "Reopen issue. Requires write:triage.", { issue_id: z.string().uuid() }, async ({ issue_id }) => {
    const data = await epureJson(`/api/v1/issues/${issue_id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "unresolved" }),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
const transport = new StdioServerTransport();
await server.connect(transport);
