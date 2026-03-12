# Issue surface spec — data model, list row, detail tabs

**Status:** Ratified research (2026-09-13)  
**Inputs:** [FEATURES.md](../../../../business/FEATURES.md) · [charter.md](../charter.md) · [tab-debate.md](./tab-debate.md) · [issue-detail-ux-research.md](./issue-detail-ux-research.md) · [sentry-ia-borrow.md](./sentry-ia-borrow.md) · current `web/src/ui/*` + `api.ts` + `crates/storage/src/issues.rs`  
**Scope:** What an **Issue** is in Epure, how it appears in the list row, and what each detail tab contains — optimized for P1/P2/P3 without violating Phase 1 FEATURES proofs.

---

## Executive summary

An **issue** is a grouped exception bucket keyed by deterministic fingerprint. It carries **lifetime aggregates and lifecycle state** (status, snooze, merge parent, resolved-in-release). **Events** are individual occurrences with stack, breadcrumbs, and payload. The Issues home is a **master-detail** triage surface: two-line rows on the left, **Overview · Stack · Breadcrumbs · More** tabs on the right. P1 gets resolve-on-one-screen (J3); P3 gets merge, diff, export, and query syntax behind Filter and More — never as default chrome.

---

## 1. Issue data model

### 1.1 What an issue IS

| Concept | Definition |
|---------|------------|
| **Issue** | One row in `issues` per `(project_id, fingerprint)` where `merge_parent_id IS NULL`. Canonical grouping unit for triage. |
| **Event (occurrence)** | One ingested payload attached to an issue. Ordered by `occurred_at DESC`. |
| **Fingerprint** | SHA-256 of normalized exception type + top in-app frame (+ optional SDK override). Drives **Deterministic Grouping**. |
| **Merged child** | Secondary issue with `merge_parent_id` pointing at canonical parent. Hidden from default list; surfaced in More. |

### 1.2 Issue-level fields

| Field | Storage | API (`IssueSummary`) | UI role |
|-------|---------|----------------------|---------|
| `id` | UUID | `id` | Routing, merge target |
| `org_id`, `project_id` | UUID | `org_id`, `project_id` | RLS / scoping |
| `fingerprint` | TEXT | — (not exposed) | Grouping; shown in More (P3) |
| `title` | TEXT | `title` | Row line 1; Overview H2 |
| `status` | TEXT | `status` | Badge; filters (`unresolved`, `resolved`, `ignored`, `regression`) |
| `level` | TEXT | `level` | Row meta; Overview badge (`error`, `warning`, `fatal`, …) |
| `environment` | TEXT | `environment` | Row meta; Overview dl (latest-known) |
| `release` | TEXT | `release` | Row meta; Overview dl; resolve target |
| `first_seen_at` | TIMESTAMPTZ | — | More / Overview below fold |
| `last_seen_at` | TIMESTAMPTZ | `last_seen_at` | Row right meta; Overview subtitle |
| `event_count` | BIGINT | `event_count` | Row meta; Overview subtitle |
| `unique_user_count` | INT | — | More; snooze-until-users gate |
| `resolved_in_release` | TEXT | — (PATCH only) | **Release & Regression Engine** |
| `merge_parent_id` | UUID | — | Merge/split; More section |
| `snooze_until` | TIMESTAMPTZ | — | Filter `snoozed`; Overview snooze state |
| `snooze_until_count` | INT | — | Smart Snooze |
| `snooze_until_users` | INT | — | Smart Snooze |

**Lifecycle states (status enum):**

| Status | Meaning | FEATURES row |
|--------|---------|--------------|
| `unresolved` | Active; default list | Tier 4 triage |
| `resolved` | User or bulk resolved; may set `resolved_in_release` | Tier 5 **Release & Regression Engine** |
| `ignored` | Archived from triage | Tier 4 **Bulk Actions** |
| `regression` | Resolved issue recurred in release ≥ `resolved_in_release` | Tier 5 **Release & Regression Engine** |

### 1.3 Event-level fields

