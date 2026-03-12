# UI polish — component kit audit

**Date:** 2026-09-13  
**Scope:** `web/src/ui/*`, `web/design/*`, feature composition in Issues / Releases / Alerts, Design Lab + Playground  
**Note:** `../../design/SYSTEM.md` and `../../design/COMPONENTS.md` do not exist in the monorepo. Canonical contracts live in `web/design/README.md`, `web/design/components.md`, `web/design/qa.md`, and `web/src/ui/README.md`. This audit supersedes the inventory section of [`component-inventory.md`](./component-inventory.md) (2026-09-12), which predates Tabs, FilterPanel, IssueDetailTabs, and most domain composites.

**User pain addressed:** components feel unpolished, structurally messy, and inefficient to compose — not a missing palette, but inconsistent primitives, blurred kit boundaries, and doc/implementation drift.

---

## 1. Inventory of existing `ui/` components

46 files under `web/src/ui/`. Quality is **1–5** (5 = production-polished, token-faithful, reusable without overrides).

### 1.1 Core primitives (shadcn / Radix)

| Component | File | Q | Notes |
|-----------|------|---|-------|
| **Button** | `button.tsx` | **4** | Solid CVA (`primary`, `signal`, `secondary`, `ghost`, `danger`, `outline`, `link`). `icon` size is `h-7 w-7` while docs say 8×8. `shadow-sm` on `primary`/`signal`/`outline` conflicts with `qa.md`. |
| **Badge** | `badge.tsx` | **3** | Only `error`, `warning`, `env`, `default`, `secondary`. No `success` / `signal` / count variants. Default variant `env` is domain-specific. |
| **Card** | `card.tsx` | **3** | Correct `rounded-lg` / `p-4`, but `shadow-sm` on root violates `qa.md` (“no box-shadow on cards”). Used only in org/settings — not in Issues/Releases/Alerts. |
| **Input** | `input.tsx` | **4** | `h-8`, token focus ring. `shadow-sm` on a text field adds visual noise. |
| **Label** | `label.tsx` | **4** | Standard Radix + CVA. |
| **Field** | `field.tsx` | **4** | Label + hint + error — good form primitive; underused outside login/setup. |
| **Select** | `select.tsx` | **3** | Trigger is fine. **`SelectItem` forces `font-mono text-xs` on every option** — breaks time-window and sort labels in `filter-panel.tsx` (overridden with `className="text-sm"` as a hack). Uses `../lib/cn` not `@/lib/cn`. |
| **Tabs** | `tabs.tsx` | **4** | Underline `TabsTrigger` is on-brand. No keyboard roving focus docs. |
| **Dialog** | `dialog.tsx` | **3** | `shadow-md` on content; no enter/exit motion. **`DialogTitle` defaults to `font-mono`** — wrong for general modals (command palette inherits this). Drawer hack in `breadcrumb-timeline.tsx` overrides positioning manually. |
| **DropdownMenu** | `dropdown-menu.tsx` | **4** | Complete Radix surface. `DropdownMenuRadioItem`, `Sub*`, `Shortcut` exist but are **not exported** from `index.ts`. |
| **Popover** | `popover.tsx` | **3** | `shadow-md`; no animation. `FilterPanel` depends on it. |
| **Tooltip** | `tooltip.tsx` | **3** | Minimal — no `animate-in` / delay defaults. Provider only wired in shell. |
| **Command** | `command.tsx` | **4** | cmdk integration works. **`CommandInput` is `h-10`** — breaks the `h-8` control rhythm documented everywhere else. |
| **Separator** | `separator.tsx` | **4** | Fine. Rarely used — features prefer `border-b` / `divide-y`. |
| **Toast** | `toast.tsx` | **2** | Single inline `div`, no portal, no queue, no auto-dismiss API, `shadow-md`. Every feature reimplements `useState` + `setTimeout`. |
| **Skeleton** | `skeleton.tsx` | **4** | `IssueRowSkeleton` padding (`px-3`) mismatches `IssueRow` (`px-4`). |
| **Kbd** | `kbd.tsx` | **4** | Compact, correct. |
| **Empty** | `empty.tsx` | **3** | Good dashed pattern. Default title `"0 UNRESOLVED EXCEPTIONS"` is product copy baked into a primitive. |

### 1.2 Filter / query primitives

