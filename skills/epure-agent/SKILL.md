---
name: epure-agent
description: >-
  Operate a running Epure workspace with epure-mcp or epure-cli: queue, issue
  context, triage, alerts, projects, DSN, webhooks, stats. Use when the user
  mentions Epure MCP, epure-cli, EPURE_TOKEN, agent tokens, unresolved issues,
  or workspace admin from chat. Install the host with epure-setup first.
---

# Epure agent

PAT auth for `/api/v1/*` except `/auth/*`. Same data as the dashboard. Ingest stays on the DSN (**epure-wire**).

`EPURE_URL` is the browser origin. Local: `http://localhost:8080`. Production: `https://your-hostname`. Do not set a prod client to `http://IP:8080` (Secure cookie and the public URL will not match how you are calling the API).

## Token

**Settings → Agent tokens** (admin). Shown once.

| Scope | Allows |
| --- | --- |
| `read:agent` | Always on. All GET `/api/v1/*` |
| `write:triage` | Resolve, ignore, snooze, merge, bulk, alert patches |
| `write:admin` | Projects, DSN keys, webhooks, alert rules, members, token CRUD |

Member role can still 403 on admin routes. Check `epure-cli auth whoami`.

## MCP

Build once: `cd tools/epure-mcp && npm ci && npm run build`.

```json
{
  "mcpServers": {
    "epure": {
      "command": "node",
      "args": ["/absolute/path/to/epure/tools/epure-mcp/dist/index.js"],
      "env": {
        "EPURE_URL": "https://errors.example.com",
        "EPURE_TOKEN": "epure_pat_…"
      }
    }
  }
}
```

Missing `EPURE_TOKEN` exits the process. Resource `epure://api/catalog` lists routes.

| Tool | Use | Scope |
| --- | --- | --- |
| `epure_queue` | Unresolved queue. Start here | read |
| `epure_issue_context` | Markdown or JSON for one issue UUID | read |
| `epure_alerts_unread` | Unread alerts | read |
| `epure_api` | GET/POST/PATCH/DELETE `/api/v1/…` | per route |
| `epure_triage_resolve` | After the user confirms the fix | write:triage |
| `epure_triage_ignore` | Ignore | write:triage |
| `epure_triage_reopen` | Reopen | write:triage |
| `epure_issue_snooze` | `hours`, `occurrences`, `users`, `4h`, `100`, `10` | write:triage |

`epure_api` rejects `/api/v1/auth/*`.

## CLI

Binary in the image, or `cargo build --release --bin epure-cli`.

```bash
export EPURE_URL=https://errors.example.com EPURE_TOKEN=epure_pat_…
epure-cli auth whoami
epure-cli --output table queue --limit 20
epure-cli context ISSUE_UUID --format markdown
epure-cli issue show ISSUE_UUID
epure-cli alerts --view unread
epure-cli api GET '/api/v1/projects'
epure-cli triage resolve ISSUE_UUID --release my-app@1.2.0
epure-cli triage ignore ISSUE_UUID
epure-cli triage reopen ISSUE_UUID
epure-cli triage snooze ISSUE_UUID --mode hours
```

## Fix loop

1. `epure_queue` or `epure-cli queue`.
2. `epure_issue_context` or `epure-cli context … --format markdown`.
3. Patch the app repo. Run tests. Do not invent traces, replay, or logs.
4. Resolve, ignore, or snooze only after the user confirms. Needs `write:triage`.

Admin (new project, DSN, webhook): `epure_api` or `epure-cli api` with `write:admin`.

Docs: https://epure.sh/docs/guides/mcp-and-cli
