# Issue detail UX — research spec

**Status:** Research (2026-09-13)  
**Inputs:** [issue-surface-spec.md](./issue-surface-spec.md) · [metrics-layout-verdict.md](./metrics-layout-verdict.md) · [charter.md](../charter.md) · [journeys.md](../journeys.md) · [plausible-patterns.md](./plausible-patterns.md) · [sentry-ia-borrow.md](./sentry-ia-borrow.md) · [peers-small-monitoring.md](./peers-small-monitoring.md) · current `web/src/ui/issue-overview-panel.tsx` · `crates/storage`  
**Scope:** How to make issue **Overview** and adjacent detail surfaces "way better" for Epure ICP — research only; no UI implementation in this pass.

---

## 1. Executive summary

For Epure's ICP — **solo devs, small SaaS teams, and Sentry migrants who want calm triage** — "way better" issue detail means:

1. **Answer the five triage questions above the fold** without opening Stack or More: *What broke? How often? Who is hit? When did it last happen? What do I do?*
2. **Show impact as plain numbers**, not analytics chrome: event count, unique users, relative last seen — not a dashboard graph competing with resolve.
3. **Surface recent occurrences on Overview** so P2 migrants get Sentry-like context without an event graph or scroll-all detail page.
4. **Put actions where eyes land** — Resolve / Ignore / Snooze / **Copy for AI** in the header-right cluster on wide viewports (L3 layout slice), not buried under metadata.
5. **Ask AI = clipboard handoff**, not an LLM integration: enriched markdown + a pre-filled "help me fix this" prompt per **LLM Context Export** (FEATURES Tier 4). Zero external API in Phase 1.

The target Overview reads like a **Plausible stat row + ranked occurrence list + one action strip** — familiar to Sentry migrants on *content*, calm on *chrome*. Depth stays in Stack · Breadcrumbs · More; IA unchanged.

---

## 2. Current state audit

### 2.1 What Overview shows today

| Zone | Shipped (`IssueOverviewPanel`) | Spec target (`issue-surface-spec` §3.1) |
|------|--------------------------------|----------------------------------------|
| **Title** | H2 `issue.title` | ✓ |
| **Subtitle** | `{event_count} events · last seen {localeString}` | Partial — absolute timestamp, not relative; no unique users |
| **Badges** | `status`, `level` — right of title block | ✓ — but actions not co-located |
| **Context grid** | env, release, user (latest event email only) | Partial — user only if email; no `user_id` fallback label |
| **Regression** | Text strip when `status === 'regression'` | Partial — no `resolved_in_release` (not on `IssueSummary` API) |
| **Primary actions** | Resolve, Ignore, Snooze — **below** `dl`, full-width row | **Gap** — spec + L3: header-right on ≥768px |
| **Top tags** | Missing | Gap — platform/browser/os (max 3) below fold |
| **First seen** | Missing | Gap — needs `first_seen_at` on API |
| **Snooze state** | Missing | Gap — snooze flags not on `IssueSummary` |
| **Last occurrences** | Missing | Gap — only occurrence picker on Stack/Breadcrumbs |
| **Occurrence timeline** | Missing | Gap — no chart or text strip |
| **Ask AI** | Missing on Overview | Gap — only in More + `⌘⇧C` |

### 2.2 What adjacent tabs provide

| Surface | Shipped | Gap |
|---------|---------|-----|
| **Stack** | Occurrence buttons (all fetched events, up to API limit 50), `CodeBlock` stack | No vendor collapse; no grouping hint; no "View all" cap |
| **Breadcrumbs** | Shared occurrence picker + inline timeline | Drawer for "view all" missing |
| **More** | Export, Snooze duplicate, Diff | No tags grid, no all-occurrences list, no merge section, no fingerprint |
| **Page chrome** | Permanent `KeyboardHintsFooter` under detail | L3: collapse to `?` toggle |

### 2.3 Data & API today