| Component | File | Q | Notes |
|-----------|------|---|-------|
| **FilterChip** | `filter-chip.tsx` | **4** | Matches `components.md` (`h-7`, `rounded-md`). Remove button is a nested `span[role=button]` inside a `<button>` — invalid HTML / awkward a11y. |
| **FilterPanel** | `filter-panel.tsx` | **3** | 190-line feature orchestrator living in `ui/`. **Not exported from `index.ts`.** Filter trigger is `Button variant="ghost"` + manual `border border-border` instead of `secondary` or a dedicated `filter` variant. |

### 1.3 List / row / chrome

| Component | File | Q | Notes |
|-----------|------|---|-------|
| **IssueRow** | `issue-row.tsx` | **4** | Core triage row. **Unread bar uses `border-l-accent`**, but `components.md` specifies `--signal`. Selected state uses `bg-accent-muted/70`; docs say `bg-bg-subtle`. |
| **PageHeader** | `page-header.tsx` | **3** | `px-6 py-5` + `text-2xl` — looser than compact dashboard rhythm (`p-4`, `text-lg` elsewhere). |
| **StatBar** | `stat-bar.tsx` | **4** | Good headline metrics. `text-3xl` counts work with `font-mono-slash`. |
| **SettingsNav** | `settings-nav.tsx` | **3** | Duplicates `shell/rail-nav.tsx` active-indicator patterns with different mechanics (`border-l-2` vs absolute `w-0.5` bar). |
| **RegressionStrip** | `regression-strip.tsx` | **3** | Uses **`border-l-semantic-error`** — token does not exist (should be `semantic-danger`). |
| **FairUseBanner** | `fair-use-banner.tsx` | **3** | Correct warning strip pattern. **Unused in any feature.** |
| **IssuesHomeHint** | `issues-home-hint.tsx` | **3** | One-off hint strip; overlaps with a generic **Banner/Callout** primitive. |
| **KeyboardHintsFooter** | `keyboard-hints-footer.tsx` | **3** | Functional but ad hoc; could be a **Collapsible** or **Sheet** footer pattern. |

### 1.4 Issue-detail composites (domain logic in `ui/`)

| Component | File | Q | Notes |
|-----------|------|---|-------|
| **IssueDetailTabs** | `issue-detail-tabs.tsx` | **4** | Good tab shell + `DETAIL_TOOLBAR_BUTTON_CLASS` constant exported for features. |
| **IssueOverviewPanel** | `issue-overview-panel.tsx` | **3** | Large composite; **`border-l-semantic-error`** bug on regression banner. |
| **IssueMorePanel** | `issue-more-panel.tsx` | **3** | 230 lines; belongs in `features/issues/components/`. |
| **BreadcrumbTimeline** | `breadcrumb-timeline.tsx` | **3** | 237 lines; reinvents **ToggleGroup** with `Button` pairs; **Sheet** simulated via `DialogContent` CSS overrides. |
| **StackTracePanel** | `stack-trace-panel.tsx` | **4** | Well-factored; uses `CodeBlock` + `OccurrencePicker`. |
| **OccurrencePicker** | `occurrence-picker.tsx` | **3** | Not exported from `index.ts`. Date buttons lack compact `size="sm"` — rely on default `h-8`. |
| **IssueImpactStrip** | `issue-impact-strip.tsx` | **3** | Domain widget. |
| **IssueOccurrenceTimeline** | `issue-occurrence-timeline.tsx` | **3** | Chart-like widget; tooltip uses `shadow-sm`. |
| **IssueRecentOccurrences** | `issue-recent-occurrences.tsx` | **3** | Domain widget. |
| **MorePanel** | `more-panel.tsx` | **4** | Tiny layout helper — good. |
| **CodeBlock** | `code-block.tsx` | **4** | `rounded-sm` while stacks spec says `rounded-md` in `components.md`. |
| **CopyButton** | `copy-button.tsx` | **4** | Good recipe on top of `Button`. |
| **CopyDsnBlock** | `copy-dsn-block.tsx` | **4** | Matches DSN recipe; reveal toggle is a raw `<button>` not `Button variant="link"`. |
| **SdkSnippetBlock** | `sdk-snippet-block.tsx` | **3** | Setup-only; fine but narrow. |
| **SetupChecklist** | `setup-checklist.tsx` | **4** | Composes `StepIndicator` well. |
| **StepIndicator** | `step-indicator.tsx` | **4** | Uses `signal` correctly for active step — contrast with `IssueRow` unread. |

### 1.5 Export surface (`index.ts`)

