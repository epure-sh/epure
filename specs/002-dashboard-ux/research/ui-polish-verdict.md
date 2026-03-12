# UI polish — swarm synthesis

**Status:** Ratified (2026-09-13) — swarm complete (4/4)  
**Inputs:** [ui-polish-visual-system.md](./ui-polish-visual-system.md) · [ui-polish-peer-patterns.md](./ui-polish-peer-patterns.md) · [ui-polish-layout-structure.md](./ui-polish-layout-structure.md) · [ui-polish-component-audit.md](./ui-polish-component-audit.md)

**Agents:** [Visual design polish research](542335c8-e173-489d-ba48-d3ce539cef42) · [Polish peer patterns research](2f89c18a-e2ad-4bac-a849-f9b7a6ac9f4a) · [Shell layout structure research](004c0515-781f-43c4-ac47-319d8e609dbb) · [UI component kit audit](b9f342a6-6f21-44e7-b9de-0a7a5afc70ae)

---

## Executive summary

Epure's **Signal Room identity is right**. Polish fails from **four coupled gaps**:

1. **Structure** — Issues stacks 4–6 bands before the first row; sibling routes use `PageHeader`
2. **Tokens** — `design/` vs `web/design/` fork; dual focus rings; shadow policy violated
3. **Components** — 46 `ui/` files with blurred primitive/domain boundaries; duplicate rows, checkboxes, toasts
4. **Bugs** — `semantic-error` token used but undefined; unread bar uses `accent` not `signal`

**Polish thesis:** *Density without noise* + *one token source, one focus ring* + *unified page chrome*. Phosphor 2px unread bar is the single loud signature.

---

## Cross-cutting diagnoses

| Layer | Root pain | Primary fix |
|-------|-----------|-------------|
| **Structure** | Band stack on Issues home | L-P2 compress; L-P3 `PageChrome` |
| **Visual** | Token fork, shadcn geometry | V1 reconciliation |
| **Components** | Duplication, broken tokens, toast sprawl | C-P0 fixes (see below) |
| **Interaction** | Chrome competes with task | Plausible click-to-filter; refuse query hero |

---

## Ratified build order

### Phase P0 — ship blockers (do first)

| ID | Scope |
|----|--------|
| **C-P0** | Fix `semantic-error` → `semantic-danger`; unread `signal` bar; shadow policy; `SelectItem` mono hack; export or move `FilterPanel` |
| **V1** | Reconcile `design/` ↔ `web/design/` tokens; one font; one radius; one focus ring |
| **L-P2** | Compress Issues vertical chrome — ≤120px to first row |

### Phase P1 — cohesion

| ID | Scope |
|----|--------|
| **C-P1** | `Checkbox` primitive; toast provider; `size="toolbar"` button; `CommandInput` h-8; shape-matched skeletons |
| **V2–V3** | Typography roles; harmonize hover/focus/selected |
| **L-P3** | Shared `PageChrome` across Issues, Releases, Alerts |
| **L-P1** | Collapse 12rem rail on `<lg` |

### Phase P2 — finish

| ID | Scope |
|----|--------|
| **C-P2** | `ListRow` primitive; consolidate alert/release rows; move domain composites out of `ui/`; Design Lab coverage |
| **V4–V5** | Component reskin; toast motion |
| **L-P4–L-P5** | Detail header cleanup; Settings width tokens |
| **V6** | Dark mode QA |

---

## Component P0 quick wins (from audit)

1. `border-l-semantic-error` → `semantic-danger` (4 files)
2. Shadow policy: remove from card/dialog/popover **or** update `qa.md`
3. `IssueRow` unread → `border-l-signal`
4. Portal toast stack (replace 8× local `useState` toasts)
5. Radix `Checkbox` — unify list + header select-all
6. `SelectItem` — drop forced `font-mono`

---

## Steal / refuse

| Steal | Refuse |
|-------|--------|
| Sonner-style toast, Checkbox, Sheet, ToggleGroup (token-mapped) | shadcn zinc theme wholesale |
| Plausible click-to-filter, plain labels | Sentry query hero, 7-column table |
| Linear rail tick, `⌘K` behind door | Permanent keyboard footer |
| Phosphor 2px unread bar | Glassmorphism, card shadows, 8px radius creep |

---

## Proof gates

- **J2:** ≤120px to first list row; five-second scan
- **J3:** resolve visible without scroll (768px / 1280px)
- **J5:** QA.md — no hex, shadow policy consistent, token names only
- **Design Lab:** reskinned primitives at `/__design`

---

## Status (2026-09-13)

**D16 shipped** via [Implement D16 UI polish all](f2f18c71-266f-45db-8436-67d5509b2614): C-P0, V1, L-P2, C-P1, L-P1, partial L-P3.

**Deferred (D16b):** C-P2 ListRow; L-P4 detail header; L-P5 settings widths; V2–V6 typography/motion/dark QA; PageChrome on Settings/Setup.

**Next:** D7 J5 QA + `design/DASHBOARD.md` update.
