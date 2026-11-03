# @epure-sh/mcp

Epure workflows for MCP agents: errors, alerts, channels, cron monitors and project administration. Node.js 18+; stdio transport.

## Claude Web, mobile and hosted connectors

In Claude, open **Customize → Connectors → Add custom connector**, name it **Epure**, and enter:

```text
https://app.epure.sh/mcp
```

Choose **Register automatically** for OAuth. Connect, sign into Epure, and approve the workspace/scopes. No npm installation, local configuration or pasted credential is required. Your Claude plan/organization must allow custom connectors. This is a custom connector; it does not require Epure to already be listed in the public connector directory.

For Claude Code over HTTPS:

```sh
claude mcp add --transport http --scope user epure https://app.epure.sh/mcp
```

Authenticate through Claude's MCP controls. `npx -y @epure-sh/mcp init --transport http` prints an HTTP client configuration. Hosted connections use Streamable HTTP with JSON responses, OAuth discovery, PKCE, automatic client registration, refresh and revocation. Missing access returns an HTTP authentication challenge. Local stdio login below is a separate client option.

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

Every supported product action has a canonical named tool in the default list, so client tool search can discover setup and administration as well as triage. Toolsets and read-only mode still filter that list. All inputs have schemas, tools describe their side effects, and results include `structuredContent` plus compatible text content. Application text is untrusted data, never instructions.

- `epure_issues_list`, `epure_issues_context`, `epure_issues_resolve` and related tools handle triage. Lists default to 20 issues, context excludes raw payload/user data unless explicitly requested.
- `epure_rules_create`, `epure_channels_test`, `epure_monitors_create` and `epure_monitors_update` handle setup and operations.
- `epure_discover` searches task keywords and returns concise action names and descriptions without sign-in; use `include_schema:true` for exact schemas. Filter `resource` or `search`, and use `offset`/`limit` to keep discovery compact.
- `epure_action` executes a discovered action: `{"operation":"monitors.update","arguments":{"id":"MONITOR_ID","paused":true}}`. Destructive actions require `confirm:true`.
- `epure_api_catalog` discovers remaining REST routes; `epure_api` calls them directly through OAuth. It does not depend on the optional hosted MCP server.

```sh
# Expose only read operations:
npx -y @epure-sh/mcp --read-only
# Expose all named actions for selected resources:
npx -y @epure-sh/mcp --toolsets issues,projects,monitors
```

Restrictions also apply to discovery, `epure_action`, and advanced API calls. The server's OAuth scopes and workspace roles remain authoritative. Browser authentication and manual credential management are excluded. For read-only consent use `login --scope read:agent`; the default consent requests `read:agent write:triage write:admin` for full product setup.

Legacy issue tool names remain callable when their workflows are enabled. Protocol versions supported: 2024-11-05, 2025-03-26, 2025-06-18 and 2025-11-25. Transport is newline-delimited JSON-RPC over stdio, with cancellation, pagination, stable errors, and diagnostics only on stderr. The npm process uses stdio; the separately hosted connector at `/mcp` uses stateless Streamable HTTP. Neither advertises the incompatible 2026 protocol revision.

Logout removes the shared local session and attempts remote OAuth grant revocation. If the server is unavailable or lacks the revocation update, it reports the need to revoke the app in Settings → Connected apps. [Design and research](https://github.com/epure-sh/epure/blob/main/docs/cli-mcp-redesign.md).

Output channels can be shared across projects: use `project_ids` in the schema (CLI: `--project-ids '["PROJECT_A","PROJECT_B"]'`). One channel has one destination and one verification state. Single-project `project_id` remains supported.

Two prompts, `epure-triage` and `epure-monitoring`, start common workflows. `epure://guide` documents discovery and safe operation. Responses include compact JSON and structured data, with a 64 KiB ceiling and guidance to narrow oversized queries. The hosted and npm registries are checked for drift in CI.