**Exported:** 40+ symbols.  
**Exists but not exported:** `FilterPanel`, `OccurrencePicker`, `IssueImpactStrip`, `IssueMorePanel`, `IssueRecentOccurrences`, `IssueOccurrenceTimeline`, several `DropdownMenu*` / `Dialog*` / `SelectGroup` / `SelectSeparator` subcomponents.

---

## 2. Anti-patterns found

### 2.1 Token and doc drift

| Source | Says | Reality |
|--------|------|---------|
| `tokens.css` | Manrope, `--radius: 0.5rem`, motion 100/150/200ms | |
| `tokens.json` | IBM Plex Sans/Serif, radius sm/md/lg = 2/4/6px, motion 80/120/160ms | **Stale vs CSS source of truth** |
| `components.md` | Unread = 2px `--signal` left bar | `issue-row.tsx` uses `border-l-accent` |
| `components.md` | Selected = `bg-bg-subtle` | `issue-row.tsx` uses `bg-accent-muted/70` |
| `qa.md` | No box-shadow on cards, popovers, dialogs, dropdowns | `card`, `dialog`, `popover`, `toast`, `input`, `select`, `button` all use shadows |
| `README.md` / `components.md` | `shadow-sm` on cards and secondary buttons | Contradicts `qa.md` |

**Action needed:** pick one elevation policy and update either `qa.md` or primitives — not both silently.

### 2.2 Invalid / dead tokens

`border-l-semantic-error` appears in four files but **`semantic-error` is not defined** in `tailwind.theme.cjs` (only `semantic.danger`). Regression strips render with no left border color in production.

- `web/src/ui/regression-strip.tsx:27`
- `web/src/ui/issue-overview-panel.tsx:154`
- `web/src/features/alerts/alert-row.tsx:32`

### 2.3 Import and path inconsistency

Only 4 primitives use `@/lib/cn`; 27 use `../lib/cn`. Features import via `../../ui/button` (relative) while `components.json` aliases `@/ui`. Minor, but signals “generated then partially hand-edited.”

### 2.4 Button variant sprawl in features

Features constantly override sizes instead of using `size="sm"`:

```tsx
// Typical pattern across issues/, alerts/, settings/
<Button variant="ghost" className="h-7 shrink-0 px-2 text-xs" />
<Button variant="secondary" className="text-xs" />
```

`DETAIL_TOOLBAR_BUTTON_CLASS = "h-7 gap-1 px-2 text-xs"` in `issue-detail-tabs.tsx` is an admission that **`size="sm"` (`h-7`) is the real dashboard default**, not `default` (`h-8`).

`FilterPanel` uses `ghost` + `border border-border` instead of `secondary` or `outline` — a one-off third secondary style.

### 2.5 Duplicate row / list patterns

Three hand-rolled list rows share ~80% structure (title, meta, timestamp, left accent, `min-h-row`, hover):

| Row | Location | Left accent |
|-----|----------|-------------|
| `IssueRow` | `ui/issue-row.tsx` | `accent` (unread) |
| `AlertListRow` | `features/alerts/alert-row.tsx` | `semantic-error` (broken) |
| `ReleaseRow` | `features/releases/index.tsx` (inline) | none |

No shared **`ListRow`** or **`DataList`** primitive. Skeleton variant only exists for issues.

### 2.6 Duplicate selection / checkbox

Custom checkbox buttons in:

- `features/issues/issue-list.tsx:130-154` (per-row, `w-8` column)
- `features/issues/issues-list-header.tsx:32-50` (select-all, `h-4 w-4`)

Different sizes, same behavior — should be one **`Checkbox`** primitive (Radix).

### 2.7 Duplicate nav patterns

| Pattern | Files |
|---------|-------|
| Rail nav | `shell/rail-nav.tsx` — absolute `w-0.5` accent bar |
| Settings nav | `ui/settings-nav.tsx` — `border-l-2 border-l-accent` |
| Tabs | `ui/tabs.tsx` — `border-b-2` active |
| Step indicator | `ui/step-indicator.tsx` — `border-l-2 border-l-signal` |

Four different “you are here” indicators with four different geometries.

### 2.8 Kit boundary blur

`ui/` mixes **primitives** with **Issues-domain composites** (`IssueOverviewPanel`, `BreadcrumbTimeline`, `FilterPanel`). Features import 15+ symbols from `ui/` in `issues/index.tsx` alone. Hard to know what is reusable vs triage-specific.

### 2.9 Toast as copy-paste

At least 8 feature files implement:

