# Metrics, graphs, grouping & layout — final verdict

**Status:** Ratified research (2026-09-13) — swarm complete  
**Inputs:** [charter.md](../charter.md) · [issue-surface-spec.md](./issue-surface-spec.md) · [tab-debate.md](./tab-debate.md) · [plausible-patterns.md](./plausible-patterns.md)

**Specialists:** [Chart policy](ea05650f-d8a0-4ff1-b2ae-14f86145e609) · [Category grouping](7d7c90c7-62e1-4e11-afa1-544383c2659d) · [FEATURES scope guard](d0bdc123-93f4-4057-915a-8a8f9f6dcdb6) · [Plausible layout](2da84289-dc63-4d63-bc05-7ce52ccffb6d) · [Moderator](75f10d01-73b0-4c2a-a6e9-81973703287f)

---

## Executive verdict

**Your bets hold.** Graphs on Issues home are vanity — **list + stat bar is enough**. **Category grouping** (Auth/Payments/UI) is the bigger differentiator — but only as **click-to-filter chips + optional ranked strip (Phase 1b)**, never as charts or sidebar facets. **Beauty = restraint:** numbers answer "how much?"; rows answer "what broke?"; breadcrumbs answer "what led here?" — not log aggregation.

**Phase 1 chart budget: zero pixels by default.** No chart library on home.

---

## 1. Metrics manifest

| Metric | Issues home | Issue row | Overview | Releases | Alerts |
|--------|-------------|-----------|----------|----------|--------|
| Unresolved count | Stat (clickable) | — | — | — | — |
| Events (7d) | Stat (**not clickable** — time window scopes list) | — | — | — | — |
| Regressions | Stat (clickable) | Badge "Came back" | Regression copy + text strip | Delta counts | Fired rows |
| Event count (issue) | — | Meta `N events` | Subtitle | Per-release counts | — |
| Unique users | — | Meta if >1 | Subtitle + user row | — | In alert row |
| Last seen | — | Right meta (relative) | Subtitle | — | Timestamp |
| Level / env / release | — | Meta chips | `dl` | Version | — |
| Area (Auth/UI/…) | Strip 1b | Chip if confident | More read-only | — | — |

**Not on stat bar:** users affected (7d), error rate, trend deltas — compete with Events (7d).

---

## 2. Chart policy

| Surface | Charts? | Phase 1 |
|---------|---------|---------|
| Issues home | **No** | Stat bar + list only |
| Issue row sparkline | **No** | Refuse |
| Overview | **No** | J3 — resolve above fold |
| Stack / Breadcrumbs | **No** | Lists are the visualization |
| More | Text deltas only; optional sparkline expand | **Defer P3** |
| Releases | Count deltas as text | List, not graph |
| Alerts | Percent delta in copy | `+340% vs prior 15m` text |

**Proof gate for any future chart (J6):** Must pass *"What broke?" in 5s without scrolling past a chart"* and must not duplicate stat bar.

**Rule:** Graph only when **time is the decision variable** — Phase 1 routes spikes to **Alerts**, period compare to **Filter + stat clicks**.

---

## 3. Category / grouping policy

| Surface | Verdict | Phase |
|---------|---------|-------|
| Filter chip (`Payments`, `Auth`, …) | **Primary** | 1b |
| Home "By area" ranked strip | **Secondary** — issue counts, zeros hidden | 1b |
| Row chip | **Tertiary** — only when confident | 1b |
| Sidebar facet | **Refuse** | — |
| Graph by area | **Refuse** | — |
| Rail tab per area | **Refuse** | — |

**Default:** uncategorized — silence beats wrong label.

**Tension with scope guard:** FEATURES Tier 2 grouping = fingerprint/stack, not product domains. **Resolution:** area heuristics are a **display lens on existing signals** (path, tags, frames) — not a new grouping engine. Ship only after seed-fixture validation + J2 re-test. SDK `tags.area` overrides heuristics.

