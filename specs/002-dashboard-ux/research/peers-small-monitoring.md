# Peer UX — small error monitoring tools

**Scope:** GlitchTip, Bugsink, Honeybadger, Rollbar — onboarding and home-screen patterns for small teams.  
**Lens:** Epure charter — *Plausible for error tracking* (P1 indie dev, no Sentry muscle memory).  
**Date:** 2026-09-12

Sources: product docs, quickstarts, changelogs, marketing tours. No live UI audit in this pass.

---

## Executive comparison

| Dimension | GlitchTip | Bugsink | Honeybadger | Rollbar |
|-----------|-----------|---------|-------------|---------|
| **Positioning** | OSS Sentry clone (self-host) | Lightweight Sentry-compatible backend | Developer-first commercial tracker | Enterprise-leaning real-time tracker |
| **First-run home** | Org → project → Issues (setup on Issues page) | Login → Teams → Projects → connect flow | Account → project → error index | Card dashboard (Welcome + Occurrences) |
| **Setup location** | Issues page + project settings | Post-project “Connect your Application” | Project Settings (install docs) | Welcome card checklist + project settings |
| **Empty-state quality** | SDK instructions on Issues; sparse elsewhere | Explicit empty Teams/Projects pages; connect CTA after project | Docs-first; dashboard assumes errors exist | Welcome card explains zero ≠ broken |
| **Issue list home** | Issues (Sentry-shaped) | Project issue list → global list (v2.5+) | Error index (search-forward) | Item List (filter sidebar, saved views) |
| **Plain language** | Sentry vocabulary (issues, DSN) | Plain (“Connect your Application”) | Mixed (“faults” in API, “errors” in UI) | Rollbar jargon (items, occurrences, activations) |
| **Best for Epure to learn from** | In-app SDK block on destination screen | Short post-install ritual; stacktrace-first detail | CLI sends test exception on install | Auto-completing checklist; explicit test-error guidance |
| **Worst for Plausible-shaped Epure** | Org/admin ceremony; Sentry IA inheritance | Multi-hop Teams → Projects before DSN | Search box as primary surface; dense detail page | Dashboard-as-home; card zoo; query-first Item List |

---

## GlitchTip

**Audience:** Self-hosters wanting Sentry compatibility without Sentry ops.

### First-run setup

1. Register admin (or sign up on hosted).
2. Create **organization** (may be gated by `ENABLE_ORGANIZATION_CREATION`).
3. Create **project** with platform selection (Python, JS, etc.).
4. Land on **Issues** — DSN visible; platform-specific SDK instructions inline.
5. Docs recommend triggering a test error, returning to Issues to confirm.

Setup is **in-app on the Issues page**, not buried in README — a strong pattern. Weakness: org/project hierarchy appears before the user has a reason to care; platform must be chosen (or revisited in settings) before instructions render.

### Empty states

- **Issues (no events):** SDK install steps + DSN — functional empty state, not decorative.
- **Uptime and secondary modules:** can feel like blank Sentry modules if unused.
- No horizontal progress ritual; user infers “am I done?” from whether rows appear.

### Issue list clarity

- Classic Sentry issue list: grouped errors, familiar to migrants, opaque to P1.
- Platform docs and DSN live on the same surface as the list — good for J1, noisy once populated.
- Terminology: *issues*, *events*, *DSN* — assumes Sentry literacy.

### Takeaway for Epure

GlitchTip proves **destination-screen setup** works (Issues + DSN + snippet). Copy the placement, not the org-first IA or Sentry chrome.

---

## Bugsink

**Audience:** Teams wanting Sentry SDK compatibility with less weight; strong self-host story.

### First-run setup

Documented quickstart (10 steps):

1. Login (`admin` / `admin` on fresh Docker).
2. Empty **Teams** page → “New Team” (skippable on some installs).
3. Navigate to **Projects** → “New Project”.
4. **Connect your Application** panel: install SDK, copy DSN, trigger error on purpose.
5. Issue appears on project page → explore stacktrace → Resolve.

