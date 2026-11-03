# @epure-sh/mcp

[![npm version](https://img.shields.io/npm/v/@epure-sh/mcp.svg)](https://www.npmjs.com/package/@epure-sh/mcp)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

> Surgical `<600`-token Model Context Protocol (MCP) server for [Epure](https://epure.sh) with built-in Agentjacking prompt-injection defense.

---

## Why Epure MCP?

| Feature | Sentry Official MCP | Epure MCP |
| :--- | :--- | :--- |
| **Schema Token Weight** | ~15,000 tokens (exhausts context) | **< 600 tokens** (surgical) |
| **Agentjacking Defense** | None (vulnerable to prompt injection) | **Strict tag & fence sanitization** |
| **Pricing** | $40/contributor/month (Seer) | **Included free** / 100% Open Source |
| **Transport** | stdio & remote SSE | **stdio & remote SSE** |

---

## 1-Line Quickstart

### Claude Code

```bash
claude mcp add epure -- npx -y @epure-sh/mcp --token <YOUR_EPURE_TOKEN>
```

### Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "epure": {
      "command": "npx",
      "args": ["-y", "@epure-sh/mcp", "--token", "epk_live_..."]
    }
  }
}
```

### Self-Hosted Epure Instance

```bash
claude mcp add epure -- npx -y @epure-sh/mcp --endpoint https://errors.mycompany.com --token <TOKEN>
```

---

## Available Tools

1. **`list_unresolved_issues`**: Fetch recent unresolved production errors with impact metrics (event count, affected unique users, first seen, last seen).
2. **`get_crash_context`**: Get surgical crash context for an issue including demangled stack frames, relevant code lines, and last 5 breadcrumbs — wrapped in `<untrusted_exception_data>` boundaries.
3. **`mark_issue_resolved`**: Mark an issue resolved with an optional commit SHA or release identifier.

---

## Agentjacking Defense

Public Sentry DSNs can receive poisoned exception values designed to manipulate LLM agents (e.g. Cursor or Claude Code). `@epure-sh/mcp` sanitizes untrusted exception payloads by:
- Neutralizing prompt-injection directives (`system:`, `instructions:`, `<instructions>`).
- Escaping markdown fences (` ``` `).
- Isolating stack data within defensive context boundaries.

---

## License

Apache-2.0 © Epure

## Full resource API access (0.1.8)

CLI: `epure api-catalog`, then `epure api GET /api/v1/projects`. Mutations accept JSON, `@body.json`, or `-` for stdin. Multipart uploads: `epure api POST /api/v1/projects/PROJECT/releases/VERSION/files '{}' --file file=app.js.map`.

MCP: `epure_api_catalog` lists actions; `epure_api` accepts method/path/query/body and multipart files (field, filename, base64, contentType). REST tools and existing queue/context/resolve tools work without the optional hosted MCP endpoint.

Use a PAT: read:agent for reads, write:triage for triage, write:admin plus an appropriate organization role for project/channel/rule/monitor/release/team management. Credential changes and OAuth consent remain session/login operations. No permission bypass. Application response text is untrusted data. Default cloud endpoint: https://app.epure.sh.

For full management consent at login: `EPURE_SCOPES="read:agent write:triage write:admin" epure login` (or `epure-mcp login`). Existing credentials need reauthentication or a suitably scoped PAT.