| Field | Storage | API (`EventDetail`) | UI role |
|-------|---------|---------------------|---------|
| `id` | UUID | `id` | Occurrence picker |
| `issue_id` | UUID | `issue_id` | Parent link |
| `occurred_at` | TIMESTAMPTZ | `occurred_at` | Occurrence picker label |
| `environment`, `release` | TEXT | same | Per-occurrence override in dl when different |
| `platform` | TEXT | `platform` | More tags |
| `runtime_name`, `runtime_version` | TEXT | same | More; export |
| `browser_name`, `os_name` | TEXT | same | More metadata |
| `user_id`, `user_email` | TEXT | same | Overview user row (selected event) |
| `payload_json` | JSONB | `payload_json` | Diff, export, raw inspect |
| `stack_frames` | JSONB | `stack_frames` | Stack tab |
| `breadcrumbs` | JSONB | `breadcrumbs` | Breadcrumbs tab |
| `country_code` | CHAR(2) | — (in payload) | More tags |

### 1.4 FEATURES.md mapping (issue object)

| FEATURES row | Tier | Issue-level | Event-level |
|--------------|------|-------------|-------------|
| **Deterministic Grouping** | 2 | `fingerprint`, `title` | frames → fingerprint input |
| **Metadata Normalization** | 2 | `environment`, `release`, `level` (rolled up on upsert) | `browser_name`, `os_name`, `runtime_*`, `country_code` |
| **Unique User Tracking** | 3 | `unique_user_count` | `user_id`, `user_email` |
| **Automated TTL & Data Pruning** | 3 | `event_count` preserved; events pruned | raw rows TTL |
| **Linear-Style Query Syntax** | 4 | list filters | — |
| **Manual Merge & Split** | 4 | `merge_parent_id` | — |
| **Bulk Actions** | 4 | multi-issue `status` | — |
| **Occurrence & Release Diff** | 4 | release list per issue | `payload_json` compare |
| **LLM Context Export** | 4 | title, status, counts | stack + breadcrumbs + tags |
| **Breadcrumb & Log Filter** | 4 | — | filter UI on event |
| **Release & Regression Engine** | 5 | `status`, `resolved_in_release` | `release` on recurrence |
| **Smart Snooze Logic** | 5 | snooze_* columns | — |
| **Velocity Spike Alerts** | 5 | alert links to `issue_id` | — |
| **User Crash Dialog API** | 5 | — | feedback linked by `event_id` (More, Phase 1b) |
| **Environment Isolation** | 6 | top-strip filter scopes list | per-event env |
| **Spike-Proof Counter Valve** | 1 | `event_count` may increment without new event body | — |

---

## 2. Issue row (list item)

### 2.1 Anatomy — two lines, one action column

**Minimum viable (P1/J1):**

```
┌─[●]─ Title (exception summary) ─────────────────── last seen ─┐
│      level · N events · env · release                          │
└──────────────────────────────────────────────────────────────┘
```

**Optimized target (P1+P2):**

| Zone | Content | Source |
|------|---------|--------|
| **Line 1 (primary)** | `title` — truncate with ellipsis at ~60ch | `issue.title` |
| **Line 1 (right)** | Relative **last seen** (`2m ago`, `Yesterday`) | `issue.last_seen_at` |
| **Line 2 (meta)** | `{level} · {event_count} events · {environment} · {release}` — omit empty segments | `formatMeta()` pattern |
| **Left accent** | 3px accent border when `status === 'unresolved'` (unread signal) | current `IssueRow` |
| **Selection** | Background `accent-muted`; checkbox column when select mode active | `IssueList` |

**Do not put on line 1:** query tokens, project name (single-project default), assignee, sparkline, priority ML badge.

### 2.2 Optional signals (when data exists)

| Signal | Placement | Rule |
|--------|-----------|------|
| **Regression badge** | Inline after title or start of line 2: `Came back` | `status === 'regression'` — plain label per tab-debate |
| **Snoozed chip** | Line 2 suffix: `snoozed` muted | Active snooze window; list filter `snoozed` |
| **Category chip** | Line 2 prefix | **Phase 1b only** when heuristics exist; never rail tab |
| **Level dot** | 6px circle before title | Alternative to spelling `error` in meta; pick one, not both |
| **Merged indicator** | `+N merged` on canonical row | When `mergedChildren.length > 0` |