**Interaction:** click area → filter chip (Plausible click-to-filter); `Esc` clears.

---

## 4. Layout zones (Plausible-shaped)

### Issues home — target vertical order

```
Z0  TopStrip (env · project · Connect · ⌘K)
Z1  Connection banner (first-run / stale only) — merge setup checklist here after DSN
Z2  Page header band — ONE row: stats left | chips + [time window▾] + [sort▾] + [Filter] right *(shipped)*
Z3  By area strip (Phase 1b, ≥2 buckets)
Z4  Regression strip (optional — regressions > 0 or post-deploy)
Z5  Master-detail row
    Z5a  Issue list (28–32rem, two-line rows)
    Z5b  Detail pane (hidden until row selected; min 480px)
```

**Plausible borrow:** unified Z2 control row (context left, filters right) → ranked list → drill. **≤120px** from content top to first list row (currently ~240–280px — too tall).

**First-run:** single column — no master-detail, no zero stat bar, centered empty.

**Current gap ([Plausible layout](2da84289-dc63-4d63-bc05-7ce52ccffb6d)):** FilterPanel trapped in 20rem list column; dead detail pane when nothing selected; `text-3xl` stat hero scale.

### Issue detail — target order

```
Z0  Tab bar — Overview · Stack · Breadcrumbs · More
Z1  Overview header: title + subtitle | [Resolve][Ignore][Snooze] right (≥768px)
Z2  dl grid (env, release, user)
Z3  Regression/spike text strip (conditional, not graph)
Z4  Tab body (Stack: occurrence picker → CodeBlock; etc.)
Z5  Keyboard hints — collapsed `?` only, not permanent footer band
```

**Filter position:** inside Z2 page header band — **not** inside list column sidebar.

---

## 5. "What changed lately" — no vanity charts

| Pattern | When | Widget |
|---------|------|--------|
| **A — Regression strip** | Post-deploy or regressions > 0 | Text rows above list |
| **B — Release delta list** | Releases rail default | `+2 came back · +1 new` per version |
| **C — Velocity callouts** | Alerts tab + optional dismissible banner | `+340% vs prior 15m` text |

**Default home:** clickable **Regressions** stat + **Came back** filter — no strip until A/C triggers.

---

## 6. Logs request — refuse + redirect

**Refuse:** generic log ingestion (FEATURES anti-feature, constitution I).

**Copy:**

> Epure tracks **exceptions**, not log streams. For what happened before the crash, open **Breadcrumbs** — HTTP, console, navigation, and errors on the path to the failure.

**Do not** label Breadcrumbs tab "Logs" — sets false Phase 2 expectation.

**Substitutes:** Breadcrumbs tab · HTTP/console filters · occurrence diff · LLM export (stack + crumbs).

---

## 7. Steal / refuse

| Steal | Refuse |
|-------|--------|
| Plausible headline stats + date preset | Hero time-series on home |
| Click stat/chip → filter | Chart dashboard as home |
| Ranked "By area" strip (1b) | Category sidebar (Sentry) |
| Two-line issue rows | Row trend sparklines |
| Breadcrumb timeline | Logs tab / log tail |
| Release delta counts (text) | Pie charts / card zoo |
| Alert rows with % delta | Realtime pulsating dot |
| Users in row meta | Users graph |

---

## 8. Implementation slices

### Metrics & grouping

| Slice | Scope | Proof | Status |
|-------|-------|-------|--------|
| **M1** | Expose `unique_user_count` on `IssueSummary` API | Row meta `N events · M users` | **done** (D9) |
| **M2** | Row v2 + relative time + Came back badge | J2 scan | **done** (D9) |
| **M3** | Overview regression text strip (not graph) | J3 one-screen triage | **partial** — home `RegressionStrip`, Overview copy, dismissible no-chart hint |
| **M4** | Release delta counts on Releases rail | P2 migrant | **done** (D13) |
| **M5** | Area heuristics backend + Filter chips (80% seed gate) | Seed fixtures pass | |
| **M6** | By area ranked strip (Phase 1b) | J2 re-test with fresh user | |
| **M7** | Breadcrumbs drawer + logs redirect copy | Tier 4 breadcrumb filter | **done** (D12) |