| Field / capability | Storage | `IssueSummary` API | `EventDetail` API | UI usage |
|--------------------|---------|-------------------|-------------------|----------|
| `event_count` | ✓ | ✓ | — | Row, Overview subtitle |
| `unique_user_count` | ✓ (`issue_unique_users` table) | ✓ | — | Row meta when >1; **not Overview** |
| `last_seen_at` | ✓ | ✓ | — | Row (relative); Overview (absolute) |
| `first_seen_at` | ✓ (`issues.first_seen_at`) | ✗ | — | Not shown |
| `resolved_in_release` | ✓ | ✗ (PATCH only) | — | Regression copy incomplete |
| Snooze fields | ✓ | ✗ | — | Not shown on Overview |
| Events list | ✓ (`events` partitioned, `occurred_at DESC` index) | ✓ `GET …/events?limit=` (default 50, max 200) | ✓ | Stack/Breadcrumbs picker only |
| **Events over time (bucketed)** | ✗ query | ✗ endpoint | — | **Does not exist** |
| LLM export | — | — | payload in events | More only; markdown without prompt wrapper |

**Storage note:** Raw events are TTL-pruned; `issues.event_count` may exceed stored event rows (**Spike-Proof Counter Valve**). Timeline and "last N occurrences" must label when counts diverge (e.g. "48 events · showing last 12 stored").

---

## 3. Information hierarchy

Recommended Overview zones (top → bottom). Fits J3 one-screen triage on 768px+ laptop without scrolling past actions.