### 2.3 Responsive collapse (drop columns, don't scroll)

| Viewport | Line 1 | Line 2 | Right |
|----------|--------|--------|-------|
| **Desktop (≥1024, master-detail)** | title + last seen | full meta | last seen right-aligned |
| **Tablet list pane** | title + last seen | level · N events · env | hide `release` |
| **Mobile list-only** | title | `{N} events · {relative last seen}` | merge last seen into line 2 |
| **Mobile detail** | full-screen detail; back to list | — | **done** — Back/Esc + `<lg` layout |

Row height: `--row-height` (36px) **minimum**; allow **two lines** (~44–48px total) per charter + Sentry borrow.

### 2.4 Row interactions

| Action | Trigger | Persona |
|--------|---------|---------|
| Open detail | Click row | P1 |
| Multi-select | Checkbox (hover-reveal) · `x` · Shift+click | P3 |
| Resolve / Ignore / Unresolve | Bulk bar or `e` / `i` with selection | P3 |
| Close detail | **Back to list** · `Esc` | P1/P3 |
| Navigate list | `j` / `k` | P3 |
| Focus filter | `/` | P3 |

Bulk bar (`BulkActions`) is **sticky** when 1+ selected: Resolve, Ignore, Unresolve, Merge, Delete, Clear. List header uses plain titles via `getIssuesListTitle()` (e.g. "Unresolved issues"). Z2 filter row: time window + sort selectors (`?window=`, `?sort=`).

### 2.5 Anti-patterns (from research)

| Anti-pattern | Why refused |
|--------------|-------------|
| 7-column table header on home | Fails J2; Sentry muscle memory |
| Query bar as list hero | Plain "Unresolved" chip default |
| Hover stack preview on row | Invisible to P1/touch |
| Status sub-tabs (`Unresolved / Regressed / All`) | Use stat bar + Filter presets |
| Priority / trend / assignee columns | Opaque or solo-dev irrelevant |
| Permanent keyboard legend in list header | Footer `?` toggle only |
| Showing merge checkbox without select intent | Clutters P1 scan |

---

## 3. Issue detail — per tab content inventory

**Shell:** `IssueDetailTabs` — Overview · Stack · Breadcrumbs · More. Keyboard `1`–`4`. Detail toolbar: Back + Resolve / Ignore / Snooze / Copy for AI. Reset to Overview on issue change.

**Occurrence model:** Default selected event = latest (`occurred_at DESC` first). Shared picker state across Overview stack, Breadcrumbs, More compare.

### 3.1 Overview tab — one-screen triage (J3)

**Purpose:** Answer "what broke?" and "what do I do?" without scrolling past power tools.

| Section | Above fold | Below fold | Scope | Fields |
|---------|------------|------------|-------|--------|
| **Header** | ✓ | | Issue | `title` (H2), `status` badge, `level` badge |
| **Subtitle** | ✓ | | Issue | `{event_count} events · last seen {relative}` |
| **Context grid** | ✓ | | Issue (+ event fallback) | `environment`, `release` in 2-col `dl` |
| **User** | ✓ if present | | Event (selected) | `user_email` (or `user_id`) |
| **Primary actions** | ✓ | | Issue | **Resolve**, **Ignore**, **Snooze** (menu) |
| **Top tags** | | ✓ (max 3) | Event | `platform`, `browser_name`, `os_name` as badges |
| **First seen** | | ✓ | Issue | `first_seen_at` — single muted line |
| **Regression context** | ✓ if regression | | Issue | `Came back in {release}` + `resolved_in_release` |
| **Snooze state** | ✓ if active | | Issue | Human-readable snooze until |

**Primary actions placement:** Right side of header on wide screens; full-width button row immediately under `dl` on narrow — always visible without scrolling on 768px+ viewport.

**Explicitly NOT on Overview:** diff panel, merge UI, export button, occurrence picker (lives on Stack+), full tag explorer, activity feed, keyboard hints.

**FEATURES on Overview:**

- Tier 4 triage (resolve/ignore)
- Tier 5 **Smart Snooze Logic** (primary placement per tab-debate)
- Tier 5 **Release & Regression Engine** (badge + copy)
- Tier 2 metadata (env/release/user)