```tsx
const [toast, setToast] = useState<string | null>(null);
// ...
{toast ? <Toast message={toast} /> : null}
```

No fixed position, no stacking, inconsistent timeout (some 3s, some manual). `Toast` renders wherever it is placed in the tree — usually wrong visually.

### 2.10 Design Lab coverage gaps

`features/design-lab/index.tsx` previews buttons (missing `signal`, `outline`, `link`), no Select, Dialog, DropdownMenu, Toast, Field+error, Checkbox, Card, or elevation policy demo. **Cannot validate polish from one page.**

### 2.11 Spacing rhythm leaks

| Area | Padding | Spec |
|------|---------|------|
| `PageHeader` | `px-6 py-5` | — |
| Issues toolbar | `px-6 py-3` | — |
| `Card` | `p-4` | `components.md` |
| `login.tsx` card | `p-6` | `components.md` says avoid `p-6` except marketing |
| `setup/index.tsx` | `p-5` | off-scale |
| Settings list items | `px-4 py-3` | — |
| `IssueRow` | `px-4 py-2` | `h-row` spec |

No shared `PageLayout` or spacing scale enforcement.

### 2.12 Motion gap

Only `skeleton` uses `animate-pulse`. Overlays (Dialog, Popover, Dropdown, Tooltip) have **zero enter/exit** despite motion tokens in `tokens.css`. Feels abrupt compared to shadcn defaults.

---

## 3. Missing primitives (polished kit checklist)

Priority order for a dashboard that feels “finished”:

### P0 — blocks polish / correctness

| Primitive | Why |
|-----------|-----|
| **Checkbox** | Bulk triage, select-all, settings forms — today hand-rolled twice |
| **Toast provider** | Sonner-style fixed stack; eliminates 8 duplicate implementations |
| **Banner / Callout** | Unify `RegressionStrip`, `FairUseBanner`, `IssuesHomeHint`, snooze/regression banners in `IssueOverviewPanel` |
| **ListRow + DataList** | Shared row chrome for Issues, Alerts, Releases, Settings team/webhooks lists |
| **Sheet** | `BreadcrumbTimeline` drawer is a Dialog hack; issue detail mobile back needs it |

### P1 — efficiency for feature authors

| Primitive | Why |
|-----------|-----|
| **ToggleGroup** | Replace `Button` ghost/secondary pairs in breadcrumb filters, login mode switch, diff mode |
| **ScrollArea** | Issue detail tabs, command list, long stack traces — native overflow is harsh |
| **Textarea** | Webhooks, settings — features will reach for raw `<textarea>` |
| **Table** (`Table`, `TableRow`, `TableHead`…) | `org/settings/usage.tsx` hand-rolls `<table>` with repeated `py-2.5` |
| **Alert** (inline) | Form errors, API failures — today raw `<p className="text-semantic-danger">` |
| **Spinner / Button `loading`** | Resolve/merge/snooze actions use `busy` flag with no visual feedback |

### P2 — completeness

| Primitive | Why |
|-----------|-----|
| **Switch** | Settings toggles |
| **RadioGroup** | Plan picker, sort mode |
| **Avatar** | Team page |
| **Progress** | Setup checklist could show % |
| **Pagination** | Future large issue lists |
| **Breadcrumb** | Top strip still manual spans |
| **Collapsible** | Keyboard hints, vendor frames |
| **Form** helpers | Optional react-hook-form + Field integration |

---

## 4. File-level fixes (ranked P0 → P2)

### P0 — ship blockers / user-visible bugs

| # | File | Fix |
|---|------|-----|
| 1 | `ui/regression-strip.tsx`, `ui/issue-overview-panel.tsx`, `features/alerts/alert-row.tsx` | Replace `semantic-error` → `semantic-danger` |
| 2 | `web/design/qa.md` **or** `ui/card.tsx`, `ui/dialog.tsx`, `ui/popover.tsx`, `ui/button.tsx`, `ui/input.tsx`, `ui/select.tsx` | **Resolve shadow policy** — either remove shadows from overlays/cards or update `qa.md` to allow `shadow-sm` on interactive controls only |
| 3 | `ui/issue-row.tsx:39` | Unread bar: `border-l-signal` per `components.md` (not `accent`) |
| 4 | `ui/toast.tsx` + new `ui/sonner.tsx` or `ui/toaster.tsx` | Portal-based toast stack; migrate features off local `useState` |
| 5 | New `ui/checkbox.tsx` | Radix Checkbox; refactor `issue-list.tsx`, `issues-list-header.tsx` |
| 6 | `ui/select.tsx:69` | Remove default `font-mono` from `SelectItem`; add `className` prop convention or `mono` variant |
| 7 | `ui/index.ts` | Export `FilterPanel` **or** move to `features/issues/filter-panel.tsx` — pick one public home |