```
┌─ Z1 Header band ─────────────────────────────────────────────────────────────┐
│  [Title — exception summary]                    [Resolve][Ignore][Snooze▾]   │
│                                                  [Copy for AI]  (secondary)   │
│  [status] [level] [Came back] (conditional)                                   │
├─ Z2 Impact strip (scalar metrics, one line) ────────────────────────────────┤
│  48 occurrences · 12 users affected · last seen 2m ago · first seen 4d ago    │
├─ Z3 Context grid (2-col dl) ─────────────────────────────────────────────────┤
│  Environment          Release                                                 │
│  production           v1.4.2                                                  │
│  Latest user          user@example.com  (or user id, or "—")                  │
├─ Z4 When it happened (timeline — see §4) ────────────────────────────────────┤
│  [CSS histogram | text strip | collapsed if single occurrence]                │
├─ Z5 Last occurrences (N=5 default) ──────────────────────────────────────────┤
│  · 2m ago   user@…   production   v1.4.2   [→ Stack]                         │
│  · 1h ago   —         production   v1.4.1                                    │
│  …                                                                            │
│  View all 48 → More tab                                                       │
├─ Z6 Conditional strips ──────────────────────────────────────────────────────┤
│  Snooze until … | Regression resolved in v1.2.0, came back in v1.4.2         │
├─ Z7 Below fold ──────────────────────────────────────────────────────────────┤
│  Top tags (max 3): javascript · Chrome · macOS                                │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Zone rules

| Metric | Issue-level vs event-level | Plain label (P1) |
|--------|---------------------------|------------------|
| Title | Issue | Exception summary (grouped) |
| Occurrence count | Issue (`event_count`) | **48 occurrences** — prefer "occurrences" in detail, "events" on list (charter: "Occurrence" in detail only) |
| Users affected | Issue (`unique_user_count`) | **12 users affected** — always show when ≥1; omit "0 users" |
| Last seen | Issue | Relative (`2m ago`) via `formatRelativeTime` |
| First seen | Issue | Relative or short date |
| Environment / release | Issue rollup; per-occurrence override in list rows | Mono values in `dl` |
| User | Selected occurrence (default latest) | Latest user — not lifetime unique set |
| Last occurrences | Event rows | Timestamp + user + env + release |

**Responsive:** On `<768px`, action row stacks under subtitle; metrics strip wraps; last-occurrences table becomes single-column list.

---

## 4. Occurrence timeline / mini-graph policy

### 4.1 Peer research

| Product | Detail timeline pattern | Epure takeaway |
|---------|------------------------|----------------|
| **Sentry** (streamline detail) | Event volume graph + release markers + event search; toggles events vs users | Familiar to P2; overwhelming for P1; duplicates home stat bar intent |
| **Honeybadger** | Notices chart on dense detail page | Analytics framing; charter refuses default charts |
| **Rollbar** | Occurrence charts on dashboard cards | Wrong surface — home is list not cards |
| **Bugsink** | No graph; stacktrace-first | Aligns with Epure calm default |
| **Plausible** | Hero traffic graph on **analytics home** | Wrong domain — Epure refuses home graphs; detail is not Plausible's graph role |

Sentry shows sparklines on **issue list** (trend column) and **event graph on detail** — both refused for P1 home/detail default per [metrics-layout-verdict.md](./metrics-layout-verdict.md) and [sentry-ia-borrow.md](./sentry-ia-borrow.md).

### 4.2 Tension: user request vs chart policy

| Source | Position |
|--------|----------|
| User request | Graph on detail showing when/how much |
| `metrics-layout-verdict` §2 | Overview: **No** chart; More: optional sparkline **defer P3** |
| `metrics-layout-verdict` §9 dissent | "Sentry event graph on detail → Refuse default; text deltas in More for P3" |
| Charter J3 | Resolve visible without scrolling past advanced panels |

**Resolution:** Time *is* the decision variable on issue detail ("Is this spiking now or stale?") — unlike Issues home where the list + stat bar already answers "what broke?" Allow a **detail-only, issue-scoped** timeline widget that is **not** a chart-library hero.

### 4.3 Verdict for Epure

| Phase | Widget | Rationale |
|-------|--------|-----------|
| **P1 default** | **Text strip** — "3 in the last hour · 12 in the last 24h · 48 total" + relative last spike if detectable | Zero chart library; passes J3; answers "when" |
| **P1 optional (same slice)** | **CSS-only occurrence histogram** — 24–48 vertical bars (`div` + `height` from bucket counts, `bg-accent-muted` / `bg-accent`), no axes labels beyond "Last 7 days" | Lightweight; detail-only exception to zero-chart home policy; no Recharts/Visx |
| **P3** | Expandable sparkline in More if A/B proves text strip insufficient | Requires explicit J6 proof gate |

**Refuse:** Interactive chart library on Overview by default; dual-axis events vs users graph; release markers on histogram in P1; row sparklines.

**Placement:** Z4 — **below context grid, above last occurrences** — so triage flow is: understand → see timing → pick occurrence → act (actions stay in Z1).

### 4.4 Data requirements

New API (recommended):

```
GET /api/v1/issues/{id}/timeline?window=7d|28d|all&bucket=hour|day
```

Response:

```json
{
  "issue_id": "…",
  "event_count": 48,
  "stored_event_count": 12,
  "buckets": [
    { "start": "2026-09-13T11:00:00Z", "count": 3 },
    { "start": "2026-09-13T10:00:00Z", "count": 0 }
  ],
  "summary": {
    "last_1h": 3,
    "last_24h": 12,
    "last_7d": 48
  }
}
```

**SQL sketch** (RLS-scoped, uses `events` index):

```sql
SELECT date_trunc($bucket, occurred_at) AS bucket_start, COUNT(*)::int
FROM events
WHERE issue_id = $1 AND occurred_at >= now() - $interval
GROUP BY 1
ORDER BY 1
```

| Parameter | Default | Notes |
|-----------|---------|-------|
| `window` | `7d` | Match Issues home time presets where sensible |
| `bucket` | `hour` for ≤7d, `day` for 28d/all | Auto-select server-side OK |
| Empty buckets | Include zeros for histogram | CSS bars need full range |

**Fallback without new API (interim):** Derive coarse text strip from client-held `events[]` (max 50) — label "based on recent occurrences only" when `events.length < issue.event_count`.

---

## 5. Action button placement

### 5.1 Current vs target

| Viewport | Today | Target (L3 + this spec) |
|----------|-------|---------------------------|
| ≥768px | Actions in separate row below `dl` | **Header-right cluster** aligned with title (Z1) |
| <768px | Wrapped button row below `dl` | Full-width row immediately under subtitle — Resolve first |

### 5.2 Action hierarchy

| Priority | Action | Variant | Placement |
|----------|--------|---------|-----------|
| **Primary** | **Resolve** | `secondary` → consider **`default`/filled** when unresolved | First in cluster |
| **Secondary** | **Ignore** | `ghost` | Second |
| **Tertiary** | **Snooze** | `ghost` + menu (`SnoozeMenu`) | Third |
| **Promoted secondary** | **Copy for AI** | `ghost` or outline; icon `Sparkles`/`Copy` optional | Fourth — always visible on Overview |

**Plain labels:** "Mark resolved" tooltip optional; button text stays **Resolve** / **Ignore** per charter.

**Do not on Overview:** Export-only in More without duplicate button; merge; diff; delete.

**Snooze duplicate in More:** Keep section but demote heading — Overview is primary per [tab-debate.md](./tab-debate.md).

### 5.3 Keyboard & palette parity

| Action | Shortcut | Palette entry |
|--------|----------|---------------|
| Resolve | `e` (list/detail) | "Mark issue resolved" |
| Ignore | `i` | "Ignore issue" |
| Copy for AI | `⌘⇧C` (existing export) | "Copy for AI" / "Copy issue context" |
| Snooze | — | "Snooze issue…" submenu |

---

## 6. Ask AI feature

### 6.1 Phase 1 scope (FEATURES compliance)

**LLM Context Export** (FEATURES Tier 4):

> Global hotkey (`Cmd+Shift+C`) or button that copies a sanitized Markdown block: exception type, demangled stack trace, preceding 5 breadcrumbs, and runtime tags.

**Allowed:** Clipboard + markdown + optional prompt template.  
**Refused:** External LLM API, in-product chat panel, Seer-style AI sidebar, automatic fix PRs.

Pattern name in UI: **Copy for AI** (plain) — not "Ask Epure" — sets expectation of handoff to Cursor/ChatGPT/Claude Code.

### 6.2 Clipboard payload structure

Two-part clipboard (single copy operation, separated by horizontal rule):

**Part A — Prompt template (pre-filled user message):**

```markdown
You are helping me fix a production exception in my app.