### 3.2 Stack tab — debug hero

| Section | Above fold | Below fold | Scope | Fields |
|---------|------------|------------|-------|--------|
| **Occurrence picker** | ✓ | | Event | Buttons: latest + up to 5 recent timestamps; "View all" → More |
| **Stack trace** | ✓ | | Event | `stack_frames[]`: `function`, `filename`, `lineno`, `colno`, `context_line`, `in_app` |
| **Frame actions** | | ✓ | Event | Copy frame; link to source file when demangled |
| **Vendor collapse** | ✓ | | Event | Collapse `in_app === false` frames behind "Show N vendor frames" |
| **Grouping hint** | | ✓ | Issue | One line: "Grouped by {top in-app frame}" → link More |

**Presentation:** `CodeBlock` with fault highlight on first `in_app` frame. Demangled paths from **JS/TS Sourcemap Demangler**.

**FEATURES:** Tier 2 demangler, Tier 2 grouping transparency (hint only).

### 3.3 Breadcrumbs tab — context trail

| Section | Above fold | Below fold | Scope | Fields |
|---------|------------|------------|-------|--------|
| **Occurrence picker** | ✓ | | Event | Same control as Stack (shared state) |
| **Filter bar** | ✓ | | Event | `[All] [HTTP] [Console] [Errors]` |
| **Search** | ✓ (P3) | | Event | Regex/substring across `message` |
| **Timeline preview** | ✓ | | Event | Last **10** crumbs inline |
| **View all drawer** | | ✓ | Event | Full list + filters + search (no nested scroll in main pane) |

**Crumb row:** `[{category}/{level}] {message}` mono, timestamp optional muted prefix.

**FEATURES:** Tier 2 **Breadcrumb Trail Extractor**, Tier 4 **Breadcrumb & Log Filter**.

**P1 default:** filters visible (plain labels); regex search collapsed behind "Search" affordance until focus.

### 3.4 More tab — power depth (P3)

| Section | Order | Scope | Fields / widgets |
|---------|-------|-------|------------------|
| **Export** | 1 | Issue + event | **LLM Context Export** button + `⌘⇧C` hint |
| **Compare** | 2 | Event | Occurrence diff picker + `DiffPanel` (occurrence + release modes) |
| **Snooze** | 3 | Issue | Alternate entry (duplicate Overview OK) |
| **Tags & runtime** | 4 | Event | Full tag grid: platform, runtime, browser, OS, country |
| **Contexts / HTTP** | 5 | Event | `payload_json` slices: request, headers, extra |
| **All occurrences** | 6 | Event | Scrollable list with timestamp + env + release; click sets global selection |
| **Grouping** | 7 | Issue | Fingerprint (read-only), custom fingerprint flag |
| **Merge** | 8 | Issue | Merged children list + **Split**; link to list merge flow |
| **Activity** | 9 | Issue | Status changes, regression fired, alert history links |
| **User feedback** | 10 | Event | Linked feedback from **User Crash Dialog API** (when present) |

**FEATURES concentrated here:** Tier 4 **Occurrence & Release Diff**, **LLM Context Export**, merge context; Tier 5 feedback.

---

## 4. Forms & layout patterns

### 4.1 Master-detail vs full-page

| Surface | Layout | Breakpoint |
|---------|--------|------------|
| **Issues home (desktop)** | Master-detail: fixed-width list (`w-issue-list`) + flexible detail | ≥1024px |
| **Issues home (mobile)** | List full-screen → tap row → full-screen detail with back | <1024px |
| **Setup** | Separate `/setup` route; checklist compact on Issues until J1 complete | all |

**Never:** separate "focus mode" chrome; same shell rail + top strip everywhere.

### 4.2 Component pattern guide