### Layout (Plausible positioning)

| Slice | Scope | Proof | Status |
|-------|-------|-------|--------|
| **L1** | Unify Z2: move FilterPanel to page header band (stats left, filters right) | 5s scan to filters | **done** (D8) |
| **L2** | Single-column empty/first-run; hide detail until selection | No dead right pane | **done** (D8) |
| **L3** | Overview actions header-right; demote keyboard footer to `?` | J3 | **done** (D15 I2) |
| **L4** | Widen list to 28–32rem; two-line rows | J2 row readability | **done** (D10) |
| **L5** | Mobile `<1024px`: list-only → full-screen detail + back | Charter mobile table | **done** — back button + Esc; L4 list width shipped |

**Optional G:** CSS-only release compare bars on Releases rail (Phase 1b) — requires A/B proof vs text deltas.

**Explicitly not in slices:** chart library, logs rail, home graphs, Events (7d) stat click.

---

## 9. Dissent log

| Dissent | Resolution |
|---------|------------|
| User wants graphs like Plausible traffic graph | Plausible graph = wrong domain; steal numbers only |
| Category grouping forbidden by FEATURES | Heuristic display lens on tags/stack — not new grouping engine; 1b after proof |
| P1: area strip is noise | Gate strip behind ≥2 buckets + J2; P1 launch without area chrome |
| Scope guard: no domain taxonomy | SDK tags + optional heuristics; never mandatory labels |
| Sentry event graph on detail | Refuse default; text deltas in More for P3 |
| Fourth stat: "Users affected (7d)" | Refuse — blurs Events (7d); per-issue users on row instead |
| Events (7d) stat clickable | Refuse — time window scopes list; clicking aggregate confuses P1 |
| Filters in list sidebar | Move to Z2 header band per Plausible layout audit |
| Permanent keyboard footer | Collapse to `?` toggle |

---

## 10. FEATURES.md compliance (summary)

From [FEATURES scope guard](d0bdc123-93f4-4057-915a-8a8f9f6dcdb6):

| Ask | Phase 1 |
|-----|---------|
| Errors graph | **Forbidden** on home |
| Generic logs | **Forbidden** — breadcrumbs only |
| Users count | **Allowed** — scalar per issue (M1 API gap) |
| Users graph | **Forbidden** |
| Domain taxonomy UI | **Phase 1b** only as display lens on tags/stack — needs product sign-off vs FEATURES row |
| Occurrence counts | **Allowed** — row, Overview, stat bar |
| Layout positioning | **Allowed** — charter IA fixed |

---

## Challenge to user bets

| Bet | Verdict |
|-----|---------|
| Home graphs are vanity | **Correct** — use Options A/B/C (text, not charts) |
| Category > another chart type | **Correct** — but Phase 1b, trust-gated, not day-one |
| Beauty = restraint | **Correct** — chart library forbidden in 002 tasks |

**Where you're slightly wrong:** "impacted users" still matters — as **scalar on row/Overview**, not a graph. FEATURES Tier 3 requires it; API gap is exposure only (M1).

**Refinement:** restraint ≠ austerity — clickable Regressions, relative timestamps, and snooze on Overview are purposeful warmth without charts.

---

## Next

**Shipped:** L1–L5, M1–M4, M7, D8–D15 (Issues home, detail Overview, Releases/Alerts rails, breadcrumbs drawer, More tab, list width 30rem). D11 area heuristics **skipped** (80% seed gate).

**Up next:** D11 when gate passes; Slice F mobile polish; D7 `DASHBOARD.md` / J5 QA.

**Detail-only chart exception:** SVG line chart on issue Overview (I5, hover tooltips); home chart budget remains zero.
