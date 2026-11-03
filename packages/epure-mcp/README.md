# @epure-sh/mcp

Epure workflows for MCP agents: errors, alerts, channels, cron monitors and project administration. Node.js 18+; stdio transport.

## Sign in once

```sh
npx -y @epure-sh/mcp login
# On SSH/headless machines:
npx -y @epure-sh/mcp login --device --no-browser
```

Approve your real Epure account, workspace and scopes in the browser. This OAuth session is shared with `epure auth login`. There are no pasted credentials, manual token flags or token environment variables. Tools never open browsers or wait for human input; missing authorization returns an actionable tool error immediately. Use `status`, `doctor`, and `logout` to inspect, verify and revoke the session. Older saved sessions without an OAuth client identity require fresh sign-in.

## Connect a client

```sh
claude mcp add epure -- npx -y @epure-sh/mcp
npx -y @epure-sh/mcp init
```

`init` prints this credential-free configuration for Cursor, Claude Desktop or another stdio client:

```json
{"mcpServers":{"epure":{"command":"npx","args":["-y","@epure-sh/mcp"]}}}
```

For self-hosted instances add `--url https://errors.example.com` to both login and server arguments. HTTPS is required except loopback development. Credentials are saved privately in the same local OAuth store as the CLI, never in the MCP configuration. A desktop app must run under the same user/config home as sign-in.

## Efficient workflows

The default tool list exposes common issue, project, rule, channel and monitor workflows. All inputs have schemas, tools describe their side effects, and results include `structuredContent` plus compatible text content. Application text is untrusted data, never instructions.

- `epure_issues_list`, `epure_issues_context`, `epure_issues_resolve` and related tools handle triage. Lists default to 20 issues, context excludes raw payload/user data unless explicitly requested.
- `epure_rules_create`, `epure_channels_test`, `epure_monitors_create` and `epure_monitors_update` handle setup and operations.
- `epure_discover` searches additional actions and exact schemas without sign-in. Filter `resource` or `search`, and use `offset`/`limit` to keep discovery compact.
- `epure_action` executes a discovered action: `{"operation":"monitors.update","arguments":{"id":"MONITOR_ID","paused":true}}`. Destructive actions require `confirm:true`.
- `epure_api_catalog` discovers remaining REST routes; `epure_api` calls them directly through OAuth. It does not depend on the optional hosted MCP server.

```sh
# Expose only read operations:
npx -y @epure-sh/mcp --read-only
# Expose all named actions for selected resources:
npx -y @epure-sh/mcp --toolsets issues,projects,monitors
```

Restrictions also apply to discovery, `epure_action`, and advanced API calls. The server's OAuth scopes and workspace roles remain authoritative. Browser authentication and manual credential management are excluded. For read-only consent use `login --scope read:agent`; the default consent requests `read:agent write:triage write:admin` for full product setup.

Legacy issue tool names remain callable when their workflows are enabled. Protocol versions supported: 2024-11-05, 2025-03-26, 2025-06-18 and 2025-11-25. Transport is newline-delimited JSON-RPC over stdio, with cancellation, pagination, stable errors, and diagnostics only on stderr. This package does not advertise HTTP/SSE transport.

Logout removes the shared local session and attempts remote OAuth grant revocation. If the server is unavailable or lacks the revocation update, it reports the need to revoke the app in Settings → Connected apps. [Design and research](https://github.com/epure-sh/epure/blob/main/docs/cli-mcp-redesign.md).