| Pattern | Use when | Issue surfaces |
|---------|----------|----------------|
| **`dl` 2-column grid** | 2–6 stable key-value pairs | Overview env/release/user |
| **Badges** | Enumerated status/level/env | Overview header, regression row |
| **`CodeBlock`** | Stack frames, monospace stack | Stack tab |
| **Button row** | 2–4 primary triage actions | Overview Resolve/Ignore/Snooze |
| **Filter chips + panel** | List segmentation | Issues home (not detail) |
| **Tabs** | Mutually exclusive detail views | Issue detail |
| **Drawer** | Deep inspect without nested scroll | Breadcrumbs "View all" |
| **Popover / menu** | Snooze durations, overflow actions | SnoozeMenu |
| **Select mode bar** | Bulk/merge | Below issue list |
| **Toast** | Confirm copy/export/snooze | Ephemeral feedback |

### 4.3 Occurrence picker placement

| Location | Control | Rationale |
|----------|---------|-----------|
| **Stack + Breadcrumbs** | Compact button group (latest + N recent) | Event-scoped tabs need explicit scope |
| **Overview** | None — implicit latest for user/env | J3 simplicity |
| **More** | Full occurrence list + diff selectors | P3 compare workflow |

**Labels:** `Occurrence` label + locale timestamp buttons. Recommended default = latest. Optional `Oldest` in More only.

### 4.4 Progressive disclosure rules

1. **Plain surface, syntax behind doors** — `is:unresolved` lives in Filter, not stat labels.
2. **Tabs gate depth** — no scroll-all detail; Overview fits one screen.
3. **Drawers for long event data** — breadcrumbs, raw JSON; never triple-nested scroll.
4. **Select mode gates bulk** — checkboxes/merge bar appear only after `x` or explicit bulk intent.
5. **Power shortcuts discoverable, not promoted** — `?` footer, `⌘K` palette; no permanent cheat sheet (charter).
6. **Regression/snooze as copy + badge** — not filter-syntax on row.
7. **Export/diff/merge never on Overview** — More tab or palette only.

---

## 5. FEATURES.md compliance matrix (Tier 4–6, issue UX)

| FEATURES row | Tier | Where in issue UI | Proof / Journey | Gap in current code |
|--------------|------|-------------------|-----------------|----------------------|
| **Keyboard-First Navigation** | 4 | List `j/k/e/i/x//`; tabs `1–4`; `⌘⇧C` export | J4 | ✓ Implemented; footer hints exist (toggle OK) |
| **LLM Context Export** | 4 | More -> Export; hotkey | J4 | ✓ `export-markdown.ts` |
| **Occurrence & Release Diff** | 4 | More -> Compare + `DiffPanel` | J4 | ✓; release mode works; not discoverable from Overview (intentional) |
| **Linear-Style Query Syntax** | 4 | Filter panel on list | J4 | ✓ `FilterPanel` + `query-utils` |
| **Breadcrumb & Log Filter** | 4 | Breadcrumbs tab filters + search | J4 | ✓; drawer for "view all" **missing** |
| **Manual Merge & Split** | 4 | List `MergeActions` + More merge section | J4 | ✓ list; More lacks merge section |
| **Bulk Actions** | 4 | List `BulkActions` bar | J4 | ✓ |
| **Release & Regression Engine** | 5 | Overview regression copy; stat bar Regressions filter | J2/J3 | Partial — `status` not in `IssueSummary` API for regression badge on row; `resolved_in_release` not shown |
| **Smart Snooze Logic** | 5 | Overview SnoozeMenu (+ More duplicate) | J4 | ✓; snooze state not surfaced on Overview when active |
| **Velocity Spike Alerts** | 5 | Alerts rail -> issue link; optional More activity | — | No in-issue spike indicator on row |
| **Outbound Webhooks** | 5 | Settings only; Alerts tab read surface | — | N/A on issue surface |
| **User Crash Dialog API** | 5 | More -> User feedback section | — | **Not implemented** in UI |
| **Environment Isolation** | 6 | Top strip scopes list + stats | J2 | ✓ `buildQuery` |
| **Multi-Project Management** | 6 | Rail + project label | J1 | ✓ |
| **Team Management (RBAC Lite)** | 6 | Settings/org rail | — | N/A on issue surface |

**Tier 1–3 rows visible on issue surfaces:**

