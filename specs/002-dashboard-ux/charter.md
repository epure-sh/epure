# 002-dashboard-ux — Charter

**Status:** Approved direction (2026-09-12)  
**Blocks:** Phase 1 public publish ([PUBLISH.md](../../PUBLISH.md))  
**Supersedes (partially):** `design/DASHBOARD.md` thesis — update that file when spec is ratified

---

## One-liner

**Plausible for error tracking** — solo devs and small SaaS teams connect a DSN, see the first exception, understand what broke. No manual, no query training, no Sentry muscle memory required. Sentry migrants relearn in minutes because the product is simpler, not because we cloned their UI.

---

## North star

| Reference | Take |
|-----------|------|
| **Plausible Analytics** | Simplicity, guided setup, one obvious home, plain language, click-to-drill, advanced behind a door |
| **Sentry** | Borrow *structure* where it helps (issue list, stack frames, breadcrumbs) — not query-bar-first IA |
| **Linear** | Keyboard and speed for power users — discoverable, never default chrome |

Visual law unchanged: [design/VERDICT.md](../../../../design/VERDICT.md) · [tokens.css](../../../../design/tokens.css) · no stock shadcn theme · no hex in JSX.

---

## Personas (ranked)

### P1 — Primary: Plausible-shaped builder

- Solo dev, indie hacker, or small SaaS team (1–10 engineers)
- May **never** have used Sentry; may have used `console.log`, Discord webhooks, or nothing
- Wants: Docker up → DSN in SDK → first crash visible → fix and ship
- Success feeling: *"This just works"* — same emotional bar as first Plausible pageview

### P2 — Secondary: Sentry migrant

- Used Sentry Cloud or self-hosted; knows issue/group vocabulary
- Expects: grouped issues, stack traces, resolve/ignore, releases
- **Bet:** Epure is so obvious they relearn in &lt;5 minutes without a migration guide for the UI
- We do **not** optimize for pixel-level Sentry parity or query syntax muscle memory

### P3 — Tertiary: Daily triager

- Keyboard-first, bulk actions, merge/split, diff, export
- Served via progressive disclosure (Filter, Select mode, command palette, `?` shortcuts)
- Must not regress FEATURES Tier 4–5 proofs from `001-phase-1-oss`

---

## Product thesis

1. **Home = one story** — unresolved issues and essential counts; not a feature dump.
2. **Setup = in-app ritual** — project → copy DSN → verify first event; not README archaeology.
3. **Plain labels** — "Unresolved", "Filter", "Stack" — not `is:unresolved` as the default surface.
4. **Depth on demand** — merge, diff, snooze, webhooks, query syntax behind Filter / More / Settings.
5. **One shell** — login through app uses the same calm chrome (no separate "focus" layouts).

---

## Publish gates (must pass before Show HN)

| ID | Journey | Proof |
|----|---------|-------|
| **J1** | First issue without README | Fresh login → in-app setup → copy DSN → first issue row visible |
| **J2** | Five-second scan | New user names what the Issues home is showing without explanation |
| **J3** | One-screen triage | Selected issue: message + status + resolve without scrolling past advanced panels |
| **J4** | Power regression | Filter/query, `j/k`, merge, export still work (001 FEATURES proofs) |
| **J5** | Token QA | [design/QA.md](../../../../design/QA.md) pass on reskinned screens |

---

## Steal / refuse

### Steal (patterns)

- Plausible: horizontal setup progress, copy-paste snippet block, first-hit verification
- Plausible: top summary stats + simple list + click row to drill
- Plausible: Filter button for advanced segmentation (our query syntax lives here)
- Sentry: issue row density, stack frame presentation, breadcrumb timeline
- Linear: command palette, keyboard hints on demand

### Refuse

- Sentry-default: query bar as hero, permanent keyboard cheat sheet in header
- GA4-style: report builder, chart dashboard as home
- Generic SaaS: purple gradients, stock shadcn zinc, mascot empty states
- Forking GlitchTip/Bugsink UI wholesale
- Scope creep: replay, APM, profiling UI

---

## Clarifications (2026-09-12)

| Decision | Resolution |
|----------|------------|
| **Setup surface** | **Hybrid:** `/setup` for steps 1–2 (project + copy DSN); compact checklist on Issues until first event (step 4); then dismiss |
| **Project switcher** | **Hidden until 2+ projects** — show static project name label when only one |
| **Stat bar (v1)** | **Unresolved · Events (7d) · Regressions** — plain labels, no query tokens on surface |

---

## IA target (v2)

```
Rail: Issues · Releases · Alerts · Settings
Top:  env · project label (switcher only if 2+ projects) · user
      ⌘K available, not promoted on first run

Issues home:
  Stat bar: Unresolved · Events (7d) · Regressions
  Issue list (default: unresolved only)
  [ Filter ] → chips + optional query syntax
  Compact setup checklist until J1 complete (after /setup steps 1–2)

Issue detail:
  Tabs: Overview · Stack · Breadcrumbs · More
  Resolve / Ignore primary on Overview

Setup flow:
  /setup → 1. Project name → 2. Copy DSN → redirect Issues
  Issues checklist → 3. Send test error (helper) → 4. ✓ First issue seen
```

---

## Agency / design deliverables

When engaging a designer or Stitch:

**Inputs:** this charter, `research/`, `tokens.css`, `VERDICT.md`  
**Required outputs:** wireframes for Setup, Issues home, Issue detail (tabs), Settings; component names mapped to `ui/`; all states (empty, loading, first-run, power-user)  
**Constraint:** reference token names only — no arbitrary hex in deliverables

---

## SpecKit sequence

1. Research agents → `research/*.md`
2. `/speckit-clarify` on this charter
3. `/speckit-specify` → `spec.md` ✅ (2026-09-12)
4. `/speckit-plan` → `plan.md`
5. `/speckit-tasks` → `tasks.md`
6. Implement slices; update `design/DASHBOARD.md` to match ratified spec
7. J1–J5 proofs → unblock [PUBLISH.md](../../PUBLISH.md)

---

## Research (complete)

Dossiers in [`research/`](./research/) — synthesized in next `/speckit-specify` pass.

| Dossier | Key takeaway |
|---------|----------------|
| `plausible-patterns.md` | First event = milestone; click before syntax; verify in place |
| `sentry-ia-borrow.md` | Steal row density + stack; hide query hero, tabs, graphs for P1 |
| `peers-small-monitoring.md` | Rollbar checklist + Bugsink connect panel; refuse org ladders |
| `component-inventory.md` | 6 P0 components: SetupChecklist, CopyDsnBlock, StatBar, FilterPanel, IssueDetailTabs, IssueOverviewPanel |
| `library-fit.md` | Add Radix Tabs + Popover (P0); no shadcn, no chart libs |