## Goal
Find the root cause and propose a minimal, safe code fix.

## Issue
- Title: TypeError: Cannot read properties of undefined (reading 'id')
- Status: unresolved
- Occurrences: 48
- Users affected: 12
- Environment: production
- Release: v1.4.2
- Last seen: 2026-09-13T12:38:00Z

## Instructions
1. Explain likely root cause in plain language.
2. Point to the most relevant stack frame and breadcrumb.
3. Suggest a concrete patch (diff or steps).
4. Note any tests or guards to add.

---
(Context below)
```

**Part B — Existing export body** (`buildIssueExportMarkdown`):

- Exception summary
- Stack trace (demangled frames)
- Last 5 breadcrumbs
- Runtime tags

Extend `export-markdown.ts` with `buildIssueAiClipboard(issue, event)` — do not duplicate field formatting.

### 6.3 Placement

| Surface | Control | Notes |
|---------|---------|-------|
| **Overview Z1** | **Copy for AI** button in header-right cluster | Primary discoverability win |
| **More tab** | Keep "Copy markdown for LLM" — same handler; rename to **Copy for AI** for consistency |
| **Command palette** | "Copy for AI" when issue selected | Already has export via triage bridge — rename + wire enriched payload |
| **Toast** | "Copied — paste into Cursor or your AI assistant" | Plain language |

**Optional Phase 1b:** `Copy for Cursor` deep link if Cursor documents a `cursor://` paste URL — research only; not required for FEATURES proof.

### 6.4 Sanitization rules (unchanged)

- Use scrubbed payload paths already enforced at ingest
- No raw secrets from `payload_json` beyond stack/crumbs/tags export
- Truncate breadcrumbs to last 5 (existing)

---

## 7. Last occurrences

### 7.1 Requirement

Show **last N occurrences** (default **5**, cap **8** on Overview) with:

| Column | Source |
|--------|--------|
| When | `event.occurred_at` — relative primary, absolute in tooltip |
| User | `user_email` ?? `user_id` ?? muted "—" |
| Environment | `event.environment` ?? issue rollup |
| Release | `event.release` ?? "—" |

**Interaction:**

- Row click → set `selectedEventId` (shared with Stack/Breadcrumbs)
- Optional "Open stack" affordance → switch to Stack tab
- Footer link **View all {event_count} →** switches to More tab occurrences section (when built)

### 7.2 Data strategy

| Approach | Pros | Cons |
|----------|------|------|
| **Client slice of `fetchEvents`** | No new API; already loaded | Full payload for 50 events; heavy if only list needed |
| **`GET …/events?limit=8&fields=summary`** (new) | Light list | Requires API extension |

