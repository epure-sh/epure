# Billing lifecycle and hosted MCP

## Sources and decisions

- [Claude connector authentication](https://claude.com/docs/connectors/building/authentication): Claude Web connects from Anthropic's infrastructure. A local npm stdio configuration cannot provide a web connector. The hosted endpoint uses real HTTP 401 challenges, protected-resource discovery, OAuth PKCE, public dynamic registration. Optional Anthropic client metadata support is enabled only when its public identity endpoint is reachable (EPURE_MCP_CIMD_ENABLED=true); that endpoint currently returns 403 from the VPS, so production advertises DCR instead.
- [Claude tool search](https://code.claude.com/docs/en/mcp#tool-search-for-mcp-server-authors): server instructions identify when to use Epure, and canonical tools are individually discoverable. Generic action wrappers alone hide capabilities from client-side search.
- [Anthropic tool design](https://www.anthropic.com/research/writing-tools-for-agents): task-oriented descriptions, resource identifiers, bounded results and actionable failures. Prompts provide entry points for error triage and real monitoring setup.
- [MCP tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools): stable schemas and annotations, pagination, structured results plus compatible text. Supported protocol revisions are explicit; this implementation does not claim the incompatible 2026 revision.
- [Polar customer state](https://polar.sh/docs/integrate/customer-state), [subscription updates](https://polar.sh/docs/api-reference/2026-10/subscriptions/update-subscription), [delivery](https://polar.sh/docs/integrate/webhooks/delivery): current provider state drives access, existing subscriptions are updated rather than duplicated, and incoming events are durably queued before acknowledgement.

## Billing contract

Polar owns billing. A verified webhook is an instruction to refresh current state, never proof that an old payload is still current. The durable PostgreSQL inbox survives process restarts and releases expired claims. Processing failures retry with backoff. Per-workspace transaction locks serialize all worker/manual snapshots across replicas; one SQL transaction applies subscription records and workspace entitlements.

Every five minutes, known/checkout-started workspaces reconcile independently of webhook delivery. A daily paginated provider customer scan discovers missed bindings through exact external workspace IDs. Email/domain guesses are prohibited. Failed scans retry after five minutes. A bounded scan fails rather than applying partial data.

Pro to Scale upgrades invoice the prorated change immediately. Scale to Pro downgrades take effect next period, with a pending change displayed. Current product IDs override metadata inherited from initial checkout. Scheduled cancellation retains access until Polar revokes it. Past-due status is mirrored separately; the default recovery grace is 72 hours from Polar's past_due_at (BILLING_PAST_DUE_GRACE_HOURS, 0–168). Unknown payment timing never invents a grace deadline. OSS/canary records without an actual subscription remain intact.

`/health/billing` returns 503 for overdue webhook processing or persistently stale customers. Structured error logs identify failed background work; workspace billing status includes last sync, retry state and discrepancy counts. Monitor this endpoint along with readiness. The periodic API reconciliation remains independent of a disabled Polar webhook endpoint. Cross-service consistency is eventual: normal webhook updates take seconds, missed deliveries are repaired by reconciliation, and provider/network outages are reported rather than represented as successful sync.

## Claude Web setup

Add a custom connector with URL `https://app.epure.sh/mcp`. Choose automatic OAuth registration. Sign into Epure and approve a workspace. No npm installation or pasted credential is needed. The connector is custom: deployment alone does not submit it to Anthropic's public connector directory.

Local Claude Code/Desktop can continue using `@epure-sh/mcp`. Both clients share the canonical registry. Generate/check the hosted registry with `node scripts/generate-mcp-registry.js [--check]`; CI fails on drift. OAuth scopes and tenant roles remain authoritative; destructive operations require explicit confirmation.
