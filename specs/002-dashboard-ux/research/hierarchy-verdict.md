# Visual hierarchy — swarm synthesis

**Status:** Ratified (2026-09-13) — swarm complete (4/4)  
**Inputs:** [hierarchy-color-semantics.md](./hierarchy-color-semantics.md) · [hierarchy-typography-scale.md](./hierarchy-typography-scale.md) · [hierarchy-spatial-zoning.md](./hierarchy-spatial-zoning.md) · [hierarchy-interaction-affordance.md](./hierarchy-interaction-affordance.md)

**Agents:** [Visual hierarchy color research](07bc072c-7a57-48b1-932a-a0da87be98cb) · [Typography size hierarchy research](934c4c08-b99e-4b31-a182-14cd1d6ae1f5) · [Layout structure hierarchy research](5669b5c3-9cc3-4d57-9cee-d01a2e886a39) · [Interaction affordance hierarchy research](9ab1fd18-6f76-4aed-8cd5-2f24bbef1626)

---

## Executive summary

Users can't distinguish priority because **role collapse** happens on every axis at once:

| Axis | Symptom | Fix |
|------|---------|-----|
| **Color** | Resolve = Snooze = `secondary`; `accent-muted` everywhere | One `primary` Resolve; ghost Snooze; neutral unresolved badge |
| **Type** | ~94% text at xs/sm; titles = tabs = rows | Roles: `display` → `title` → `section` → `meta` |
| **Space** | Single `surface` + hairlines only | Surface ladder + `Section` primitive |
| **Affordance** | Hover = selected = stat active | Distinct tokens per selection mode |

**Hierarchy thesis:** Answer three questions in order — *What do I do?* (one filled CTA) · *Where am I?* (surface + section label) · *What's metadata?* (xs muted mono).

---

## Ratified P0 (implement first — D17)

### Color + affordance (aligned)
1. **Resolve / Mark resolved → `variant="primary"`** (forest green fill)
2. **Snooze, Ignore, Copy for AI → `ghost`** at toolbar size
3. **Unresolved badge → neutral** — danger only for regression
4. **Row selected** — accent left edge; **bulk** — signal wash; **hover** — bg-subtle only
5. **StatBar** — static stats as `<div>`; clickable gets distinct active (not row-hover wash)
6. **Tabs** — active: semibold + underline; inactive: regular weight

### Typography
7. Unify **PageHeader / PageChrome** → `display` (text-2xl)
8. **SectionHeading** primitive — mono `text-xs uppercase tracking-wide` labels
9. **Issue detail title** → `text-xl`; list context above row title size

### Spatial
10. **`Section` + `SectionHeader`** primitive
11. **Master-detail** — list `bg-bg`, detail `bg-surface`
12. **Overview zones** — impact strip on `surface-raised` or subtle band; stack in `CodeBlock` panel (already elevated)

---

## Build slices (D17)

| Slice | Scope | Proof |
|-------|-------|-------|
| **H1** | Variant contract doc + Resolve→primary, Snooze→ghost, bulk bar | J3: Resolve obvious in 2s — **done** |
| **H2** | Row/stat/tab selection matrix | J2: selected vs hover distinct — **done** |
| **H3** | Type roles + SectionHeading + page title unify | J5 typography QA — **done** |
| **H4** | Section primitive + Overview surface ladder ([L-H2→L-H1→L-H3→L-H4](./hierarchy-spatial-zoning.md)) | J3: scan impact → stack → crumbs — **done** |
| **H5** | Dark mode pass on new selection tokens | J5 dark checklist — **done** |

**Dependency:** H1 before H2; H3 parallel H1; H4 after H3.

**Spatial sequence** ([Layout structure hierarchy research](5669b5c3-9cc3-4d57-9cee-d01a2e886a39)): L-H2 `Section` primitive → L-H1 list/detail surface split → L-H3 Overview zones → L-H4 stack inset → L-H5 title dedup.

---

## Steal / refuse

| Steal | Refuse |
|-------|--------|
| One primary CTA per band (Plausible) | Four equal toolbar buttons |
| Mono section labels (instrument) | All `text-sm font-medium` |
| Surface steps (Linear) | Hairlines-only flat plane |
| Signal for unread + setup only | Signal on every CTA |

---

## Next

**D17 shipped** (2026-09-13): H1–H5 complete. Resolve→`primary`, Snooze→`ghost`, neutral unresolved badge, row/stat/tab selection matrix, type roles (`display`/`title`/`section`/`meta`), `--state-hover`/`--state-selected` tokens with dark parity.

**L-P4 / L-H5 shipped** (2026-09-13): Back-to-list row → tabs + actions → title + badges below tab line (all viewports); Overview has no duplicate title; mobile tab overflow for Breadcrumbs/More.