**P1 recommendation:** Reuse existing `fetchEvents(issueId, { limit: 8 })` for Overview list; lazy-load full 50 when user opens Stack/More. Add **`EventSummary`** type (id, occurred_at, env, release, user_*) in a later slice if payload size matters.

### 7.3 Empty / partial states

| Case | Copy |
|------|------|
| No stored events | "Occurrence details not available — counter may reflect pruned history." |
| `event_count > events.length` | Subhead: "Showing last {n} stored occurrences of {event_count} total" |

---

## 8. FEATURES.md compliance matrix

| FEATURES row | Tier | Detail UX ask | Verdict |
|--------------|------|---------------|---------|
| **Unique User Tracking** | 3 | Show impacted users on Overview | **Allowed** — scalar only |
| **LLM Context Export** | 4 | Ask AI button + prompt | **Allowed** — promote to Overview; extend template |
| **Occurrence & Release Diff** | 4 | Last occurrences + timeline | **Allowed** — list on Overview; diff stays More |
| **Breadcrumb & Log Filter** | 4 | — | N/A on Overview |
| **Release & Regression Engine** | 5 | Richer regression copy | **Allowed** — needs `resolved_in_release` on API |
| **Smart Snooze Logic** | 5 | Snooze banner | **Allowed** — needs snooze fields on API |
| **Velocity Spike Alerts** | 5 | Timeline spike hint | **Allowed** — text only; link to Alerts rail |
| **Automated TTL & Data Pruning** | 3 | Count vs stored mismatch | **Required** — honest labeling |
| **Spike-Proof Counter Valve** | 1 | Counter > stored events | **Required** — label in UI |
| External LLM API | — | In-app AI chat | **Refused** Phase 1 |
| Users graph | — | Graph of affected users | **Refused** |
| Home/error graphs | — | Hero charts | **Refused** on home; detail histogram exception per §4 |
| Replay / traces / profiling | — | — | **Refused** |

---

## 9. Implementation slices

Ordered **I1–I8** with proof gates. Assumes charter IA unchanged (Overview · Stack · Breadcrumbs · More).

| Slice | Scope | Proof gate |
|-------|-------|------------|
| **I1 — Impact strip** | Overview Z2: relative last/first seen, `unique_user_count` ("12 users affected"), consistent `formatRelativeTime` | J3: metrics visible without scroll on 768px |
| **I2 — Header actions (L3)** | Move Resolve/Ignore/Snooze to header-right ≥768px; demote keyboard footer to `?` | J3: actions visible without scroll; no permanent hint band |
| **I3 — Last occurrences** | Overview Z5 list; click selects occurrence; "View all" → More | P2 migrant: switch occurrence without opening Stack first |
| **I4 — Timeline text strip** | Overview Z4: summary counts (1h/24h/7d) from new timeline API or client fallback | J3: timing context without chart library |
| **I5 — SVG line chart (optional same PR as I4)** | Smooth line chart (Catmull-Rom SVG path, no chart library) using bucket API; hover tooltip with time + count; collapse when ≤1 bucket nonzero | J6: "What broke?" still ≤5s; chart ≤64px tall |
| **I6 — Copy for AI** | Overview button + palette rename + prompt-wrapped clipboard; unify More label | J4: `⌘⇧C` still copies enriched payload |
| **I7 — API enrich `IssueSummary`** | Add `first_seen_at`, `resolved_in_release`, snooze active flags to list/detail fetch | Regression + snooze banners without extra round-trip |
| **I8 — Overview polish** | Top tags (max 3), snooze banner, `resolved_in_release` regression copy, TTL mismatch label | J5 token QA on reskin |

**Dependency order:** I7 → I1/I8 (first seen, snooze); I4 → I5 (API before line chart); I6 independent; I2 can parallel I1.

**Explicitly not in I1–I8:** chart library dependency; Sentry event search; Overview diff/merge; row sparklines.

---

## 10. Dissent / tensions

