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
- **List**: Issues-parity **flat feed** inside one `epure-feed-table` well (`border-b` rows, day group headers). Checkbox + bulk bar (resolve / mute). No per-row cards or kind icons in the list — signal state as one mono lifecycle line; kind stays in detail.
- **Detail pane** (minimal ops): **sticky header** (`AlertStateBadge` · **H2** `getAlertDetailHeadline` · action row). Body **spacious** `px-6 py-6`, card stack `gap-4`, hairline `Card shadow-none`. **At a glance** — `formatAlertTimestampPrecise(fired_at)` (absolute · relative; ISO subline when ms in source) · rule kind mono `Badge` (lifecycle only in header badge). **Trigger** — `getAlertTriggerExplanation` + KV rows from `getAlertDetailStructuredFields` (threshold, ratio, env). **Impact** — fire-time users/events + velocity window stat rows (`current_window` / `previous_window`; optional window boundary timestamps from payload). **Linked issue** — issue id · release · culprit rows. **Outputs** — collapsed one-line preview (`getAlertOutputsCollapsedPreview`: channels + latest `delivered_at` relative when audit exists); expand = `dispatches[]` with `delivered_at` clock (ms when present).
- **List**: unread = weight + left rail only (no kind column). Optional v2: soft left edge by signal state. Detail pane keeps kind/tone.
- **Toolbar**: `ToggleGroup` view chips (All / Needs attention / Resolved / Muted) with counts — same rhythm as Issues stat filters.

References: PagerDuty “low urgency” styling, Grafana “Normal” state, Datadog monitor history timeline (muted greys).

## Configure

- **Table**: shadcn `Table` + row `Checkbox` + bulk bar (turn on / pause / delete).
- **Per row**: `Switch` enable; Edit via row click or menu; Create opens `Dialog` wizard.
- **Wizard** (dialog): mono step rail (`1. Template / 2. Scope / 3. Dispatch`); (1) **six starter templates** in `alert-rule-templates.ts` (no blank custom rule)—spike, new prod, prod regression, fatal, staging new, any-env regression; each prefills scope/filters/threshold, editable on step 2; (2) `AlertWizardSection` + fields, (3) channel checklist + review. Footer: one **primary**, **ghost** Cancel/Back — no outline button rows.
- **Libraries**: `@/components/ui/dialog`, `checkbox`, `switch`, `toggle-group`, `button`, `input`, `table`, `dropdown-menu`, `badge`.

## 21st.dev / blocks (research targets)

- Settings table with inline switches
- Multi-step modal / stepper forms
- Notification routing cards
- Segmented view toggles (History | Configure)

## Backend filters

`alert_rules.filters_json` stores `{ min_level?, first_seen? }`. Both are enforced on the custom-rule ingest path (`first_seen: new`, `min_level` error/fatal thresholds).

## `payload_json` contract (History)

Emit truth lives in `apps/epure/crates/server/src/lifecycle/process.rs` and `ingest.rs`. UI must not treat playground-only keys as production guarantees.

| `kind` | Required at emit | Optional / enrich later |
|--------|------------------|-------------------------|
| `velocity_spike` | `title`, `current_window`, `previous_window`, `ratio` | `environment`, `event_count` (not emitted today) |
| `regression` | `title`, `release`, `resolved_in_release` | `environment` |
| `new_issue` | `title`, `release` | |
| `event_milestone` | `title`, `threshold`, `event_count` | |
| `users_affected` | `title`, `threshold`, `unique_user_count` | |
| `custom` | `title`, `rule_id`, `rule_name`, `rule_kind`, `environment`, `threshold`, `ratio?`, `release?` | |
| `ingest_cap_hit` | `project_name`, `cap_per_hour`, `message` | |

**Playground-only** (do not assume in prod): `dispatches[]`, `culprit`, `fingerprint`, `traffic_share`, `baseline_label`, cross-kind `event_count`, `issue_ids[]`. Document extras in `playground/fixtures/seed.ts` when adding demo rows.

**Detail IA:** list secondary line = `getAlertListIssueLine`; detail **H2** = `getAlertDetailHeadline`. Structured body via `getAlertDetailStructuredFields` → five cards (At a glance · Trigger · Impact · Linked issue · Outputs). **Edit rule** = `getAlertEditableRuleId` on `custom`. History layout **~50/50** at `lg+`.

## Implementation checklist (product UI)

| Requirement | Evidence |
|---|---|
| History \| Configure toggle | `alerts-section-toggle.tsx` + `index.tsx` |
| History master–detail | `index.tsx` + `alert-detail-panel.tsx` |
| Lifecycle Firing / Fired / Resolved / Muted | `getAlertSignalState` + `alert-state-badge.tsx` |
| Flat history list + checkbox bulk | `alert-row-shell.tsx` + `alert-row.tsx` + `alerts-history-bulk-bar.tsx` |
| Configure table + Switch + bulk | `alert-rules-manager.tsx` + `alerts-rules-bulk-bar.tsx` |
| Wizard name → conditions → notify (create + edit routing step) | `alert-rules-manager.tsx` + `alert-condition-fields.tsx` + `alert-notification-fields.tsx` |
| PostHog-style condition sections | When / Scope / Filters / Threshold / Frequency / Summary |
| Calm Ledger tokens | `design/SYSTEM.md`, no alarm chrome on rows |