### P1 — consistency / efficiency

| # | File | Fix |
|---|------|-----|
| 8 | All `ui/*.tsx` using `../lib/cn` | Standardize to `@/lib/cn` |
| 9 | `ui/button.tsx` | Add `size="toolbar"` (`h-7 text-xs px-2`) **or** change `sm` to be the dashboard default; remove `DETAIL_TOOLBAR_BUTTON_CLASS` string hack |
| 10 | `ui/command.tsx:53` | `CommandInput` → `h-8` (or `h-9` max) to match control scale |
| 11 | `ui/dialog.tsx:67` | `DialogTitle` → `font-medium text-ink` (mono only via `className` at call site) |
| 12 | `ui/skeleton.tsx:21` | `IssueRowSkeleton` `px-4` to match `IssueRow` |
| 13 | `ui/filter-chip.tsx:34-45` | Replace nested button with `IconButton` beside chip, or chip + separate dismiss control |
| 14 | `ui/issue-row.tsx:35-37` | Align selected state to `bg-bg-subtle` per spec |
| 15 | `web/design/tokens.json` | Sync fonts, radius, motion with `tokens.css` (or mark JSON as deprecated) |
| 16 | `features/design-lab/index.tsx` | Full primitive matrix: all button variants, Select, Dialog, Dropdown, Toast, Field errors, elevation demo |
| 17 | New `ui/list-row.tsx` | Extract shared row; migrate `alert-row.tsx`, `releases/index.tsx` `ReleaseRow` |
| 18 | `ui/breadcrumb-timeline.tsx:212-234` | Replace Dialog drawer hack with `Sheet` primitive |

### P2 — structure / long-term maintainability

| # | File | Fix |
|---|------|-----|
| 19 | `ui/issue-more-panel.tsx`, `ui/issue-overview-panel.tsx`, `ui/breadcrumb-timeline.tsx`, `ui/filter-panel.tsx` | Move to `features/issues/components/`; keep only generic pieces in `ui/` |
| 20 | `ui/empty.tsx:11` | Default `title` → generic `"Nothing here"`; product copy at call site |
| 21 | `ui/code-block.tsx:18` | `rounded-sm` → `rounded-md` per `components.md` stack spec |
| 22 | `ui/page-header.tsx` | Tighten to `px-4 py-4` or introduce `PageLayout` with consistent horizontal rhythm |
| 23 | `features/issues/bulk-actions.tsx:39` | Remove `shadow-sm` if qa policy is no shadow; or use `bg-surface-raised` only |
| 24 | `ui/fair-use-banner.tsx` | Wire into usage/billing or delete until needed |
| 25 | `org/settings/usage.tsx` | Migrate to `Table` primitive when added |
| 26 | `ui/*` overlay components | Add `data-[state=open]:animate-in` pattern (shadcn) using `--ease-mechanical` / `--duration-panel` |

---

## 5. Steal list — shadcn / Radix patterns worth borrowing (not the theme)

Import primitives via `npx shadcn@latest add …`, then remap classes to Epure tokens (`bg-surface`, `text-ink`, `border-border`, `ring-[var(--focus-ring)]`). **Do not ship** default zinc/slate palette, `bg-primary`, or shadcn’s default radii.

### Steal wholesale (high ROI)

| shadcn component | Borrow | Epure adaptation |
|------------------|--------|------------------|
| **sonner** + Toaster | Fixed toast stack, swipe dismiss, promise API | `bg-ink` / `text-ink-inverse` or surface toast; no default green success icon theme |
| **checkbox** | Radix tri-state, focus ring | `border-border-strong`, checked `bg-accent` / `text-accent-contrast` |
| **sheet** | Side panel with overlay + slide | `border-l border-border`, **no shadow** per qa; `--ease-mechanical` |
| **scroll-area** | Styled overflow | `bg-surface`, thin `border-border` thumb |
| **toggle-group** | Pill filter bar | Replace ghost/secondary button pairs in breadcrumbs, login mode |
| **table** | Composable table parts | Usage page, future audit logs |
| **alert** | Inline status | `border-l-[3px]` + semantic colors — matches existing strip language |
| **textarea** | Matches Input styling | Same `h-auto min-h-[80px]`, `shadow-sm` only if elevation policy allows |