Marketing claim: *docker compose up + one env line* — setup **outside** the UI is fast; **inside** the UI still requires 2–3 navigation hops before DSN.

### Empty states

- Empty Teams and Projects pages with top-right **New** buttons — minimal copy, action-oriented.
- Post-project connect instructions are the best empty state in this peer set.
- Changelog: when issue counts are expensive to compute, show **“many issues”** instead of looking empty — honest degradation.
- Changelog: **“This might mean”** helper text tied to “No open issues” — contextual interpretation of empty (healthy vs not wired).

### Issue list clarity

- **Stacktrace-first** detail: frames, locals, in-app vs library separation at top of page.
- Project list sortable by **recent** or **lifetime event count** — impact-first triage.
- **Global issue list** (cross-project) with state filters and bulk actions; tag search deliberately project-scoped only.
- Home is still **project-centric**; global list is a triage addition, not a Plausible-style single home.

### Takeaway for Epure

Steal: **connect panel immediately after project creation**, **plain-language empty copy** (“no open issues” + what that might mean), **sort by impact**. Refuse: Teams-before-DSN ceremony on single-tenant OSS installs.

---

## Honeybadger

**Audience:** Bootstrapped-commercial; Ruby/JS-heavy; power users who live in search.

### First-run setup

1. Create account and project.
2. **Project Settings** hosts platform-specific install instructions.
3. Ruby path: `bundle exec honeybadger install API_KEY` — **sends a test exception automatically** (excellent J1 affordance).
4. Other platforms: manual configure + optional test notify; dev/test environments suppressed by default (common footgun).

No dedicated onboarding wizard; success = first fault appears in error index. Install intelligence is split between **CLI** (Ruby) and **docs** (everything else).

### Empty states

- Marketing tour shows a **populated** error detail page — aspirational, not empty-state design.
- Pre-data experience is thin: user is expected to read Project Settings and return.
- Troubleshooting docs are thorough (`HONEYBADGER_DEBUG`, env suppression) — signals empty dashboard is a common support topic.

### Issue list clarity

- **Error index** with search box, query builder, saved searches, pinned default search.
- Keyboard shortcuts (`/`, `u`, `r`, `m`, `j`) — power-user affordances on by default in docs.
- Cross-project search — great for agencies, adds cognitive load for solo dev.
- Detail page is **dense**: occurrences nav, actions rail, notices chart, comments, context, integrations — docs admit *“looks a little complicated.”*
- Strength: enhanced backtrace, breadcrumbs narrative, “open in editor” — depth for P3.

### Takeaway for Epure

Steal: **test exception on install** (map to optional “send test error” step). Refuse: search-as-home, shortcut-heavy first run, detail page everything-at-once (Epure tabs + Overview-first per charter).

---

## Rollbar

**Audience:** Teams wanting dashboards, integrations, and occurrence analytics at account scale.

### First-run setup

1. Sign up → create project (pick platform).
2. **Dashboard** (not Item List) is default home.
3. **Welcome card**: checklist (integrate app, invite team, notifications, source control, deploys) — **auto-completes** when integration tasks finish; dismissible per-hint.
4. Docs stress: empty dashboard ≠ broken monitoring — **fire a test error on purpose** (JS quickstart ends with console test).
5. Projects card marks **incomplete setup**; click → Project Settings.

Setup is **distributed** across Welcome card, project settings, and docs — stronger than Honeybadger, weaker than a single linear ritual.

### Empty states

- Welcome card directly addresses the “staring at zero” problem — best explicit empty-state **education** in this set.
- Occurrence card charts can show empty graphs — mitigated by Welcome card and project setup badges.
- Card-based dashboard is customizable (show/hide cards) — power for P3, noise for P1.

### Issue list clarity

- **Item List** (2023+ redesign): filter sidebar, applied-filter chips, multi-owner filter, auto-refresh, page size, bulk select-all across filter results.
- **Search** indexes custom fields; saved views for complex queries — Sentry/Rollbar power-user territory.
- Terminology: *items*, *occurrences*, *activations* — steeper than “unresolved issues.”
- Dashboard → Item List is two mental models; home is analytics, triage is secondary navigation.

