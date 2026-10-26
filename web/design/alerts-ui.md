# Alerts UI — Calm Ledger

Product patterns for **History** (anti-fatigue feed) and **Configure** (rules).

## Modes

| Mode | Job |
|---|---|
| **History** | Review what fired; acknowledge or mute without alarm chrome |
| **Configure** | CRUD rules, templates, enable/disable, bulk ops |

Primary control: segmented toggle (`AlertsSectionToggle`) in page header — not separate nav links.

## History — anti-fatigue

Borrow from Issues **master–detail**, not Sentry’s red stack:

- **Lifecycle** (not severity paint): `Firing` → `Fired` → `Resolved` (acknowledged) → `Muted`. Semantic danger only for copy about the underlying exception, not row chrome.
- **List**: spaced **cards** with checkbox selection + bulk bar (resolve / mute). State tone: soft left edge (firing = accent), kind icon in a calm tile, no inline action clutter — actions in detail pane or bulk bar.
- **Detail pane**: compact ops header (state + priority + fired time), **rule name** as primary title (`text-base`), impact strip (events / users / priority), correlated issue links, output channels, summary, actions (primary + ghost only).
- **List**: no kind icon tiles — lifecycle left edge + checkbox + type; unread = weight only.
- **Toolbar**: `ToggleGroup` view chips (All / Needs attention / Resolved / Muted) with counts — same rhythm as Issues stat filters.

References: PagerDuty “low urgency” styling, Grafana “Normal” state, Datadog monitor history timeline (muted greys).

## Configure

- **Table**: shadcn `Table` + row `Checkbox` + bulk bar (turn on / pause / delete).
- **Per row**: `Switch` enable; Edit via row click or menu; Create opens `Dialog` wizard.
- **Wizard** (PostHog-style): stepper UI; (1) name + template grid, (2) When / Scope / Filters / Threshold / Frequency / Summary, (3) Delivery block + channels link.
- **Libraries**: `@/components/ui/dialog`, `checkbox`, `switch`, `toggle-group`, `button`, `input`, `table`, `dropdown-menu`, `badge`.

## 21st.dev / blocks (research targets)

- Settings table with inline switches
- Multi-step modal / stepper forms
- Notification routing cards
- Segmented view toggles (History | Configure)

## Backend filters

`alert_rules.filters_json` stores `{ min_level?, first_seen? }`. Both are enforced on the custom-rule ingest path (`first_seen: new`, `min_level` error/fatal thresholds).

## Implementation checklist (product UI)

| Requirement | Evidence |
|---|---|
| History \| Configure toggle | `alerts-section-toggle.tsx` + `index.tsx` |
| History master–detail | `index.tsx` + `alert-detail-panel.tsx` |
| Lifecycle Firing / Fired / Resolved / Muted | `getAlertSignalState` + `alert-state-badge.tsx` |
| Calm history cards + checkbox bulk | `alert-row.tsx` + `alerts-history-bulk-bar.tsx` |
| Configure table + Switch + bulk | `alert-rules-manager.tsx` |
| Wizard name → conditions → notify | `alert-wizard-steps.tsx` + `alert-condition-fields.tsx` + `alert-notification-fields.tsx` |
| PostHog-style condition sections | When / Scope / Filters / Threshold / Frequency / Summary |
| Calm Ledger tokens | `design/SYSTEM.md`, no alarm chrome on rows |
