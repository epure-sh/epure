# Plausible Analytics — UX pattern research

**Status:** Research dossier (2026-09-12)  
**Scope:** Onboarding, dashboard IA, filters, setup verification, shell layout, plain language, progressive disclosure  
**Audience:** 002-dashboard-ux charter → spec/plan/tasks  
**North star mapping:** Epure = exception-only monitoring with Plausible-shaped UX for indie devs / small SaaS (often no Sentry background)

**Visual boundary:** Epure uses Signal Room tokens (warm paper surfaces, pine-charcoal dark mode, phosphor signal accents per `design/VERDICT.md`). This dossier extracts *interaction and information* patterns only — not Plausible's palette, card shadows, or analytics-specific chart grammar.

**Sources:** [Plausible docs](https://plausible.io/docs/guided-tour), [filters & segments](https://plausible.io/docs/filters-segments), [troubleshooting](https://plausible.io/docs/troubleshoot-integration), [keyboard shortcuts](https://plausible.io/docs/keyboard-shortcuts), changelog; GitHub PRs [#4441](https://github.com/plausible/analytics/pull/4441), [#4445](https://github.com/plausible/analytics/pull/4445), [#4459](https://github.com/plausible/analytics/pull/4459), [#4117](https://github.com/plausible/analytics/pull/4117), [#5037](https://github.com/plausible/analytics/pull/5037), [#5726](https://github.com/plausible/analytics/commit/32fa20cfb1980b53cbe41808397c421eb3bdd425).

---

## Executive summary

Plausible's product promise is **"one dashboard, essential stats, no training."** They achieve this through:

1. **Guided provisioning** — detect context early (WordPress / GTM / manual), tailor instructions, generate a copy-paste artifact, then verify automatically.
2. **Single home surface** — summary metrics + scannable lists; no report builder or sub-menu maze.
3. **Click-first filtering** — row click applies a filter instantly; a separate **Filter** button holds power operators, saved segments, and URL-shareable state.
4. **Verification as ritual** — dashboard opens immediately; a top banner runs background checks and polls until the first real event; failure paths are symptom-indexed, not stack-trace-first.
5. **Plain labels everywhere** — "Unique visitors," "Last 28 days," "Clear all filters" — never query syntax on the default surface.
6. **Depth behind doors** — expand icons, Filter modal, comparison mode, keyboard shortcuts (`W`, `X`, `Esc`) — all discoverable, none promoted on first run.

For Epure, the transferable lesson is **emotional pacing**: Docker up → paste DSN → see first exception should feel like Plausible's first pageview moment — calm, verified, obvious — while the *content* is issue rows and stack frames, not traffic charts.

---

## 1. Onboarding & provisioning flow

### What Plausible does

**2024 onboarding epic** (PRs #4441, #4445, #4459) standardized provisioning across registration, invitation, site creation, password reset, and domain change:

| Stage | Pattern |
|-------|---------|
| **Progress** | Horizontal step bar across multi-step flows (not a sidebar wizard) |
| **Context detection** | "Customize installation" asks site type early — WordPress, GTM, or manual — and branches instructions |
| **Artifact generation** | Manual/GTM users pick tracker extensions via checklist; snippet is generated, not hand-assembled |
| **Post-setup access** | Snippet removed from always-visible Settings; replaced by **Review Installation** two-step flow |
| **Verification** | No longer optional (`VERIFICATION_ENABLED` deprecated); runs as part of onboarding |
| **Layout evolution** | Introduced unified "focus" view (logo left, no footer), then **removed** `focus.html` entirely — one app chrome for everything |

**Flow shape (new site):**

```
Register → Create site (domain) → Choose installation type → Customize snippet →
Copy snippet → Dashboard opens → Banner: installation check running →
First real visit OR troubleshooting path
```

**Copy patterns:**

- Imperative, short steps: "Add the snippet to your site's `<head>`"
- Platform-specific guides linked inline (WordPress, Ghost, GTM) — not one generic wall of text
- Changelog framing: "choose the measurements you want using a checklist" — options as toggles, not config files

### Implications for Epure (P1 persona)

Indie devs expect **in-app ritual**, not README archaeology (charter J1). Plausible never asks users to hunt Settings for a DSN on day one — the provisioning path *is* the product until first data.

| Plausible | Epure analogue |
|-----------|----------------|
| Domain name | Project name |
| Script snippet | DSN + minimal SDK init (language-aware) |
| Installation type | SDK picker (Node, Python, browser, curl fixture) |
| Tracker extensions | Optional: source maps, release tag, environment — Phase 1 keep minimal |
| Review Installation | **Review connection** in Settings |

**Charter tension (resolved):** Plausible briefly used a separate "focus" layout for auth/onboarding, then deleted it (#4459). Epure charter already says **one shell** — login through triage shares the same rail/top chrome. Steal the *progress bar and branching*, refuse a second layout tree.

---

## 2. Dashboard information architecture

### What Plausible does

From the [guided tour](https://plausible.io/docs/guided-tour):

> "One dashboard with the essential website stats, easy to use and understand with no training or prior experience. There are no sub-menus and no need to build custom reports."

**Vertical structure (single scroll):**

```
┌─────────────────────────────────────────────────────────────┐
│ Site name ▾          [filter pills…]  [Filter]  [Date ▾]   │
├─────────────────────────────────────────────────────────────┤
│ TOP GRAPH — toggleable metric (visitors / visits / views…)  │
│   headline numbers + sparkline                              │
├──────────────┬──────────────┬──────────────┬───────────────┤
│ Sources      │ Top Pages    │ Locations    │ Devices       │
│ (ranked list)│ (ranked list)│ (ranked list)│ (ranked list) │
├──────────────┴──────────────┴──────────────┴───────────────┤
│ Goals / Properties / Funnels (if configured)                │
└─────────────────────────────────────────────────────────────┘
```

**IA rules:**

| Rule | Detail |
|------|--------|
| **One home** | Dashboard = default landing after setup; no "overview vs explorer" split |
| **Summary → lists** | Headline stats answer "how much?"; cards answer "from where / what / who?" |
| **Click = drill** | Row click filters the whole dashboard, not navigate-away to a new page |
| **Expand = more rows** | ⊕ icon opens expanded view with extra columns — same page, denser table |
| **Site switcher** | Top-left site name → Settings, pinned sites, add site; keyboard `1`–`9` |
| **Settings split** | Account settings (user menu) vs Site settings (per-domain) — clear mental model |

**2025 visual pass** (#5726): reduced card shadow, aligned spacing, thinner graph line — consistency over decoration. Epure should mirror this *restraint* on Signal Room tokens, not the specific radii.

### Implications for Epure

Charter IA target aligns well:

```
Issues home = Plausible top graph + ranked lists
  Stat bar (unresolved, events this week, regressions)  ← headline metrics
  Issue list (default: unresolved)                      ← primary ranked list
  [Filter]                                              ← power door
```

**Do not import:** Sources/Pages/Locations/Devices card grid — that's analytics grammar. Epure's secondary lists might be **environments, releases, or top error types** later, but v1 home stays **one list + stat bar**.

**Master-detail:** Plausible stays single-page until expand; Epure uses master-detail for issue triage (Sentry borrow) — acceptable if selecting a row does not feel like "leaving home." List remains visible in rail layout.

---

## 3. Filter UX

### What Plausible does

Two complementary modes ([filters docs](https://plausible.io/docs/filters-segments)):

**Mode A — Click-to-filter (default learning path)**

- Click any row in Sources, Pages, Countries, etc.
- Dashboard instantly narrows; filter pill appears in top bar
- Mix filters: source → country → goal (AND semantics)
- `Esc` clears all filters

**Mode B — Filter button (power path)**

- Top-right **Filter** opens structured modal
- Columns grouped by domain: URL · Acquisition · Device · Behaviour
- Operators: `is`, `is not`, `contains`, `does not contain` (per-dimension)
- Typeahead search inside long lists (countries, pages)
- **Save as segment** → personal or site-wide; reopen from Filter menu
- Filter state in **URL query string** — bookmarkable, shareable

**Frontend architecture** (#4117): filters unified FE/BE representation; jsonurl for prettier URLs; backwards-compatible migration of bookmarked links.

**Interaction polish** (#5037): Headless UI popovers; fix Escape vs clear-filters conflict; one dropdown open at a time; calendar positioning on small screens.

### Implications for Epure

| Plausible pattern | Epure mapping |
|-------------------|---------------|
| Click row → filter | Click issue metadata chip (e.g. environment, release) → adds filter chip |
| Filter pills in top bar | Parsed query chips: `Unresolved`, `Production`, `level:error` |
| Filter button | Houses full query syntax, saved views, export — charter: "advanced behind a door" |
| `Esc` clears filters | Same; must not fight modal close (#5037 lesson) |
| Saved segments | Saved filters / views (P3; 001 FEATURES) |
| URL state | Shareable filtered issue list URLs |

**Plain language rule:** Default filter surface shows **"Unresolved"** not `is:unresolved` (charter J2). Query tokens live inside Filter panel and chip tooltips.

**Date range:** Plausible's date picker is a first-class global control. Epure Issues home likely needs **time window** (Last 7 days / Last 28 days / All time) with same preset + custom pattern — mapped to `last_seen` not pageviews.

---

## 4. Setup verification

### What Plausible does

**Post-snippet experience** ([troubleshooting](https://plausible.io/docs/troubleshoot-integration)):

1. Dashboard opens **immediately** — no gate screen
2. **Top banner** shows installation check progress
3. Background **testing tool** sends synthetic traffic (excluded from stats)
4. Banner resolves to success or actionable failure
5. If real visits work, user can ignore tool warnings
6. **Empty state:** pulsating indicator + "Waiting for first pageview" — frontend **polls** backend until first event
7. **Review Installation** available anytime from Site Settings
8. Failure docs structured as **symptom → checklist → fix**, not error codes

**Checklist pattern (quick wins first):**

- Added snippet to `<head>`?
- Cleared cache?
- Consent banner blocking script?
- Only one snippet?
- Not testing on localhost?

**Manual verification fallback:** View source → search `plausible.init`; DevTools Network → `pa-` request 200.

**Changelog (2024):** Enhanced measurements checklist during onboarding; updated snippet generated automatically.

### Implications for Epure

| Plausible | Epure |
|-----------|-------|
| First pageview | First exception event |
| Installation banner | **Connection banner** on Issues home until first event |
| Testing tool (synthetic) | **Send test error** button (curl / SDK one-liner) — optional helper in setup |
| Polling empty state | Poll ingest for project DSN until `events.count > 0` |
| Review Installation | Settings → **Review connection** (DSN, last event, SDK links) |
| Symptom-indexed docs | In-app: "No events yet?" → DSN wrong / firewall / wrong environment |

**J1 proof alignment:** User copies DSN in-app, triggers fixture, returns to Issues → row visible. Setup marked complete when first **real** event arrives (not merely banner dismissed).

**Self-hosted note:** Plausible CE skips browserless verification (#4604). Epure OSS can always verify — we control ingest. Verification should be **first-class**, not optional env flag.

**Empty state copy (Epure law):** `0 UNRESOLVED EXCEPTIONS` — typographic, no mascot, no pulsating green dot cosplay. Use Signal Room **signal dot** sparingly for "listening" state if needed.

---

## 5. One-shell layout

### What Plausible does

**Evolution:**

- 2024: "Focus" layout for onboarding — logo left, no footer, horizontal progress (#4441)
- 2024-09: **Removed** `focus.html` — "the distinction leads to unnecessary maintenance" (#4459)
- Result: registration, onboarding, dashboard, settings share one chrome

**Persistent chrome:**

| Zone | Content |
|------|---------|
| Top-left | Site name (switcher + Settings entry) |
| Top-right | Filter, date range, user menu |
| Body | Dashboard cards or settings content |
| No footer | In app views |

**Sites overview:** Separate list page for multi-site accounts; pinned sites surface in switcher. Single-site users rarely see it.

### Implications for Epure

Charter: **"One shell — login through app uses the same calm chrome."**

| Decision | Recommendation |
|----------|----------------|
| Setup route `/setup` | Render **inside** AppShell (rail visible, maybe collapsed checklist) — not full-screen wizard |
| First-run overlay | Checklist card on Issues home, not separate layout |
| Auth pages | May stay minimal, but post-login lands in shell immediately |
| Project switcher | Hide until second project exists (charter open question) — mirrors Plausible pinning |

**Rail IA (Epure):** Issues · Releases · Alerts · Settings — Plausible has no left rail; Epure adds one for triage-scale nav. Keep rail narrow; filters stay page-level, not in rail (`design/DASHBOARD.md`).

---

## 6. Plain language

### What Plausible does

**Label choices:**

| Instead of… | Plausible says… |
|-------------|-----------------|
| Sessions (jargon) | Visits — with tooltip definition |
| UV / unique users | Unique visitors |
| Bounce (undefined) | Bounce rate — "percentage of sessions with one pageview" in docs |
| Segment builder | Filter · Save as segment |
| Query language | (none on surface) |
| Error states | "Waiting for first pageview" · "Installation check failed" |

**Docs tone:** Second person, short sentences, symptom headers ("What are you seeing?"), links to one fix per section.

**Metric click:** Graph legend uses full words; comparison shows "vs previous period" not `compare=prev`.

### Implications for Epure

| Sentry habit | Epure plain label |
|--------------|-------------------|
| `is:unresolved` | Unresolved (filter chip) |
| `level:fatal` | Critical |
| Issue / Group | Issue |
| Event | Occurrence (in detail only) |
| Resolve | Mark resolved |
| Ignore | Ignore |
| Regression | Came back |

**Five-second scan (J2):** Issues home title area should read like "12 unresolved exceptions" not "Issues · is:unresolved".

**Settings:** "DSN" is acceptable — it's the one industry term SDK users know. Pair with plain subtitle: "Paste this in your Sentry SDK init."

---

## 7. Progressive disclosure

### What Plausible does

**Layer 0 — Default dashboard:** graph + four lists + date preset (Last 28 days).

**Layer 1 — Click / expand:** row filter, expand icon for full table + sortable columns.

**Layer 2 — Filter modal:** operators, multi-select, segments, hostname/subdomain.

**Layer 3 — Settings & integrations:** goals, shields, imports, email reports, Slack — never on dashboard.

**Layer 4 — Keyboard:** `D`/`W`/`F` date presets, `X` compare, `R` realtime, `1`–`9` sites, `/` search, `Esc` clear — [documented](https://plausible.io/docs/keyboard-shortcuts) but **not shown in header**.

**Layer 5 — Realtime / compare / annotations:** same dashboard shell, mode toggles via date picker — not separate products.

### Implications for Epure

| Layer | Epure surface |
|-------|---------------|
| 0 | Issues home: stat bar + unresolved list |
| 1 | Click issue → Overview tab (message, status, last seen, resolve/ignore) |
| 2 | Stack · Breadcrumbs tabs |
| 3 | **More** tab: merge, diff, snooze, activity |
| 4 | Filter panel: query syntax, saved views |
| 5 | `j/k/e/i`, `⌘K`, bulk select — `Kbd` in footer & palette only (charter) |

**J3 proof:** Resolve/Ignore visible on Overview without scrolling past diff/merge — matches Plausible's "essential actions on the default view."

**Anti-pattern guard:** Do not show keyboard cheat sheet in header (charter refuse list). Do not put query bar as hero (Sentry-default refuse).

---

## 8. Patterns Epure should not copy

| Plausible pattern | Why refuse for Epure |
|-----------------|----------------------|
| Traffic graph as hero | Wrong domain — exceptions need issue list, not time-series vanity |
| Realtime pulsating dot | Too analytics-coded; use calm listening state |
| Multi-card dashboard grid | Implies GA-style reporting |
| Goals / funnels / journeys | Not exception monitoring |
| Plausible color system | Signal Room tokens are law |
| "Unique visitors" stat bar | Use unresolved count, events this week, regressions |
| Comparison mode (`X`) | Defer unless clear triage value (release compare lives elsewhere) |

---

## Principles

- **First data is the milestone** — provisioning exists to reach first real event; the UI polls, banners, and checklists serve that moment, not config for its own sake.
- **One obvious home** — headline counts plus a single primary list; no report builder, no query syntax on the default surface.
- **Click before syntax** — row and chip clicks teach filtering; the Filter panel holds operators, saved views, and shareable URL state.
- **Verify in place** — open the dashboard immediately, run checks in a banner, explain failures by symptom with a manual fallback path.
- **Same shell everywhere** — one chrome from login through triage; depth via tabs, expand, and modals, not separate layout trees.

---

## Anti-patterns

- **README archaeology** — DSN only in docs, setup buried in Settings tabs, no in-app copy block.
- **Query bar as hero** — `is:unresolved` as the first thing new users see (fails J2).
- **Gate the dashboard** — blocking overlay until setup completes; Plausible opens dashboard and listens.
- **Optional verification** — silent failure until user wonders why empty; always show connection status.
- **Focus layout fork** — maintaining separate onboarding chrome (Plausible removed this; Epure charter agrees).
- **Analytics cosplay** — traffic charts, realtime green dot, multi-metric graph toggles on Issues home.
- **Promoted power chrome** — permanent keyboard cheat sheet, visible merge bar, diff panel before Stack tab.
- **Copy Plausible visuals** — their greens, card shadows, and chart styles conflict with Signal Room.
- **Filter / Escape conflicts** — clearing filters when user meant to close a modal (#5037).
- **Mascot empty states** — confetti, illustrations, "all clear" celebration (VERDICT refuse).

---

## Candidate patterns for Epure

Concrete patterns mapped to v2 screens. Token names only; visuals per `web/design/tokens.css`.

### Setup (`/setup` or first-run checklist on Issues)

| Pattern | Implementation sketch |
|---------|----------------------|
| Horizontal progress | Steps: **Project name → Copy DSN → First exception seen** (3–4 dots, `--chrome-top-height` strip) |
| SDK branch picker | Like Plausible installation type: Node / Browser / Python / **curl** — changes copy block below |
| Generated artifact | Read-only `CodeBlock` with DSN injected; one-click copy; language-aware comment |
| Customize later | Skip source maps / release in v1 setup; link to Settings → Review connection |
| No layout fork | Render inside AppShell; rail shows Issues selected; checklist card in content area |
| Complete gate | Step 3 checks ingest poll — auto-advance when first event lands |

### Issues home

| Pattern | Implementation sketch |
|---------|----------------------|
| Stat bar | Three `Stat` primitives: **Unresolved** · **This week** · **Regressions** — tabular figures, pine ink |
| Default filter | List shows unresolved only; plain chip **Unresolved**, not `is:unresolved` |
| Connection banner | Until first event (or if ingest stale): banner with status + **Send test error** + troubleshooting link |
| Primary list | `IssueRow` at `--row-height`; signal dot for unread only (<10% accent) |
| Click-to-filter | Click environment/release on row → adds chip, updates query |
| Filter button | Opens `FilterPanel`: chips, typed query, saved views, clear all (`Esc`) |
| Time window | Date preset control (Last 7 days / Last 28 days / All time) — top filter row, not hero |
| Empty state | `0 UNRESOLVED EXCEPTIONS` — no mascot; subcopy: "Paste your DSN to start listening" + setup CTA |
| URL state | Filter + time range encoded in URL for shareable views |

### Issue detail

| Pattern | Implementation sketch |
|---------|----------------------|
| Tab disclosure | **Overview** (default) · Stack · Breadcrumbs · More — Plausible expand-icon equivalent |
| Overview first | Title, status badge, last seen, environment, occurrence count, **Mark resolved** / **Ignore** above fold |
| Stack second | Demangled frames, source context — click filename → filter Issues (click-to-filter) |
| More tab | Merge, diff, snooze, activity, export — never visible on Overview (J3) |
| Breadcrumb timeline | Scannable list; expand row for payload — not default tab |
| Keyboard layer | `j/k` list nav, `e/i` resolve/ignore; hints in detail footer via `Kbd`, not header |
| Master-detail | List remains in left pane; detail loads right — user never loses "home" |

### Settings

| Pattern | Implementation sketch |
|---------|----------------------|
| Account vs project split | User menu → profile/security; rail **Settings** → project-scoped |
| Secondary sidebar | Projects · DSN keys · Webhooks · Team (`design/DASHBOARD.md`) — not horizontal tabs |
| Review connection | Plausible **Review Installation**: DSN display, last event timestamp, SDK doc links, **Send test error** |
| Symptom troubleshooting | Collapsible "No events?" with checklist (DSN, firewall, wrong env, SDK init) |
| Re-copy without hunting | DSN always on Review connection — not buried three levels deep |
| Integration tokens | Future: webhook secrets, alert channels — same progressive pattern as Plausible goals (settings only) |

---

## References

- Plausible guided tour: https://plausible.io/docs/guided-tour
- Filters & segments: https://plausible.io/docs/filters-segments
- Troubleshooting / verification: https://plausible.io/docs/troubleshoot-integration
- Keyboard shortcuts: https://plausible.io/docs/keyboard-shortcuts
- Website settings IA: https://plausible.io/docs/website-settings
- Onboarding PR #4459 (focus layout removed): https://github.com/plausible/analytics/pull/4459
- Filter URL refactor #4117: https://github.com/plausible/analytics/pull/4117
- Epure charter: `specs/002-dashboard-ux/charter.md`
- Epure journeys: `specs/002-dashboard-ux/journeys.md`
