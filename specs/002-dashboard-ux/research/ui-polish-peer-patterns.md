# UI polish — peer patterns for monitoring dashboards

**Status:** Research dossier (2026-09-13)  
**Scope:** Cross-peer synthesis — what makes monitoring/dashboard UIs feel polished vs cluttered  
**Audience:** 002-dashboard-ux charter → spec/plan/tasks  
**Inputs:** `plausible-patterns.md`, `peers-small-monitoring.md`, `sentry-ia-borrow.md`, `charter.md`, `business/THESIS.md`  
**Peers studied:** Plausible, Linear, Raycast, Vercel dashboard, Better Stack, Highlight.io (+ Sentry as contrast)

**Visual boundary:** Epure uses Signal Room tokens (warm paper, pine-charcoal dark, phosphor accents). This dossier extracts *interaction, density, and feedback* patterns — not peer color systems, Geist typography, or analytics chart grammar.

---

## Executive summary

Polished monitoring UIs share a paradox: **high information density with low perceived noise**. The best products (Plausible, Linear, Vercel) achieve this by making the user's task the loudest element and pushing chrome, navigation, and power features into receding layers. Cluttered products (Sentry-default, Rollbar dashboard, Highlight pre-noise-reduction) invert this — query syntax, category rails, and analytics chrome compete with the actual work.

For Epure's solo-dev ICP, polish means:

1. **One obvious home** — unresolved issues + three counts; not a dashboard zoo.
2. **Chrome that recedes** — rail and filters support orientation; they don't shout.
3. **Click before syntax** — filtering and triage teach through interaction, not query training.
4. **Speed without spectacle** — keyboard and palette for P3; never permanent cheat sheets.
5. **States that instruct** — empty/loading/error copy tells the user what to do next, without mascots.

---

## 1. Polish principles

### 1.1 Density — rich data, calm surface