| FEATURES row | Where | Gap |
|--------------|-------|-----|
| **Deterministic Grouping** | title, More grouping | Fingerprint not exposed in UI |
| **JS/TS Sourcemap Demangler** | Stack tab | ✓; vendor collapse **missing** |
| **Breadcrumb Trail Extractor** | Breadcrumbs tab | ✓ |
| **Metadata Normalization** | row meta, Overview dl, More tags | `unique_user_count` not shown |
| **Unique User Tracking** | row/More | **Not shown** — only event_count on row |
| **Spike-Proof Counter Valve** | — | Invisible (correct); count may diverge from stored events |

---

## 6. Optimization principles

1. **Two-line scan beats wide tables** — title + last seen on line 1, muted context on line 2; optimize for J2 five-second comprehension (P1).
2. **Issue-level vs event-level discipline** — lifetime counts and status on Overview; stack/crumbs/payload only after tab switch or occurrence pick (P2 familiarity without scroll-all).
3. **Resolve above the fold** — Overview must satisfy J3 on laptop viewports without encountering diff, merge, or export.
4. **Density with calm** — 36–48px rows, mono only for paths/ids, badges only for status/level/regression.
5. **Power behind doors** — Filter (list), More (detail), `⌘K` (global); query syntax validates P3 without teaching tokens to P1.
6. **Drop columns, never horizontal-scroll** — responsive list meta truncation before adding column picker.
7. **Refuse forbidden surfaces on issue UI** — no replay, traces, profiling, logs product, session viewers, assignee/priority ML, event graphs on detail, or category sidebars.

---

## 7. Wireframes (ASCII)

### 7.1 Issues home (desktop master-detail)

```
┌─ Rail ─┬─ Top strip: [production ▾]  my-app  ⌘K  user ─────────────────────────┐
│ Issues │ StatBar:  Unresolved 12  ·  Events (7d) 1.4k  ·  Regressions 2        │
│ Release│ Filter: [Unresolved ✓] [Came back]              [ Filter ▾ ]          │
│ Alerts ├──────────────────────────┬───────────────────────────────────────────┤
│ Setting│ ● TypeError: undefined   │ Overview │ Stack │ Breadcrumbs │ More    │
│        │   error · 48 events · pr │───────────────────────────────────────────│
│        │   2m ago                 │ TypeError: Cannot read 'id' of undefined  │
│        ├──────────────────────────│ 48 events · last seen 2m ago   [unresolved]│
│        │   PaymentError: timeout  │ Environment production    Release v1.4.2 │
│        │   warning · 3 · prod     │ [Resolve] [Ignore] [Snooze ▾]             │
│        │   1h ago                 │                                           │
│        │                          │                                           │
│        │                          ├───────────────────────────────────────────│
│        │                          │ Keyboard shortcuts (?)                    │
└────────┴──────────────────────────┴───────────────────────────────────────────┘
```

### 7.2 Issue row — states

```
Default (unresolved):
┌■┬───────────────────────────────────────────────────────────────┬──────────┐
 │ │ TypeError: Cannot read properties of undefined (reading 'id') │   2m ago │
 │ │ error · 48 events · production · v1.4.2                       │          │
 └─┴───────────────────────────────────────────────────────────────┴──────────┘
  ▲ 3px accent = unread/unresolved

Regression:
┌─┬───────────────────────────────────────────────────────────────┬──────────┐
 │ │ TypeError: Cannot read properties of undefined (reading 'id') │   2m ago │
 │ │ Came back · error · 48 events · production                    │          │
 └─┴───────────────────────────────────────────────────────────────┴──────────┘

Select mode:
┌✓┬──────────────────────────────────────────────────────────────┬──────────┐
  │ │ PaymentError: gateway timeout                                 │   1h ago │
  │ │ warning · 3 events · production                               │          │
  └─┴───────────────────────────────────────────────────────────────┴──────────┘
┌─ Merge 2 selected ──────────────────────────────────────────────────────────┐
│ [Merge into selected]  [Split...]     [Resolve] [Ignore] [Delete]             │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Overview tab

```
┌─ Overview ──────────────────────────────────────────────────────────────────┐
│ TypeError: Cannot read properties of undefined (reading 'id')    [unresolved] │
│                                                               [error]       │
│ 48 events · last seen Sep 13, 12:38                                           │
├───────────────────────────────────────────────────────────────────────────────┤
│ Environment          Release                                                   │
│ production           v1.4.2                                                    │
│ User                                                                             │
│ user@example.com                                                                 │
├───────────────────────────────────────────────────────────────────────────────┤
│ [ Resolve ]  [ Ignore ]  [ Snooze ▾ ]                                         │
├───────────────────────────────────────────────────────────────────────────────┤
│ chrome · Safari 18 · macOS          (below fold — top tags, max 3)           │
│ First seen Sep 10, 09:12                                                       │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 7.4 Stack tab

