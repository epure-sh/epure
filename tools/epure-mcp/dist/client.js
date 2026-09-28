const EPURE_URL = (process.env.EPURE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const EPURE_TOKEN = process.env.EPURE_TOKEN;
export function requireToken() {
    if (!EPURE_TOKEN) {
        throw new Error("EPURE_TOKEN is required (epure_pat_… from Settings → Agent tokens)");
    }
    return EPURE_TOKEN;
}
export async function epureFetch(path, init) {
    const token = requireToken();
    const url = `${EPURE_URL}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init?.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    return fetch(url, { ...init, headers });
}
export async function epureJson(path, init) {
    const response = await epureFetch(path, init);
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`Epure API ${response.status}: ${text}`);
    }
    if (!text) {
        return null;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/markdown")) {
        return text;
    }
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
/** Dashboard + agent routes a PAT may call (enforced again on server). */
export const API_CATALOG = `
Epure API (prefix /api/v1). Auth: Bearer epure_pat_…

Scopes: read:agent (GET), write:triage (issues/alerts/snooze), write:admin (projects, DSN, webhooks, alert-rules, members, agent-tokens).

Issues: GET/PATCH /issues, POST /issues/trends, PATCH/DELETE /issues/bulk, POST /issues/merge|split, POST /issues/{id}/snooze
Events: GET /issues/{id}/events|releases|timeline, GET /events/{id}/feedback
Agent: GET /agent/queue, GET /agent/issues/{id}/context?format=markdown, GET /agent/whoami
Alerts: GET/PATCH /alerts, GET/POST/PATCH/DELETE /alert-rules
Projects: GET/POST /projects, PATCH/DELETE /projects/{id}, GET /projects/{id}/activity
Stats: GET /stats?project_id=
Setup: GET/PATCH /setup, GET /setup/dsn, POST /setup/test-event
DSN: GET/POST /projects/{id}/dsn-keys, POST revoke/rotate
Webhooks: CRUD /webhooks, POST /webhooks/{id}/test|rotate-secret
Members: GET /members, POST /invitations, PATCH/DELETE members
Releases: GET /releases
Agent tokens: GET/POST /agent-tokens, POST /agent-tokens/{id}/revoke
`.trim();
