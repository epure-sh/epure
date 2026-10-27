# Epure Alerts System Wireframes (Stitch)

Reference exports from Stitch project **Epure Alerts System Wireframes** (`16248411599758319014`).

| File | Screen |
|------|--------|
| `01-template-selection.*` | Step 1 — template picker modal |
| `02-rules-list.*` | Rules list (Rules tab) |
| `03-scope-conditions.*` | Step 2 — scope & conditions |
| `04-output-channels.*` | Step 3 — dispatch & validate |
| `05-alert-detail.*` | History — detail pane (right column) |

Playground implementation: `src/features/alerts/` (`AlertRulesManager`, wizard rail, template picker, `AlertDetailPanel`).

Screen `808366db2ecb498a885ea4ecf00a4a6d` — full ledger mock; detail structure is the right column in `05-alert-detail.html`.

Re-fetch via Stitch MCP / API (`get_screen` with resource `name` only). Do not commit API keys.