```
┌─ Stack ─────────────────────────────────────────────────────────────────────┐
│ Occurrence  [Sep 13 12:38 ✓] [Sep 13 11:02] [Sep 12 18:44]  View all →    │
├───────────────────────────────────────────────────────────────────────────────┤
│ ▶ checkout.ts:142  processPayment                                           │ ← fault (in_app)
│     const id = user.id;                                                      │
│   node_modules/stripe/...  (4 vendor frames collapsed)                     │
│   app.tsx:88  onCheckoutClick                                                │
├───────────────────────────────────────────────────────────────────────────────┤
│ Grouped by checkout.ts · processPayment                          → More      │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 7.5 Breadcrumbs tab

```
┌─ Breadcrumbs ───────────────────────────────────────────────────────────────┐
│ Occurrence  [Sep 13 12:38 ✓] [Sep 13 11:02]                                 │
│ [All ✓] [HTTP] [Console] [Errors]                      [ Search... ]       │
├───────────────────────────────────────────────────────────────────────────────┤
│ [navigation/info]     route -> /checkout                                       │
│ [ui.click/info]       clicked #pay-button                                    │
│ [fetch/info]          POST /api/pay 502                                      │
│ [console/error]       Payment failed                                         │
│ ...                                                                          │
│ [ View all 24 breadcrumbs → ]                                                │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 7.6 More tab

