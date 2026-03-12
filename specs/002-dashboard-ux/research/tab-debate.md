# Project dashboard tabs — multi-agent debate synthesis

**Status:** Ratified direction (2026-09-13)  
**Inputs:** [charter.md](../charter.md) · ICP research · specialist swarm (IA, P1, P3, product strategist, competitive benchmark)  
**Scope:** What tabs exist at project rail, Issues home, issue detail, and settings — and what must never become a tab.

---

## Final verdict (moderator: product strategist)

**Ship `Issues · Releases · Alerts · Settings`.** Issues is the Plausible-shaped home (stat bar + list). No Dashboard route. No status sub-tabs on Issues home. Issue detail: **Overview · Stack · Breadcrumbs · More** (stack on dedicated Stack tab per 2026-09-13 UX pass).

---

## FINAL TAB MANIFEST

| Tab / surface | Purpose | Primary persona | Phase |
|---------------|---------|-----------------|-------|
| **Issues** | Home: stat bar + unresolved list + setup ritual + master-detail triage | P1 | P1 |
| **Releases** | Deploy inventory, version context, regression anchor | P2 | P1 |
| **Alerts** | Impact history — what fired, when, for which issue/release | P1 + P2 | P1 |
| **Settings** | DSN, webhooks, team, project config, Review connection | P1 | P1 |
| **Overview** (detail) | One-screen triage: title, status, env/release, Resolve/Ignore/Snooze | P1 | P1 |
| **Stack** (detail) | Demangled frames, in-app highlight | P1 + P2 | P1 |
| **Breadcrumbs** (detail) | Timeline preview + drawer for deep inspect | P2 | P1 |
| **More** (detail) | Tags, diff, merge context, export, event query, activity | P3 | P1 |

**Not tabs:** `/setup` route + checklist on Issues; Filter panel; command palette; org rail (Projects, Team, Usage, Billing).

### Project settings sub-nav

| Item | Label | Purpose |
|------|-------|---------|
| General | General | Project name, retention |
| DSN | **Connection** | Copy/manage ingest keys |
| Webhooks | Webhooks | Outbound notifications |

Team stays **org rail**, not project Settings.

---

## Issues home — not tabs

| Element | Treatment |
|---------|-----------|
| Stat bar | `Unresolved · Events (7d) · Regressions` — **Regressions clickable** → `is:regression` filter |
| Default list | Unresolved only |
| Filter chips | `Unresolved` (default visible); `Came back` (regression preset); others in Filter door |
| Status sub-tabs | **Refused** — Sentry-style `Unresolved / Regressed / All` row |
| Categories (Auth/UI/Payments) | **Filter chip when data exists** — never rail tab or home section in P1 |

---

## Specialist positions (debate record)

### [IA specialist](d9f9aad8-7aa3-4179-aa32-3d83ddee1e3c)

- Keep 4-rail; each item = different **job**, not filtered slice of Issues
- Issues **is** the dashboard — refuse `/dashboard`
- Rule: narrows same list → filter/chip; different object → rail tab
- Current code (`project-rail.tsx`, `issue-detail-tabs.tsx`) already matches target

### [P1 advocate](39c5cfe4-2ff8-4dd6-80a9-236713f4643e)

- Month-one rail: `Errors · Settings` only; defer Releases/Alerts
- Rename Issues → **Errors** on surface
- Stat label: **Came back** not Regressions
- **Overruled** on hiding Releases/Alerts — replaced by **guided empty states** on those tabs

### [P3 advocate](bd3fa4b6-f71d-49de-b8fc-ce897387c96b)

- Keep 4-rail — hiding Releases/Alerts breaks morning ritual
- **Clickable Regressions stat** + Filter presets: Regression, Snoozed
- **Snooze on Overview** (not More-only) — repeat triage action
- **Merge/bulk in list column** — never More tab (J4)
- Expand ⌘K to triage launcher (resolve, snooze, merge, export, filter presets)

### [Product strategist](322653e7-7e75-45a1-8ec7-bb4b11a4d10f)

- Signed manifest above; four-item soft cap on project rail
- Alerts tab = **read surface**; Settings = configuration
- Mobile: Issues + Settings always; Releases + Alerts in overflow

### [Competitive benchmark](7a17615c-a143-49e9-9b65-a759c27ac8c2)

- **Grade: B+** (path to **A** with polish, not structural change)
- Epure sits in **Honeybadger quadrant** (flat project tabs, no dashboard) + **Plausible discipline** (depth behind doors)
- Validates 4-rail vs GlitchTip (6+) and Sentry 2025 stacked nav sprawl
- Validates detail **tabs** over Sentry 2025 scroll-all (J3 trade is correct for P1)
- Sentry demoted Releases to Explore — Epure keeping Releases top-level is right for small teams

---

## Resolved compromises