| Tension | Positions | Resolution |
|---------|-----------|------------|
| **Graph on detail vs zero-chart P1** | User wants graph; metrics verdict refuses Overview charts | **Detail-only exception:** SVG line chart OR text strip; never home; never chart library by default |
| **Overview richness vs J3 one-screen** | More metrics + list + timeline risks scroll | Cap last occurrences at 5; line chart max 64px; tags below fold; actions pinned Z1 |
| **Occurrences on Overview vs spec "no occurrence picker on Overview"** | issue-surface-spec §3.3 says implicit latest only | **Amend spec:** read-only **last occurrences list** is not a picker control — it teaches scope without Stack tab chrome |
| **Ask AI on Overview vs "export in More only"** | Progressive disclosure vs user request | FEATURES explicitly wants hotkey/button; promoting **Copy for AI** to Overview is compliance, not scope creep |
| **"Events" vs "occurrences" copy** | List uses "events"; plausible-patterns says "Occurrence" in detail | Detail Overview uses **occurrences**; keep list meta as **events** for scan consistency |
| **Sentry migrant expectations** | Event graph + occurrence search on detail | Offer **text timing + last N list** as substitute; defer graph search to More P3 |
| **TTL / counter valve honesty** | Showing "48 occurrences" with 12 stored rows | Always show stored count sublabel when diverged — builds trust vs vanity metrics |

---

## Appendix A — Wireframe (target Overview)

```
┌─ Overview ──────────────────────────────────────────────────────────────────┐
│ TypeError: Cannot read 'id' of undefined          [Resolve][Ignore][Snooze▾] │
│                                                    [Copy for AI]              │
│ [unresolved] [error]                                                          │
│ 48 occurrences · 12 users affected · last seen 2m ago · first seen 4d ago     │
├───────────────────────────────────────────────────────────────────────────────┤
│ Environment          Release          Latest user                               │
│ production           v1.4.2           user@example.com                          │
├───────────────────────────────────────────────────────────────────────────────┤
│ Last 7 days   ▂▃▁▇▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁ │
│ 3 in the last hour · 12 in the last 24 hours                                    │
├───────────────────────────────────────────────────────────────────────────────┤
│ Recent occurrences                                                            │
│ · 2m ago    user@example.com    production    v1.4.2                          │
│ · 1h ago    —                   production    v1.4.1                          │
│ · Yesterday anon@…              staging       v1.4.0                          │
│ View all 48 in More →                                                         │
├───────────────────────────────────────────────────────────────────────────────┤
│ Snoozed until 50 occurrences — 38 remaining                                   │
│ javascript · Chrome 121 · macOS                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Appendix B — Component map (proposed)

| Zone | Component | File (new or existing) |
|------|-----------|------------------------|
| Overview shell | `IssueOverviewPanel` | `web/src/ui/issue-overview-panel.tsx` |
| Impact strip | `IssueImpactStrip` | new `web/src/ui/issue-impact-strip.tsx` |
| Timeline | `IssueOccurrenceTimeline` | new `web/src/ui/issue-occurrence-timeline.tsx` |
| Last occurrences | `IssueRecentOccurrences` | new `web/src/ui/issue-recent-occurrences.tsx` |
| Copy for AI | extend `export-markdown.ts` | `web/src/features/issues/export-markdown.ts` |
| Timeline API | `fetchIssueTimeline` | `web/src/lib/api.ts` + `crates/storage` + route |
| Orchestration | `IssuesPage` | `web/src/features/issues/index.tsx` |

---

## Appendix C — Open questions

| # | Question | Recommendation |
|---|----------|----------------|
| OQ1 | Ship text strip before line chart? | **Yes** — I4 before I5; validate with P1 user |
| OQ2 | Rename button "Copy for AI" vs "Copy for Cursor"? | **Copy for AI** — vendor-neutral |
| OQ3 | Show line chart on issues with 1 occurrence? | Collapse Z4 to single line "1 occurrence · just now" |
| OQ4 | Extend `GET /issues/:id` for detail-only fields vs bloating list? | Optional `GET /issues/:id` detail endpoint for snooze/regression/first_seen while keeping list lean |

---

*Status: I1–I8 **shipped** (D15, 2026-09-13). Post-D15 backlog **shipped** (2026-09-13): More tab occurrences list + tags/grouping/merge/feedback; timeline window selector (7d/14d/30d); snooze chip on list row; Slice C stack/breadcrumbs depth; D12 breadcrumbs drawer.*
