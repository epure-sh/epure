# @epure-sh/cli

Manage [Epure](https://epure.sh) from a terminal or agent. Node.js 18+.

Epure is calm error tracking that keeps your Sentry SDK: change the DSN. Self-hosting is free; Cloud is on [epure.sh/pricing](https://epure.sh/pricing). This client is Apache-2.0; the engine is AGPL-3.0.

## Start

```sh
npm install -g @epure-sh/cli
epure auth login
epure projects list
epure issues list --limit 20
```

Sign in through your normal Epure browser account and approve the workspace and scopes. CLI and MCP share this OAuth session. There are **no pasted credentials, `--token` options or token environment variables**. Existing entries without an OAuth refresh credential and saved client identity require sign-in again.

On SSH/headless machines, run `epure auth login --device --no-browser` and approve the displayed URL/code from another device. Approval expires; commands never silently open a browser. For least privilege, use `--scope "read:agent"` or `--scope "read:agent write:triage"`; setup/admin actions need `write:admin` plus the appropriate workspace role. Defaults request all three scopes, shown in browser consent.

```sh
epure auth status                  # local session metadata, never credentials
epure auth whoami                  # verify session with server
epure auth logout                  # revoke grant and remove local session
epure auth login --url https://errors.example.com
epure auth instances
epure auth use https://app.epure.sh
```

Self-hosted origins require HTTPS; loopback HTTP is supported for development. `--url`/`EPURE_URL` selects an instance. Credentials live in `$XDG_CONFIG_HOME/epure/credentials.json` (default `~/.config/epure/credentials.json`), mode 0600, with atomic writes and serialized refresh rotation. Logout affects both local clients. If remote revocation is unavailable, logout reports that clearly; revoke the grant in Settings → Connected apps. The server needs the 0.2 client revocation update for remote logout.

## Everyday work

```sh
epure projects create --name "Checkout"
epure issues list --project-id PROJECT_ID --q 'status:unresolved' --limit 20
epure issues context ISSUE_ID
epure issues resolve ISSUE_ID --resolved-in-release v2.1
epure issues snooze ISSUE_ID --mode 4h
epure rules create --project-id PROJECT_ID --name "New errors" --kind issue_created
epure channels create --project-id PROJECT_ID --provider webhook --label Ops --config '{"url":"https://hooks.example.com/epure"}'
epure channels test CHANNEL_ID
epure monitors create --project-id PROJECT_ID --slug backup --schedule '0 * * * *' --timezone UTC
epure monitors update MONITOR_ID --paused true
epure monitors check-in MONITOR_ID --status ok --duration-ms 850
epure projects delete PROJECT_ID --yes
```

Run `epure RESOURCE --help`, `epure RESOURCE ACTION --help`, or `epure schema RESOURCE.ACTION` for supported flags and exact schemas. Resources include projects, issues, rules, channels, monitors, alerts, releases, members, invitations, webhooks, privacy and connected apps. `login`, `logout`, `queue`, `context`, `issue show` and `triage resolve|ignore|reopen|snooze` remain aliases.

Mutations accept individual flags or `--data '{...}'`, `--data @request.json`, and `--data -` for stdin. Unknown fields and invalid types fail before requests. Destructive actions require `--yes`, including scripts; no hidden prompts.

## Scripts and agents

Terminal output defaults to a table; redirected output defaults to JSON. Use `--json`, `--output json|table|ndjson`, and `--fields id,name` (including dotted paths). Diagnostics go to stderr, so stdout remains parseable. No automatic write retries after network failures.

```sh
epure projects list --json --fields id,name
epure schema monitors.create
epure api-catalog --search noise-policy --limit 10
epure api GET /api/v1/projects/PROJECT_ID/noise-policy
epure api PUT /api/v1/projects/PROJECT_ID/noise-policy --data @policy.json
```

The catalog has paginated REST routes and typed named actions. Advanced `api METHOD PATH --query JSON --data JSON` covers remaining supported product routes. Browser authentication, manual credential management, simulations and internal endpoints are excluded. Server scope and role checks always apply.

Exit codes: **0** success, **1** request/runtime failure, **2** usage/confirmation/cancellation, **4** sign-in required, **5** forbidden. Errors are JSON on stderr with a stable `error.code` and actionable message. Sign-in explicitly before unattended jobs; no interactive approval is attempted by a resource command.

## Development

See [research and design](https://github.com/epure-sh/epure/blob/main/docs/cli-mcp-redesign.md). Both npm packages ship identical shared runtime modules, enforced by regression tests. The Cargo `epure-cli` binary embeds and launches this same runtime, and also requires Node.js 18+.

Output channels can be shared across projects: use `project_ids` in the schema (CLI: `--project-ids '["PROJECT_A","PROJECT_B"]'`). One channel has one destination and one verification state. Single-project `project_id` remains supported.

Claude Web uses the hosted OAuth connector at `https://app.epure.sh/mcp`; it cannot run a local npm stdio server. See the [MCP setup guide](../epure-mcp/README.md).