| Principle | What peers do | Epure application |
|-----------|---------------|-------------------|
| **Task-first hierarchy** | Linear 2024–2025 refresh: navigation sidebar and tabs made more compact; icons scaled down; colored team backgrounds removed so *issue content* dominates ([Linear design refresh](https://linear.app/now/behind-the-latest-design-refresh)) | Issues list + detail content = highest contrast; rail, filter row, and tabs = secondary ink |
| **Two-line rows, not seven columns** | Sentry stream table drops columns on narrow viewports rather than horizontal-scroll ([sentry-ia-borrow.md](./sentry-ia-borrow.md)) | `IssueRow`: title + meta on two lines; no table header row in v1 |
| **Fixed rhythm** | Plausible aligned card spacing and reduced shadow in 2025 pass; Vercel uses consistent 36–40px control height | `--row-height` (36px), `h-8` controls, tabular figures in stat bar |
| **Accent as punctuation** | Geist/Vercel: color reserved for status and primary actions; Linear limits chrome blue in color calculations | Signal Room law: accent < ~10% of issue-list pixels; `--danger` only for live exceptions |
| **No decorative chrome** | Vercel QA: no box-shadow on cards; hairline borders only ([design/qa.md](../../../web/design/qa.md)) | Same — structure via borders and spacing, not elevation |

**Density anti-pattern:** Equal visual weight on every UI zone. When nav, filters, stats, and list all compete, the product feels "enterprise" even if each piece is well-designed individually.

### 1.2 Rhythm — predictable spacing and motion

| Principle | What peers do | Epure application |
|-----------|---------------|-------------------|
| **Consistent vertical cadence** | Plausible: summary strip → filter row → primary list; no orphaned cards | Stat bar → filter chips → issue list; same order on every visit |
| **Compact but breathable** | Linear stress-tested sidebar from condensed to spacious; landed on compact-with-clear-gutters | Master-detail split with fixed list width; detail scrolls independently |
| **Motion communicates state** | Vercel: optimistic UI — show "building" before server confirms; skeleton over spinner | Resolve/ignore updates row immediately; skeleton rows on list fetch |
| **Brief, non-blocking transitions** | Linear: transitions on section fold, not page transitions | Tab switch and filter apply feel instant (<100ms perceived) |

**Rhythm anti-pattern:** Variable layouts per page (Rollbar dashboard vs Item List), or nested scroll regions (Sentry pre-2024 breadcrumbs) — breaks spatial memory.

### 1.3 Affordance — obvious actions, hidden power

| Principle | What peers do | Epure application |
|-----------|---------------|-------------------|
| **Click = consequence** | Plausible: row click filters whole dashboard; filter pill appears | Click env/release chip on row → filter chip; click issue → detail |
| **Primary actions visible** | Sentry puts Resolve in header — Epure keeps on Overview tab only | Mark resolved / Ignore above fold on Overview (J3) |
| **Power behind doors** | Plausible Filter button; Raycast Action Panel (`⌘K` on selection) | Filter panel, More tab, command palette — not header strip |
| **Contextual teaching** | Linear: right-click menus show keyboard shortcuts beside actions ([Invisible details](https://linear.app/now/invisible-details)) | Shortcut hints on hover (delayed) or in palette results; not permanent header `Kbd` row |
| **Discoverable, not promoted** | Plausible documents `W`/`X`/`Esc` in docs, not in dashboard header | `⌘K` in top strip without onboarding modal; `?` for shortcuts |

**Affordance anti-pattern:** Invisible power (hover stack preview on Sentry rows) or over-promoted power (Honeybadger shortcut docs in primary path).

### 1.4 Feedback — confirm, correct, never dead-end

| Principle | What peers do | Epure application |
|-----------|---------------|-------------------|
| **Optimistic updates** | Vercel: deployment UI shows expected state immediately | Resolve/ignore/snooze reflect in list before refetch completes |
| **Toast for irreversible** | Standard pattern across dev tools | Delete/merge confirm via dialog; success via graphite toast |
| **Live verification** | Plausible: banner polls until first pageview | Connection banner polls ingest until first event |
| **Symptom-indexed errors** | Plausible troubleshooting: "What are you seeing?" → checklist | "No events yet?" → DSN / firewall / wrong env — not error codes |
| **Honest degradation** | Bugsink: "many issues" when count expensive | Don't fake zero; show "listening…" vs "all clear" distinctly |

**Feedback anti-pattern:** Blank tables with no copy (NN/g empty-state failure), or blocking gate screens that prevent dashboard access during setup.

---

## 2. What Plausible does that Epure should steal

Plausible is Epure's north star for *emotional pacing* — calm, verified, obvious. Signal Room handles visuals; Plausible handles interaction grammar.

| Pattern | Plausible behavior | Epure steal |
|---------|-------------------|-------------|
| **One home, no maze** | Single dashboard; "no sub-menus and no need to build custom reports" ([guided tour](https://plausible.io/docs/guided-tour)) | Issues home = stat bar + unresolved list; Releases/Alerts get guided empty states, not separate "dashboards" |
| **First data = milestone** | Dashboard opens immediately; banner polls; empty state says "Waiting for first pageview" | Open Issues after `/setup`; connection banner until first exception; poll ingest |
| **Click-to-filter** | Row click → filter pill → whole view narrows | Click metadata chip → chip in filter row; `Esc` clears all |
| **Filter button for power** | Structured modal: operators, segments, URL state | Filter panel: chips + optional query syntax + saved views (P3) |
| **Plain labels** | "Unique visitors," "Last 28 days," "Clear all filters" | "Unresolved," "This week," "Mark resolved" — never `is:unresolved` on surface |
| **Setup ritual in-app** | Horizontal progress, SDK branch picker, generated snippet, verify | `/setup` → copy DSN → Issues checklist → ✓ first issue |
| **One shell** | Removed separate `focus.html` onboarding layout (#4459) | Login through triage shares same rail/top chrome |
| **Progressive disclosure** | Keyboard shortcuts documented, not shown in header | `⌘K`, `j/k/e/i`, `?` — palette and footer only |
| **Visual restraint** | 2025 pass: reduced card shadow, aligned spacing, thinner graph line | Mirror restraint on Signal Room tokens — fewer borders, no card shadows |
| **URL-shareable state** | Filters in query string; bookmarkable views | Filter + time window in URL for shareable issue lists |

**Do not steal Plausible visuals:** their greens, card shadows, traffic graph hero, realtime pulsating dot, multi-card grid — wrong domain for exception monitoring.

---

## 3. What Sentry does that Epure should refuse

Sentry is the benchmark for *data model* and *debug surfaces*, not *default chrome*. Its polish targets teams with query muscle memory — the opposite of Epure's P1.

| Sentry pattern | Why it feels cluttered to P1 | Epure refuse / hide |
|----------------|------------------------------|---------------------|
| **Query bar as hero** | `is:unresolved` is the first thing users see | Plain "Unresolved" chip; query in Filter panel |
| **Status tabs with query tokens** | All Unresolved · For Review · Regressed · Escalating | Filter presets behind door |
| **Category sidebar** | Errors · Performance · Replay · Feedback | Phase 1 = errors only; no category rail |
| **7-column issue table** | Priority, trend, assignee, events, users — analytics framing | Two-line `IssueRow`; optional columns in P3 |
| **Trend sparklines in list** | Implies volume literacy | Stat bar counts only; no per-row graphs |
| **Event graph on detail** | Duplicates stat bar; adds analytics chrome | Optional in More tab (P3) |
| **Streamline scroll-all detail** | Stack + crumbs + tags + replay in one scroll | Tabs: Overview · Stack · Breadcrumbs · More |
| **Permanent keyboard legend** | Header strip of shortcuts | `?` / palette on demand |
| **Hover stack preview** | Invisible to touch/P1 users | Click-through to Stack tab |
| **Replay / trace / profiling sections** | Scope creep | Constitution forbid |
| **Seer AI / priority heuristics** | Opaque ML badges | Defer entirely |
| **Dashboard-as-home** | Charts before "what broke?" | List is home |

**Borrow from Sentry (not refuse):** grouped issue model, two-line row anatomy, in-app frame highlight in stack, breadcrumb preview + drawer, env/release tags, merge/split/diff behind More.

---

## 4. Efficiency patterns

### 4.1 Keyboard — fast for P3, invisible for P1

| Source | Pattern | Epure stance |
|--------|---------|--------------|
| **Linear** | Full app keyboard-navigable; `⌘K` fuzzy palette; `g`+letter go-to; shortcuts in palette results teach organically | `⌘K` global; `j/k/e/i/x` on Issues; document in `?` only |
| **Linear** | Right-click contextual menus show shortcut beside each action | Consider on issue rows (resolve, copy link, snooze) — delayed hover hints OK |
| **Raycast** | Root search with frecency ranking; compact mode collapses until typing; Action Panel (`⌘K` on item) for secondary actions | Palette: recent issues + actions; group by Navigate / Triage / Settings |
| **Plausible** | `W`/`M`/`Y` date presets; `Esc` clear filters; `1`–`9` site switch | `Esc` clear filters; env switch via top strip; date presets in filter row |
| **Highlight** | `J`/`K` navigate errors in list | Same on Issues list — familiar to migrants |
| **Honeybadger** | `/` search, `u`/`r`/`m` shortcuts promoted in docs | Refuse promoting in primary chrome |

**Keyboard principle:** Every click path must exist; shortcuts are accelerators, not prerequisites. Linear's "invisible details" — shortcuts appear when users reach for power, not on first paint.

### 4.2 Single-click flows — reduce steps to value

| Flow | Cluttered approach | Polished approach (Epure) |
|------|-------------------|---------------------------|
| **Filter by environment** | Open Filter → type `env:production` | Click env chip on row → chip appears |
| **Triage issue** | Scroll detail → find resolve in sidebar | Overview tab: Resolve / Ignore visible without scroll |
| **Copy DSN** | Settings → Projects → Keys → copy | `/setup` and Review connection: one-click copy |
| **Share filtered view** | Export or screenshot | URL encodes filter state |
| **Navigate project** | Multi-level org → team → project | Top strip project label; switcher only at 2+ projects |
| **Send test error** | Read README curl example | Inline helper button on connection banner |

**Single-click principle:** Plausible's insight — *the dashboard teaches through clicking rows*. Epure's list is both triage surface and filter control.

### 4.3 Reduced chrome — what to hide or collapse

| Chrome element | Peer that does it well | Epure rule |
|----------------|------------------------|------------|
| **Sidebar** | Vercel 2026: resizable, hideable sidebar; mobile bottom bar | Rail narrow; 4 items max; no nested nav |
| **Top bar** | Plausible: site name + filter + date + user only | Env · project · `⌘K` · user — no duplicate env in filters |
| **Tabs** | Linear: compact rounded tabs, not full-width | Detail tabs: Overview · Stack · Breadcrumbs · More |
| **Borders** | Linear refresh: softened separators, fewer gratuitous lines | 1px hairlines; no box-shadow ([qa.md](../../../web/design/qa.md)) |
| **Icons** | Linear: reduced icon count and size in nav | Rail: text-first or minimal icons |
| **Command palette** | Raycast compact mode: search bar only until needed | Palette hidden until `⌘K`; no persistent search box on Issues home |

**Chrome principle:** Navigation orients; it doesn't decorate. If removing an element doesn't break J2 (five-second scan), remove it.

---

## 5. Empty / loading / error state polish

### 5.1 Empty states — instruct, don't decorate

| State | Peer reference | Epure pattern |
|-------|---------------|---------------|
| **Setup incomplete** | Plausible "Waiting for first pageview"; GlitchTip DSN on Issues; Bugsink connect panel | Connection banner + DSN visible + "Send test error" CTA; typographic `0 UNRESOLVED EXCEPTIONS` |
| **Setup complete, zero open** | Bugsink "No open issues" + "this might mean"; Rollbar Welcome card explains zero ≠ broken | "No unresolved issues" — positive, calm; link to resolved/archive |
| **Releases empty** | Better Stack templates exist but add clutter | Title + one-line hint + SDK upload CTA (no mascot) |
| **Alerts empty** | — | Title + hint + webhook CTA |
| **Functional, not illustrative** | Vercel: empty deploy shows exact `git push` command, not cartoon | Copy-paste blocks for DSN/SDK; monospace for commands |
| **Distinguish healthy vs unwired** | Highlight pre-auto-resolve: hundreds of stale errors felt broken | `setup_complete` flag gates "all clear" copy vs "still listening" |

**Empty state law (charter + QA):** No mascot, confetti, or celebratory copy. Title + hint + optional action.

### 5.2 Loading states — skeleton over spinner

| Context | Polished pattern | Epure pattern |
|---------|------------------|---------------|
| **Issue list fetch** | Vercel: skeleton screens preserve layout | `IssueRowSkeleton` × N — same row height as loaded state |
| **Issue detail** | Linear: content area skeleton, chrome stable | Overview skeleton; tabs remain clickable |
| **Stat bar** | Plausible: numbers may lag graph slightly | Skeleton numerals or `—` until fetch; avoid layout shift |
| **First-event poll** | Plausible: pulsating indicator in banner only | Calm "Listening for first exception…" in banner — not list cosplay |
| **Command palette search** | Raycast/Linear: async results stream; lightweight loading | Debounced issue search; no blocking modal spinner |

**Loading principle:** Preserve spatial layout — users should know *where* data will appear. Spinners in the center of a blank page feel broken.

### 5.3 Error states — symptom-first, actionable

| Context | Peer reference | Epure pattern |
|-------|---------------|---------------|
| **Ingest failure** | Plausible troubleshooting checklist | Symptom headers: "No events yet?" → DSN wrong / firewall / SDK init |
| **API error** | Vercel: inline error with retry | Toast + retry on list fetch; don't wipe existing rows |
| **Auth expired** | Standard | Redirect to login with return path |
| **Rate limited** | — | Fair-use banner (`fair-use-banner.tsx`) — left accent, plain copy |
| **Verification failed** | Plausible: banner resolves to actionable failure | Connection banner: red accent + checklist link |

**Error principle:** Tell users what they're seeing and the *one next action* — not error codes on the default surface.

---

## 6. Candidate patterns table for Epure

Concrete patterns mapped to screens. Token names only; visuals per `web/design/tokens.css` and [qa.md](../../../web/design/qa.md).

### Cross-cutting polish

| Pattern | Peer source | Screen | Implementation sketch | Priority |
|---------|-------------|--------|----------------------|----------|
| Task-first contrast | Linear refresh | All | Content ink = primary; chrome ink = muted; accent < 10% list pixels | P0 |
| No box-shadow cards | Vercel Geist / Epure QA | All | Structure via 1px borders + spacing only | P0 |
| Optimistic triage | Vercel | Issues | Resolve/ignore updates row before refetch | P0 |
| Contextual shortcut hints | Linear | Issues detail | Delayed tooltip on action buttons with `Kbd` | P1 |
| Frecency in palette | Raycast | Shell | Recent issues + recent routes at top of `⌘K` | P1 |

### Setup & first-run

| Pattern | Peer source | Screen | Implementation sketch | Priority |
|---------|-------------|--------|----------------------|----------|
| Horizontal progress | Plausible | `/setup` | 3-step strip: Project → DSN → First event | P0 |
| SDK branch picker | Plausible installation type | `/setup` | Node / Browser / Python / curl tabs change snippet | P0 |
| Dashboard opens immediately | Plausible | Issues | No gate overlay; checklist card in content | P0 |
| Live verification banner | Plausible | Issues | Poll ingest; "Listening…" → "Connected" | P0 |
| Auto-complete checklist | Rollbar Welcome card | Issues | Step ticks when event ingested | P0 |
| Functional empty copy | Vercel | Issues | `CodeBlock` + copy button; not illustration | P0 |

### Issues home

| Pattern | Peer source | Screen | Implementation sketch | Priority |
|---------|-------------|--------|----------------------|----------|
| Stat bar (3 numbers) | Plausible top metrics | Issues | Unresolved · This week · Regressions — tabular mono | P0 |
| Two-line scannable rows | Sentry stream (trimmed) | Issues | Title + level · count · env · release; last seen right | P0 |
| Click-to-filter chips | Plausible | Issues | Row meta click → filter chip + URL update | P0 |
| Filter door | Plausible | Issues | Button opens panel; chips summarize active filters | P0 |
| Plain default filter | Plausible | Issues | "Unresolved" chip, not `is:unresolved` | P0 |
| `Esc` clears filters | Plausible (#5037) | Issues | Clear filters; don't fight modal close | P0 |
| Skeleton list | Vercel | Issues | `IssueRowSkeleton` preserves layout | P0 |
| Healthy vs unwired empty | Bugsink + Highlight | Issues | Two empty copy paths gated on `setup_complete` | P0 |
| No query bar hero | Anti-Sentry | Issues | Remove always-visible query input from filter row | P0 |
| Select mode hidden | Linear | Issues | Bulk bar only after `x` or checkbox intent | P1 |

### Issue detail

| Pattern | Peer source | Screen | Implementation sketch | Priority |
|---------|-------------|--------|----------------------|----------|
| Tab disclosure | Epure charter (anti-Sentry scroll) | Detail | Overview · Stack · Breadcrumbs · More | P0 |
| Resolve above fold | Sentry header (trimmed) | Overview | Mark resolved / Ignore without scroll (J3) | P0 |
| Stack hero surface | Bugsink | Stack | In-app frame highlight; vendor collapse | P0 |
| Breadcrumb preview + drawer | Sentry 2024 | Breadcrumbs | ~5–10 inline; "View all" drawer — no nested scroll | P0 |
| No keyboard strip in header | Anti-Sentry / charter | Detail | Remove permanent `Kbd` row; use `?` | P0 |
| `j/k` list nav | Highlight / Linear | Detail + list | Navigate list from detail pane | P1 |
| Noise reduction settings | Highlight auto-resolve | Settings | Auto-resolve stale issues (P3); extension filter N/A | P2 |

### Shell & power

| Pattern | Peer source | Screen | Implementation sketch | Priority |
|---------|-------------|--------|----------------------|----------|
| `⌘K` not promoted | Linear / charter | Shell | Icon in top strip; no first-run modal | P0 |
| Collapsible rail | Vercel sidebar | Shell | Optional future; rail already narrow | P2 |
| Command groups | Raycast | Palette | Navigate / Triage / Settings sections | P1 |
| Project switcher gated | Plausible pinning | Shell | Static label until 2+ projects | P0 |

### Refuse list (peers that look polished but wrong for Epure)

| Pattern | Source | Why refuse |
|---------|--------|------------|
| Dashboard card grid | Rollbar, Better Stack templates | Analytics home; violates "list is home" |
| Session replay on errors | Highlight | Constitution forbid |
| SQL dashboard builder | Better Stack | P3+ scope; not exception triage |
| Geist/clone aesthetic | Vercel | Signal Room is law |
| Realtime pulsating dot | Plausible | Too analytics-coded for exceptions |
| Full-width tab bar | Old Linear | Use compact tabs |
| Promoted shortcut cheat sheet | Honeybadger | Charter refuse |
| Multi-product observability nav | Better Stack | Epure = exception-only |

---

## Principles

1. **Density without noise** — rich information, receding chrome; task content wins contrast.
2. **Rhythm over variety** — same vertical order (stats → filters → list) on every visit; fixed row height.
3. **Click teaches, syntax rewards** — P1 learns by clicking; P3 earns query syntax behind Filter.
4. **Speed is polish** — optimistic updates, skeleton loading, <100ms palette response; no blocking spinners.
5. **States instruct** — empty/loading/error copy names the situation and one next action; no mascots.
6. **Power on demand** — keyboard, palette, bulk, merge behind doors; never default chrome.
7. **Plausible pacing, Sentry depth** — emotional calm of analytics simplicity; debug rigor in Stack/Breadcrumbs.
8. **Signal Room visuals** — steal interaction grammar from peers, not their palettes or shadows.

---

## Anti-patterns

| Anti-pattern | Seen in | Why it fails Epure |
|--------------|---------|-------------------|
| Query bar as hero | Sentry, Honeybadger, Rollbar | Fails J2 five-second scan |
| Dashboard cards as home | Rollbar, Better Stack | Answers volume, not "what broke?" |
| Seven-column table | Sentry | Analytics framing; overwhelming P1 |
| Infinite scroll detail | Sentry streamline | Fails J3 one-screen triage |
| Permanent keyboard legend | Sentry, current Epure detail | Charter refuse; visual noise |
| Mascot / illustration empty states | Generic SaaS | QA fail |
| Gate screen before dashboard | Some onboarding wizards | Plausible opens dashboard and listens |
| Blank table, no copy | GlitchTip secondary modules | User thinks loading or broken |
| Nested scroll regions | Sentry pre-2024 | Spatial disorientation |
| Geist clone aesthetics | Vercel imitators | Signal Room identity |
| Observability breadth UI | Better Stack, Highlight | Scope creep beyond exceptions |
| Realtime green dot cosplay | Plausible | Wrong emotional register for errors |
| Implying zero = healthy before setup | Several peers | Must distinguish unwired vs all clear |
| Box-shadow card elevation | Generic shadcn | QA fail; use hairlines |

---

## References

### Workspace
- [charter.md](../charter.md)
- [plausible-patterns.md](./plausible-patterns.md)
- [sentry-ia-borrow.md](./sentry-ia-borrow.md)
- [peers-small-monitoring.md](./peers-small-monitoring.md)
- [component-inventory.md](./component-inventory.md)
- [web/design/qa.md](../../../web/design/qa.md)
- [business/THESIS.md](../../../../business/THESIS.md)

### Peers — product & design writing
- Plausible guided tour: https://plausible.io/docs/guided-tour
- Plausible filters: https://plausible.io/docs/filters-segments
- Plausible troubleshooting: https://plausible.io/docs/troubleshoot-integration
- Linear design refresh: https://linear.app/now/behind-the-latest-design-refresh
- Linear invisible details (contextual menus): https://linear.app/now/invisible-details
- Linear UI redesign part II: https://linear.app/now/how-we-redesigned-the-linear-ui
- Raycast Search Bar / Action Panel: https://manual.raycast.com/search-bar
- Vercel dashboard navigation changelog: https://vercel.com/changelog/dashboard-navigation-redesign-rollout
- Geist design system: https://vercel.com/geist/introduction
- Highlight error management UI: https://www.highlight.io/blog/new-error-management-ui
- Highlight noise reduction (auto-resolve): https://www.highlight.io/blog/error-monitoring-launch-week-2-new-features
- Command palette patterns: https://www.designsystems.one/design-systems/patterns/search-and-command

---

*Research only. No implementation. Next: fold candidate patterns into spec/plan during `/speckit-converge` or design wireframes.*