```
┌─ More ──────────────────────────────────────────────────────────────────────┐
│ Export                                                                       │
│ [ Copy markdown for LLM ]  ⌘⇧C                                             │
├───────────────────────────────────────────────────────────────────────────────┤
│ Compare                                                                      │
│ Diff with  [Sep 13 11:02] [Sep 12 18:44]    Mode: Occurrence | Release      │
│ ┌ key ──────────────── left ─────────── right ─────────────────────────┐  │
│ │ request.url          /api/pay v1      /api/pay v2                     │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
├───────────────────────────────────────────────────────────────────────────────┤
│ Tags   platform:javascript  runtime:node@22  browser:Chrome 121             │
├───────────────────────────────────────────────────────────────────────────────┤
│ All occurrences (48)                                                         │
│ · Sep 13 12:38  production  v1.4.2                                         │
│ · Sep 13 11:02  production  v1.4.1                                         │
├───────────────────────────────────────────────────────────────────────────────┤
│ Grouping   fingerprint sha256:abc…  (read-only)                              │
│ Merged issues (2)  [ Split selected ]                                        │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Open questions

| # | Question | Recommendation |
|---|----------|----------------|
| OQ1 | Rename **More** → **Details** / **Context**? | User-test; keep **More** for overflow signal until P1 J1–J3 pass |
| OQ2 | Show `unique_user_count` on row line 2? | **Yes** as `· 12 users` when >1; clarifies **Unique User Tracking** |
| OQ3 | Regression label: **Regressions** (stat) vs **Came back** (row)? | Stat bar clickable **Regressions**; row badge plain **Came back** |
| OQ4 | Expose `fingerprint` to users? | More tab only (P3); never row |
| OQ5 | Overview top tags — 3 cap? | Yes; full grid in More |
| OQ6 | Snooze on both Overview and More? | Yes; Overview primary per tab-debate |
| OQ7 | Category chips (Auth/UI/Payments)? | Phase 1b after seed heuristics; filter chip only |
| OQ8 | Extend `IssueSummary` API with `status`, `first_seen_at`, `unique_user_count`, snooze flags? | **Yes** — avoids extra round-trips for row badges |

---

## 9. Recommended implementation slices

Ordered to close gaps without IA change. Each slice should keep J1–J4 green.

### Slice A — Row v2 (P1/P2 scan)

- [x] Two-line `IssueRow`: title + relative last seen on line 1; meta on line 2 *(D9)*
- [x] `Came back` badge when `status === 'regression'` *(D9)*
- [x] Extend `IssueSummary` + API with `unique_user_count` *(D9 — M1)*
- [ ] Extend `IssueSummary` with `first_seen_at`, snooze/active flags *(deferred)*
- [ ] Responsive meta truncation (drop release on narrow list pane)
- **Proof:** J2 five-second scan with fresh user

### Slice B — Overview polish (J3)

*Superseded detail plan: [issue-detail-ux-research.md](./issue-detail-ux-research.md) slices I1–I8.*

- [x] **I1** Impact strip: occurrences, users affected, relative first/last seen
- [x] **I2** Header-right actions (Resolve/Ignore/Snooze/Copy for AI) — overlaps L3
- [x] **I3** Last 5 occurrences list on Overview
- [x] **I4/I5** Timeline text strip + smooth SVG line chart (detail only; hover time + count)
- [x] **I6** Copy for AI on Overview + prompt-wrapped clipboard
- [x] **I7** API: `first_seen_at`, snooze flags, `resolved_in_release`
- [x] **I8** Snooze banner, top 3 tags, richer regression copy
- [x] Regression copy on Overview when `status === 'regression'` *(partial — release only)*
- [x] Issues home regression text strip when `regressions > 0` *(M3 partial)*
- **Proof:** J3 without scrolling on 768px viewport

### Slice C — Stack + Breadcrumbs depth

- [x] Vendor frame collapse on Stack
- [x] Grouping one-liner with link to More
- [x] Breadcrumbs: inline cap 10 + drawer for full list (fix nested scroll)
- [x] P1: collapse regex search until expand
- **Proof:** Tier 2 demangler + Tier 4 breadcrumb filter demos

### Slice D — More completeness (P3)

- [x] Tags/runtime section from `EventDetail`
- [x] All occurrences list (scrollable)
- [x] Grouping fingerprint read-only
- [x] Merge section (children + split) relocated from list-only
- [x] User feedback block when API returns data
- **Proof:** J4 merge/export/diff unchanged + grouping visible

### Slice E — API + row signals

- [x] `IssueSummary.status` drives regression badge; `snoozed` chip on row line 2
- [x] Optional `users` in row meta: `48 events · 12 users` *(D9)*
- [x] Filter presets: **Came back**, **Snoozed** chips — shipped ([tab debate UX](8426625d-4c8a-46f5-af71-90052f443ed3))
- [x] Clickable Regressions stat — shipped (same)
- **Proof:** Clickable Regressions stat + chip filters

### Slice F — Mobile detail

- [x] Full-screen detail with back chevron
- [x] Overview + Stack primary tabs; Breadcrumbs/More in overflow menu
- [x] Bulk/merge desktop-only (`lg+`); per-issue triage actions remain on mobile back row
- **Proof:** Charter mobile table

---

## Appendix — current component map

| Spec zone | Component | File |
|-----------|-----------|------|
| List row | `IssueRow` | `web/src/ui/issue-row.tsx` |
| List meta | `formatMeta` in `IssueList` | `web/src/features/issues/issue-list.tsx` |
| Detail shell | `IssueDetailTabs` | `web/src/ui/issue-detail-tabs.tsx` |
| Overview | `IssueOverviewPanel` | `web/src/ui/issue-overview-panel.tsx` |
| Stack | `StackTracePanel` | `web/src/ui/stack-trace-panel.tsx` |
| Breadcrumbs | `BreadcrumbTimeline` | `web/src/ui/breadcrumb-timeline.tsx` |
| More shell | `MorePanel` | `web/src/ui/more-panel.tsx` |
| Page orchestration | `IssuesPage` | `web/src/features/issues/index.tsx` |
| Types | `IssueSummary`, `EventDetail` | `web/src/lib/api.ts` |
| Storage | `IssueSummary`, lifecycle | `crates/storage/src/issues.rs` |

---

*Ratify in `/speckit-specify` pass; update `design/DASHBOARD.md` when implementation slices land.*