### Steal patterns, not packages

| Pattern | From | Apply to |
|---------|------|----------|
| `buttonVariants` + `asChild` | shadcn Button | Already have — extend with `loading` and `toolbar` size |
| `cn()` + CVA | shadcn | Enforce in all new primitives |
| `focus-visible:ring-1 ring-[var(--focus-ring)]` | shadcn new-york | Replace mixed `focus-ring` class vs `ring-1` usage |
| `data-[state=open]:animate-in` / `fade-in-0` | shadcn + tailwindcss-animate | Dialog, Popover, Dropdown, Tooltip |
| Command dialog `p-0` overflow | shadcn | Already in `command.tsx` — add max-height + ScrollArea |
| Form `FormField` + `FormMessage` | shadcn form | Optional; `Field` is 80% there |
| Dropdown `inset` + `Shortcut` | shadcn | Export from `index.ts`; use in command palette hints |
| Disabled opacity `opacity-50` + `pointer-events-none` | Radix defaults | Already on Button — extend to IconButton |

### Do NOT steal

- Default **neutral/zinc** color CSS variables
- **`bg-primary` / `text-primary-foreground`** naming — Epure uses `accent` / `signal`
- **Heavy drop shadows** on floating surfaces if qa stays “hairline only”
- **rounded-xl** marketing corners — keep `rounded-md` / `rounded-lg`
- **Lucide default sizes** without `[&_svg]:size-4` discipline
- **Card `p-6`** default — Epure is `p-4` compact
- **Inter** font stack — Manrope / IBM Plex per tokens

### Reference implementations to study (grep shadcn source, don’t npm theme)

1. **Sonner** — `toast.tsx` replacement; Epure dark toast already close (`bg-ink`)
2. **Sheet** — `breadcrumb-timeline.tsx` drawer refactor
3. **Toggle group** — `BreadcrumbFilterBar` in `breadcrumb-timeline.tsx`
4. **Data table** — light version for `usage.tsx` (no TanStack required for Phase 1)
5. **Alert dialog** — destructive confirm for bulk delete (today direct action)

---

## 6. How features compose today (snapshot)

### Issues (`features/issues/`)

Heavy `ui/` consumer: `FilterPanel`, `StatBar`, `IssueDetailTabs`, `IssueOverviewPanel`, `StackTracePanel`, `IssueMorePanel`, `RegressionStrip`, `SetupChecklist`, `KeyboardHintsFooter`. **Feature-local:** `BulkActions`, `DiffPanel`, `MergeActions`, `SnoozeMenu`, `IssuesListHeader`, `IssueList` — these reimplement patterns the kit should own (checkbox, banner, toolbar).

### Releases (`features/releases/`)

Lean: `PageHeader`, `Empty`, `Skeleton`, `CopyButton`. **Inline `ReleaseRow`** should use shared `ListRow`. CLI hint uses raw `<pre>` blocks — should use `CodeBlock` or `SdkSnippetBlock`.

### Alerts (`features/alerts/`)

Same list shell as Issues (`border border-border bg-surface` + skeleton rows). `AlertListRow` duplicates `IssueRow` with a broken token.

### Design Lab / Playground

- **Design Lab** (`/design-lab`): partial primitive gallery; best place to enforce polish proofs before features.
- **Playground** (`web/playground/`): full `AppShell` with mock API — good for composition QA, not component matrix.

---

## 7. Recommended polish sequence

1. **P0 token bugs** — `semantic-error`, unread `signal`, shadow policy decision  
2. **Checkbox + Toast provider** — highest duplication pain  
3. **ListRow extraction** — Alerts + Releases + Settings lists instantly align  
4. **Button size contract** — one dashboard default, delete `className="text-xs"` sprawl  
5. **Sheet + ScrollArea** — issue detail feels professional  
6. **Split domain composites out of `ui/`** — kit becomes learnable again  
7. **Design Lab = CI proof** — screenshot or checklist every primitive before merge  

---

## 8. Related artifacts

| Doc | Relationship |
|-----|--------------|
| [`component-inventory.md`](./component-inventory.md) | Gap analysis / screen composition — use with this doc |
| [`library-fit.md`](./library-fit.md) | shadcn/Radix adoption rationale |
| [`web/design/qa.md`](../../../web/design/qa.md) | Must be reconciled with shadow usage |
| [`web/design/components.md`](../../../web/design/components.md) | Recipe source — several recipes not enforced in code |