### Takeaway for Epure

Steal: **checklist with auto-completion**, **“zero events is normal until you test”** copy, **incomplete-project badge**. Refuse: dashboard-as-home, card zoo, item/occurrence vocabulary, filter sidebar as default chrome.

---

## Cross-peer themes

### What small tools get right

1. **DSN/API key near the code** — setup instructions on or adjacent to the screen that will show the first row.
2. **Deliberate test error** — docs and CLIs treat “trigger once on purpose” as part of onboarding, not failure.
3. **Grouped list as triage home** — once data exists, a scannable table beats a chart dashboard for “what broke?”
4. **Self-host fast path** — Docker one-liner gets server up; UI ritual is still the bottleneck Epure must compress.

### What small tools inherit from Sentry (or Rollbar)

1. **Org/team/project ladders** before first value.
2. **Query/filter vocabulary** on the default surface.
3. **Dashboard or card layouts** that answer “how much?” before “what?”
4. **Platform picker gates** instructions — extra step when user already knows their stack.

### Plausible-shaped gap (Epure opportunity)

None of the four peers offer a **single linear in-app ritual** with:

- horizontal progress (project → DSN → verify → ✓),
- **live verification** (Plausible-style banner / websocket wait for first event),
- **Issues home** as the only post-setup destination,
- **plain labels** on the default view (unresolved, last seen, environment),
- **stat bar** (3 numbers) above the list without a separate dashboard.

Epure’s charter already names this gap; peers validate individual ingredients but not the combined recipe.

---

## Principles

1. **First value beats hierarchy** — minimize steps between login and copyable DSN; defer org/team concepts until multi-user need exists.
2. **The list is the home** — after setup, unresolved issues + essential counts tell the story; dashboards and cards are optional depth.
3. **Empty means “not wired yet,” not “broken”** — every pre-data screen states what will appear and the one action to get there.
4. **Verify, don’t hope** — explicit first-event confirmation (live wait or checklist tick) closes the loop; optional test-error helper reduces support burden.
5. **Plain words on the default surface** — reserve query syntax, items/occurrences/faults vocabulary for Filter and docs.
6. **Setup lives where success is visible** — DSN + snippet on the same route as the first issue row (GlitchTip/Bugsink pattern, tightened).
7. **Depth on demand** — stacktrace-first detail (Bugsink) and rich actions (Honeybadger) belong behind tabs, not on first paint.
8. **Honest empty semantics** — distinguish “no open issues” (healthy) from “no events received” (incomplete setup); never show a blank table without copy.

---

## Anti-patterns

*For Plausible-shaped Epure — avoid even if peers do them.*

| Anti-pattern | Seen in | Why refuse |
|--------------|---------|------------|
| Org → team → project before DSN | GlitchTip, Bugsink | P1 wants Docker → DSN → crash, not admin structure |
| Dashboard/cards as default home | Rollbar | Charts answer volume, not “what do I fix?”; violates J2 five-second scan |
| Search/query box as hero | Honeybadger, Rollbar | P1 fails J2 (`is:unresolved` confusion); query belongs behind Filter |
| Sentry vocabulary as default | GlitchTip, Rollbar | “Items,” “activations,” “DSN” without gloss — migrants OK, P1 not |
| Blank modules with no CTA | GlitchTip (secondary features) | NN/g empty-state failure: user thinks loading or error |
| Setup only in Project Settings / README | Honeybadger | Fails J1 without README |
| Dense detail page on first click | Honeybadger | Fails J3; resolve/ignore must be visible without scrolling past advanced panels |
| Platform picker blocking instructions | GlitchTip | Friction before copy-paste; default to generic snippet + optional platform tabs |
| Keyboard shortcut docs in primary path | Honeybadger | P3 yes; promoting on first run adds chrome Epure charter refuses |
| Card zoo + customize dashboard | Rollbar | Cognitive load for solo dev; no parallel in Plausible |
| Forking GlitchTip/Bugsink UI wholesale | OSS peers | Charter explicit refuse; borrow patterns, not layouts |
| Mascot / illustration empty states | Generic SaaS | Charter refuse; calm copy + one CTA instead |
| Implying zero rows = healthy without setup context | Rollbar (partially fixed), others | Must gate “all clear” on setup-complete flag |