| Tension | Resolution |
|---------|------------|
| P1 wants 2-rail vs P3 wants 4-rail | **Keep 4-rail** with great empty states on Releases/Alerts |
| Rename Issues → Errors | **No** — keep Issues for P2; use plain copy on home ("unresolved exceptions") |
| Status sub-tabs | **No** — chips + clickable stat bar |
| Dashboard route | **No** — Issues + StatBar is home |
| Categories as tabs | **No** — filter chips Phase 1b when heuristics exist |
| Snooze placement | **Overview** (P3 wins over strategist manifest listing snooze only in More) |

---

## Competitive positioning

| Tool | Project nav model | Epure stance |
|------|-------------------|--------------|
| **Honeybadger** | Errors · Deploys · Uptime · Settings | Closest peer — Epure drops Uptime (out of scope) |
| **Sentry 2025** | Stacked nav + category sidebar + scroll detail | Refuse sprawl; borrow object model only |
| **Rollbar** | Dashboard ≠ Item List (dual home) | Refuse — Issues is home |
| **GlitchTip** | 6+ org-scoped items | Refuse — 4-item cap |
| **Bugsink** | No rail; project page = list | Too thin for P3 triage depth |
| **Plausible** | No rail; one scroll surface | Borrow pacing, not analytics layout |

**Anti-patterns correlated with "too complex" complaints:** dual home, query bar hero, category sidebars, 6+ rail items, card-zoo dashboards, nested scroll on detail.

---

## Implementation status (2026-09-13)

Shipped in [tab debate UX implementation](8426625d-4c8a-46f5-af71-90052f443ed3):

| # | Item | Status |
|---|------|--------|
| 1 | Clickable Regressions stat | ✅ |
| 2 | Filter presets: Came back, Snoozed | ✅ (+ backend `is:snoozed`) |
| 3 | Snooze on Overview | ✅ |
| 4 | ⌘K triage actions | ✅ (snooze durations deferred — Overview + More) |
| 5 | Guided empty states (Releases, Alerts) | ✅ |
| 6 | Alerts header webhook copy | ✅ |
| 7 | Detail tab keys `1`–`4` | ✅ |
| 8 | Rename More → Details | ⏸ deferred |

**Key files:** `stat-bar.tsx`, `issues/index.tsx`, `query-utils.ts`, `triage-bridge.ts`, `command-palette.tsx`, `issue-overview-panel.tsx`, `issue-detail-tabs.tsx`, `releases/index.tsx`, `alerts/index.tsx`, `issues.rs` (API filter).

---

## Decision principles (future tab additions)

1. **One home story** — rail tab must answer "what broke?" or "what do I do next?", not analytics.
2. **Plain surface, syntax behind doors** — query tokens never become tabs.
3. **Object model test** — new rail tab only for distinct persisted object with own list lifecycle.
4. **Journey proof** — new tab needs P1 five-second comprehension test.
5. **Four-item soft cap** — fifth rail item requires removing one; prefer Filter/Settings overflow.

---

## Phase 1 signed refusal list

| Refused | Reason |
|---------|--------|
| Dashboard / Overview (project) | Duplicates Issues home |
| Performance / Traces / Replay / Profiling / Logs | Constitution forbidden |
| Discover / Query (as tab) | Filter panel only |
| Saved Views (as rail tab) | Filter presets later |
| Categories sidebar (Errors vs Metrics) | Sentry scope creep |
| Auth/UI/Payments taxonomy tab | No owned taxonomy P1 |
| Environments (rail tab) | Top-strip scope control |
| Assignee / Team inbox | Solo-dev default |
| Billing / Usage (project rail) | Org-level only |

---

## Mobile Phase 1

| Layer | Treatment |
|-------|-----------|
| Project rail | Issues + Settings visible; Releases + Alerts in overflow |
| Issues home | Full-width list; stat bar → 2 metrics (Unresolved · Events 7d) |
| Issue detail | Full-screen; Overview + Stack primary; Breadcrumbs/More in tab strip |
| Triage depth | Read-only glance OK; bulk/merge on desktop |

---

## ASCII IA (final)

```
Project rail
  Issues ★     stat bar + list + Filter + detail pane
  Releases     deploy list → drill to Issues+filter
  Alerts       fired alerts + rules entry
  Settings     General · Connection · Webhooks

Issue detail tabs
  Overview     triage + Resolve/Ignore/Snooze
  Stack        frames + occurrence picker
  Breadcrumbs  timeline + drawer
  More         diff · export · tags · activity · grouping
```

---

## Dissent log (strongest arguments against verdict)

1. **P1: hide Releases/Alerts** — empty tabs scare newcomers. *Counter:* guided empty states, not removal.
2. **Rename to Errors** — plainer for P1. *Counter:* P2 vocabulary + SDK mental model; plain copy on home suffices.
3. **Status tabs for migrants** — Sentry muscle memory. *Counter:* chips deliver same filters with J2 compliance.
4. **Alerts in Settings only** — fewer rail items. *Counter:* impact visibility is the product payoff post-setup.
5. **Category chips now** — differentiation. *Counter:* wrong labels erode trust; defer until heuristics proven on seed fixtures.
6. **Follow Sentry 2025 scroll-all detail** — industry moved away from tabs. *Counter:* Sentry optimizes multi-product power users; Epure J3 requires resolve above fold without scrolling past diff/merge.
