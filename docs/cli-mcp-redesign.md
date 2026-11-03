# OAuth-only CLI and MCP redesign

## Research and decisions

These are reference implementations and standards, not an unsupported ranking of “best” tools.

- [GitHub CLI formatting](https://cli.github.com/manual/gh_help_formatting) and [exit codes](https://cli.github.com/manual/gh_help_exit-codes): predictable JSON/field selection and meaningful automation status. Epure will use readable terminal output, explicit JSON/NDJSON, bounded lists, and stable error codes.
- [CLI Guidelines](https://clig.dev/): short contextual help, stderr diagnostics, composable stdin/stdout, clear remediation, and no unexpected interactive prompts in scripts.
- [Stripe CLI](https://docs.stripe.com/cli) and [login](https://docs.stripe.com/cli/login): resource-oriented commands and browser approval. Login, account inspection and logout should be a coherent workflow, with credentials handled internally.
- [GitHub MCP server](https://github.com/github/github-mcp-server): toolsets and task-specific discovery. Expose common workflows as named tools; advanced discovery is filtered rather than dumping the entire API into every prompt.
- [MCP tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools): validated schemas, structured results, tool error reporting and read/write/destructive annotations. Retain existing tool aliases where compatible. Support established stdio protocol versions explicitly; do not claim support for a newer incompatible revision without implementing it.
- [MCP authorization](https://modelcontextprotocol.io/specification/latest/basic/authorization): HTTP OAuth and local stdio credential acquisition are different transport concerns. This stdio client shares the CLI's locally saved OAuth session; tools never open a browser or ask for pasted credentials.
- [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252) and [RFC 8628](https://www.rfc-editor.org/rfc/rfc8628): PKCE browser login and device authorization, including cancellation, expiry and slow-down handling.

## Product contract

OAuth only means no PAT/project-key login flags, secret arguments, token environment overrides, or token copy/paste instructions. OAuth access/refresh credentials remain necessary internally and are never printed. Old entries without a refresh credential require sign-in again. OAuth sessions with a saved client identity are retained. Older entries without that identity require fresh consent, so logout cannot claim to revoke the wrong grant.

`epure auth login` signs in once for both clients. Browser PKCE is the desktop path; `--device` supports SSH and explicit headless approval. Ordinary commands and MCP calls fail immediately with an actionable authentication error rather than silently starting login. Session files are private, written atomically, and refreshed before expiry. Failed refresh never falls back to an expired credential. Logout clears local credentials and attempts remote revocation.

The CLI gets named resource commands for projects, issues/triage, alert rules, channels, cron monitors, releases, team and privacy. Common flags cover normal work; JSON/stdin/file upload remain available for advanced operations. Help and schema discovery work without login. Reads have bounded output; destructive actions require explicit confirmation. No prompts, colors or progress text contaminate machine stdout.

MCP provides named issue/workflow tools, compact structured output, schema discovery and an authenticated advanced API action. Read-only mode and toolset filtering constrain exposed tools. Inputs are validated before network calls; application content remains untrusted data. Authorization errors include a login/remediation command. Discovery is available while signed out.

Manual token creation and internal sales/canary endpoints are outside the OAuth client surface. Account passwords and consent are handled through the normal browser authorization flow, not a general API bypass. Product role and scope checks remain authoritative.

## Implementation sequence and acceptance

1. Replace duplicated auth/transport behavior with synchronized shared runtime modules packaged in both npm clients.
2. Add the resource/action registry and generate CLI help, schemas and MCP definitions from it.
3. Implement the human CLI and noninteractive output/error contract; preserve useful command aliases.
4. Replace remote-MCP proxying with direct authenticated resource workflows and protocol-clean stdio.
5. Verify browser PKCE/state, device pending/slow-down/denial/expiry, refresh rotation/concurrency, logout, no-secret output, resource commands, typed MCP errors and npm archives. Use isolated fixtures for deterministic negative cases and one real OAuth smoke where available.
6. Run full relevant integration checks, push a PR, monitor CI and fix failures before merging. npm publication remains manual. Version 0.2.0 communicates the intentional removal of manual-token setup.

Native Cargo installations now launch the identical embedded Node runtime (Node.js 18+ required), so they cannot retain an independent manual-token login path.