---

## Candidate patterns for Epure

Mapped to charter IA and publish journeys (J1–J3).

### Setup ritual (`/setup` or first-run overlay until J1)

| Step | Peer inspiration | Epure shape |
|------|------------------|-------------|
| 1. Project name | Bugsink (single form) | One field; hide project switcher until second project |
| 2. Copy DSN | GlitchTip Issues inline, Bugsink connect panel | Copy button + generic SDK snippet; platform tabs optional |
| 3. Send test error | Honeybadger CLI test notify, Rollbar console test | Optional curl/SDK helper; link, not required reading |
| 4. ✓ First issue seen | Plausible live verification | Websocket/poll banner: “Waiting for first event…” + skip to Issues |

**Auto-complete** checklist ticks when event ingested (Rollbar Welcome card pattern).

### Issues home (default post-setup)

| Element | Peer inspiration | Epure shape |
|---------|------------------|-------------|
| Stat bar | Plausible top metrics | Unresolved · events (7d) · regressions — three numbers max |
| List default | Bugsink sort by impact | Unresolved, sorted by last seen; toggle frequent/impact in Filter |
| Empty (setup incomplete) | Bugsink connect + Plausible banner | Setup CTA, DSN visible, no fake rows |
| Empty (setup complete, zero open) | Bugsink “no open issues” copy | Positive copy: “No unresolved issues” + link to resolved/archive |
| Row density | Sentry/GlitchTip | Message, last seen, env, count — scannable without query training |

### Issue detail (J3)

| Element | Peer inspiration | Epure shape |
|---------|------------------|-------------|
| Overview tab default | Inverse of Honeybadger density | Title, status, last seen, env, Resolve/Ignore above fold |
| Stack tab | Bugsink stacktrace-first | Demangled frames; locals when present |
| Breadcrumbs / More | Honeybadger, Sentry | Behind tabs; not on Overview |

### Power features (J4 — behind doors)

| Feature | Peer | Epure placement |
|---------|------|-----------------|
| Query syntax | Honeybadger, Rollbar | Filter panel |
| Saved views | Rollbar, Honeybadger | Filter → save |
| Global cross-project list | Bugsink | Defer until multi-project; env/project in top bar |
| Bulk merge/select | Rollbar, Honeybadger | Select mode, not default |
| Keyboard nav | Honeybadger, Linear charter | `j/k`, `?` on demand |

### Copy cheatsheet (P1-facing)

| Peer term | Epure term |
|-----------|------------|
| Item / fault | Issue |
| Occurrence / notice | Event |
| DSN | DSN (with one-line gloss: “connection string for your SDK”) |
| Activations | New issues (or hide metric until user opts in) |
| Unresolved / resolved | Unresolved / Resolved (plain) |

---

## Sources

- [GlitchTip error tracking docs](https://glitchtip.com/documentation/error-tracking)
- [GlitchTip SDK docs](https://glitchtip.com/sdkdocs)
- [Bugsink quickstart](https://www.bugsink.com/docs/quickstart/)
- [Bugsink error tracking tour](https://www.bugsink.com/error-tracking/)
- [Bugsink CHANGELOG 2.5.0](https://github.com/bugsink/bugsink/blob/2.5.0/CHANGELOG.md)
- [Honeybadger error monitoring guide](https://docs.honeybadger.io/guides/errors/)
- [Honeybadger error search](https://docs.honeybadger.io/guides/errors/search/)
- [Rollbar dashboard docs](https://docs.rollbar.com/docs/dashboard)
- [Rollbar setup guide](https://docs.rollbar.com/docs/setup)
- [Plausible snippet verification](https://plausible.io/docs/troubleshoot-integration) (contrast reference for Epure charter)
