# 002-dashboard-ux — Library fit audit

**Scope:** `apps/epure/web/` stack vs dashboard UX charter (Plausible-shaped home, issue detail tabs, Filter behind a door, setup ritual).  
**Date:** 2026-09-12  
**Inputs:** `web/package.json`, `web/src/ui/*`, `design/SYSTEM.md`, `design/COMPONENTS.md`, `design/QA.md`, `design/tokens.css`, `specs/002-dashboard-ux/charter.md`

---

## Current stack (as shipped)

| Layer | Choice | Notes |
|---|---|---|
| Runtime | React 19 + react-router-dom 7 | Client-only SPA; no SSR |
| Build | Vite 7 + TypeScript | `dist/` → rust-embed in Rust binary |
| Styling | Tailwind v4 + `@design/tokens.css` | Theme bridge: `design/tailwind.theme.cjs` |
| Behavior primitives | Radix (à la carte) | Dialog, Dropdown Menu, Select, Slot, Tooltip |
| Command UI | cmdk 1.x | Wrapped in token-skinned `Dialog` |
| Icons | lucide-react | Tree-shake per icon import |
| Class merge | clsx via `lib/cn.ts` | No `tailwind-merge` (not needed yet) |

**Radix already in `ui/`:** `dialog`, `dropdown-menu`, `select`, `tooltip`, `button` (Slot).  
**Not Radix:** `toast`, `empty`, `badge`, `input`, `field`, `filter-chip`, `issue-row`, `code-block`, `skeleton`, `page-header`, `fair-use-banner`, `kbd` — plain React + tokens.

**Constitution mentions TanStack Query; it is not in `package.json`.** Issues page uses `fetch` + local state. Defer Query until a slice needs cache/invalidation — not a dashboard UX blocker.

---

## Skinning contract (how we use Radix)

Established pattern in existing primitives:

1. Import Radix primitive namespace (`* as TabsPrimitive`).
2. `forwardRef` wrapper; `cn()` for classes.
3. **Token-only surfaces:** `bg-surface`, `bg-bg-subtle`, `border-border`, `text-ink` / `text-ink-muted`, `shadow-md`, `rounded-sm` / `rounded-md` (≤ `--radius-lg`).
4. **Motion:** `duration-fast` / `duration-base`; no spring animations.
5. **Focus:** `.focus-ring` utility (`outline: 2px solid var(--focus-ring)`).
6. **Typography:** mono for control labels and dialog titles; sans for body.
7. **State styling:** `data-[state=open]:bg-bg-subtle`, `data-[state=active]:…` — never zinc/slate palette.
8. Export compound parts from `ui/index.ts`; recipe in `web/design/components.md` (or repo `design/COMPONENTS.md` when synced).

This is **not** shadcn: we do not install `shadcn-ui`, `class-variance-authority`, or copy the default zinc theme. Radix supplies behavior + a11y; Epure supplies look from tokens.

---

## Radix primitives to add

Prioritized for charter IA (issue detail tabs, Filter popover, setup, settings toggles).

### P0 — add before feature reskin

| Package | `ui/` file | Dashboard use |
|---|---|---|
| `@radix-ui/react-tabs` | `tabs.tsx` | Issue detail: **Overview · Stack · Breadcrumbs · More** (charter). Horizontal tab list with hairline underline; active tab `text-ink` + bottom `border-accent` (2px), not pill/capsule. |
| `@radix-ui/react-popover` | `popover.tsx` | **Filter** button → anchored panel (chips + optional query syntax). Keeps plain-language home; power syntax behind a door. Also: compact “More actions” on detail. |

### P1 — add with settings / power UX slices

| Package | `ui/` file | Dashboard use |
|---|---|---|
| `@radix-ui/react-collapsible` | `collapsible.tsx` | **More** tab sections (merge/diff/export), expandable stack frames, setup step bodies. Prefer over Accordion when only one section opens at a time. |
| `@radix-ui/react-checkbox` | `checkbox.tsx` | Bulk select mode (`x` toggle), Filter panel multi-select, team permissions. |
| `@radix-ui/react-switch` | `switch.tsx` | Webhook enable, notification toggles, settings booleans. |
| `@radix-ui/react-alert-dialog` | `alert-dialog.tsx` | Destructive confirms: split merge, delete webhook, ignore all. Reuse dialog visual language; trap focus + explicit confirm/cancel. |

### P2 — nice-to-have

| Package | `ui/` file | Dashboard use |
|---|---|---|
| `@radix-ui/react-label` | extend `field.tsx` | Setup form (project name, DSN copy field) — pairs with existing `Field`. |
| `@radix-ui/react-radio-group` | `radio-group.tsx` | Top-strip environment control if we outgrow `Select` (visible segmented control without menu). Optional; `Select` + `DropdownMenuRadioItem` may suffice. |
| `@radix-ui/react-separator` | `separator.tsx` | Semantic dividers in Filter panel / setup checklist. Low priority — `h-px bg-border` already used. |

### Defer or skip

| Package | Verdict |
|---|---|
| `@radix-ui/react-accordion` | **Skip** — tabs + collapsible cover issue detail; accordion adds nested chrome we refuse (J3: no advanced panels above fold). |
| `@radix-ui/react-scroll-area` | **Skip** — `overflow-auto` + `min-h-0` flex columns enough for master-detail; avoids extra bundle + custom scrollbar theming. |
| `@radix-ui/react-navigation-menu` | **Skip** — rail uses `NavLink`; settings uses vertical `NavLink` sidebar per `DASHBOARD.md`. |
| `@radix-ui/react-hover-card` | **Skip** — tooltips (`Tooltip`) cover hints; no hover-preview requirement. |
| `@radix-ui/react-toast` | **Skip** — custom `Toast` matches graphite block recipe. |
| `@radix-ui/react-progress` | **Skip** — setup checklist = custom **StepIndicator** (token bars + checkmarks), not a filled progress bar (reads analytics, not Plausible ritual). |
| `@radix-ui/react-slider` | **Skip** — no chart/report builder in Phase 1. |
| `@radix-ui/react-toggle-group` | **Defer** — breadcrumb sub-filters currently `Button` ghost; migrate only if keyboard roving focus is required. |
| `@radix-ui/react-context-menu` | **Defer** — right-click triage is P3; keyboard + command palette first. |

---

## Non-Radix additions (still in scope)

These are **Epure components** (compose `ui/`), not new libraries:

| Component | Implementation | Notes |
|---|---|---|
| `StatBar` | `div` grid + `font-mono-slash` | Three counts: unresolved / 7d events / regressions. No chart library. |
| `SetupChecklist` | `Collapsible` + custom steps | Horizontal or vertical steps; signal accent on complete. |
| `StepIndicator` | CSS + tokens | 2–4px `--signal` complete marker; no Radix Progress. |
| `FilterPanel` | `Popover` + `FilterChip` + `Input` | Replaces always-visible `FilterRow` query hero on home (charter J2). |
| `IssueDetailTabs` | `Tabs` + feature composition | Overview holds resolve/ignore; Stack/Breadcrumbs lazy-mount content. |
| `CopyField` | `Input` + `Button` ghost | DSN copy slab per COMPONENTS.md marketing/product DSN recipe. |

**Icons:** stay on lucide-react (already used). Do not add Phosphor/Heroicons second set.

**Data fetching:** keep `lib/api.ts` + hooks until invalidation complexity warrants TanStack Query. Rust-embed does not change this choice.

---

## Patterns that fit token rules

| Pattern | Token mapping | QA alignment |
|---|---|---|
| Tab list | `border-b border-border`; active `border-b-2 border-accent text-ink`; inactive `text-ink-muted` | Radii ≤ 4px; no pills |
| Popover surface | `bg-surface border-border shadow-md rounded-md p-3` | Hairline borders, no glow |
| Menu / select content | Same as existing `dropdown-menu.tsx` / `select.tsx` | Already proven |
| Collapsible trigger | `Button variant="ghost"` + chevron `text-ink-muted` | Disclosure, not accordion chrome stack |
| Checkbox / switch | Checked: `bg-accent` or `bg-signal` sparingly; track `bg-bg-subtle border-border` | Accent < 10% on issue list — controls OK in settings/filter |
| Dialog / alert | `bg-surface`, `font-mono` title, overlay `bg-ink/20` | Matches existing `dialog.tsx` |
| Empty / setup | `Empty` dashed `border-border-strong`; mono uppercase copy | No mascot (QA) |
| Stat numbers | `font-mono-slash text-xl text-ink` | Slashed-zero tabular |
| Loading | `Skeleton` | No spinner library |

**Dark mode:** rely on `[data-theme="dark"]` in tokens; components do not branch on theme in JSX.

---

## What to refuse

| Refuse | Why |
|---|---|
| **shadcn/ui CLI + default theme** | Constitution + charter; zinc/slate palette violates QA |
| **`@radix-ui/themes`** | Parallel token system; forks `tokens.css` |
| **Headless UI, MUI, Chakra, Ant** | Second component model; bundle bloat |
| **Recharts, Chart.js, Tremor** | Home is issue list + stat bar, not chart dashboard |
| **Framer Motion / React Spring** | Motion tokens are 80–160ms mechanical; no bounce |
| **react-hot-toast, Sonner** | Custom `Toast` already matches recipe |
| **Copy-paste shadcn component files** | Imports `bg-primary`, `text-muted-foreground`, `rounded-lg` defaults — fails QA |
| **`tailwind-merge` + shadcn cn()** | Only add if class conflicts become painful; not default |
| **External font CDN in production** | Fonts must ship in `dist/` for offline embed |
| **Next.js / Remix / SSR** | Phase 1 = rust-embed SPA only |

---

## Rust-embed SPA constraints

Production path (from `specs/001-phase-1-oss/research.md` + `crates/server/src/embed.rs`):

```
web/ npm run build → dist/ → RustEmbed → Axum static + index.html fallback
```

Implications for library choices:

1. **Single client bundle** — every dependency ships in the binary. Prefer **per-primitive Radix imports** (already the pattern); avoid umbrella UI kits.
2. **No Node in the product container** — Vite is build-time only; runtime is static assets + JSON API on same origin.
3. **Client-side routing** — `react-router` + server SPA fallback. Deep links (`/settings/dsn`) must work without SSR. Tab state can be URL hash or query if shareable (`?tab=stack`).
4. **Same-origin API** — `lib/api.ts` fetches `/api/*`; dev uses Vite proxy. No CORS-specific UI libraries needed.
5. **Asset paths** — Vite `base: '/'` default; embedded assets use relative paths from `dist/`. No runtime `import()` from external URLs.
6. **Fonts** — IBM Plex stack in tokens; ensure `@font-face` or system fallbacks are bundled if we move off system fonts.
7. **Bundle discipline** — each new Radix primitive ≈ few KB gzip. Target additions: **6 packages** (tabs, popover, collapsible, checkbox, switch, alert-dialog) ≈ acceptable vs one chart library.
8. **Code splitting (optional)** — `React.lazy` for `/settings/*` and `/__design` is compatible with embed; not required for v1.
9. **No service worker / PWA** — out of scope unless offline dashboard is specified.
10. **Testing** — UI proofs are journey-based (J1–J5) in browser against compose stack, not Storybook host.

---

## Migration notes (current → v2)

| Today | v2 direction |
|---|---|
| `EventDetailPanel` single scroll (stack + breadcrumbs visible) | `Tabs` — J3 one-screen triage on Overview |
| `FilterRow` always visible with `is:unresolved` placeholder | `Filter` `Popover` + preset chips on home; query syntax inside panel |
| Settings `NavLink` sidebar | **Keep** — not Radix Tabs (per `DASHBOARD.md`) |
| Breadcrumb filter as `Button` group | Keep or `ToggleGroup` later; not blocking |
| Occurrence picker as `Button` row | Keep on Overview or move under **More** |

New primitives land in `ui/` first → Design Lab (`/__design`) → then `features/`.

---

## Principles

1. **Radix for behavior, tokens for look** — accessibility and focus traps from Radix; every pixel from `tokens.css`.
2. **À la carte primitives** — one package per control; no design-system framework.
3. **Kit before screens** — new control = `ui/` + recipe + Design Lab before `features/` reskin.
4. **Plain language default, power behind a door** — Popover Filter, Tabs for detail depth, command palette for experts.
5. **Bundle-aware embed** — prefer CSS + small Radix additions over chart/animation libraries.
6. **One shell, one palette** — login through triage uses same chrome; dark mode via `data-theme` only.

---

## Anti-patterns

1. Installing **shadcn** or pasting its components without re-tokenizing every class.
2. Using **default Tailwind palette** (`slate-`, `zinc-`, `indigo-`) anywhere in `ui/`, `shell/`, `features/`.
3. **Query bar as hero** on Issues home — violates charter J2; use StatBar + list + Filter button.
4. **Accordion stacks** on issue detail above the fold — violates J3.
5. **Chart libraries** for home “dashboard” — charter refuses GA4-style home.
6. **Radix Themes** or parallel CSS variable systems — forks canonical tokens.
7. **Heavy motion** (spring, parallax) — conflicts with mechanical 80–160ms motion tokens.
8. **Mascot / confetti empty states** — QA fail.
9. **Capsule pills** on primary navigation (`rounded-full` tabs) — QA radii rule.
10. **Feature-local Radix** — import primitives only from `ui/`, never `@radix-ui/*` in `features/`.

---

## Candidate patterns for Epure

### Issue detail (Tabs + Collapsible)

```
┌─────────────────────────────────────────────┐
│ [Overview] [Stack] [Breadcrumbs] [More]     │  ← Tabs (hairline, not pills)
├─────────────────────────────────────────────┤
│ Overview: title, status, last seen, env     │
│ [Resolve] [Ignore]                          │  ← visible without scroll (J3)
└─────────────────────────────────────────────┘
```

- **Stack tab:** existing `CodeBlock` recipe unchanged.
- **Breadcrumbs tab:** filter chips + `Input` regex; timeline rows in `bg-surface` hairline list.
- **More tab:** `Collapsible` sections for diff, merge, export, keyboard hints.

### Issues home (StatBar + Filter Popover)

```
┌─────────────────────────────────────────────┐
│ 12 unresolved · 340 events (7d) · 2 regressions │  ← StatBar (mono-slash)
│ [Filter]                                      │  ← Popover trigger (secondary btn)
├─────────────────────────────────────────────┤
│ IssueRow …                                    │
└─────────────────────────────────────────────┘
```

- Popover content: `FilterChip` presets + optional `Input` for query tokens.
- Active filters reflected as chips on home (not raw `is:unresolved` string).

### Setup ritual (custom steps + Dialog optional)

- Steps 1–4 from charter: project → DSN `CopyField` → test error → first issue seen.
- `StepIndicator` with `--signal` check on complete; body via `Collapsible` or static sections.
- Full-screen overlay or `/setup` route — both compatible with embed routing.

### Settings (unchanged model)

- Vertical `NavLink` sidebar — **do not** swap for Radix Tabs.
- Add `Switch` / `Checkbox` in webhook and team forms only.

### Command palette (unchanged)

- Keep `cmdk` + `CommandDialog`; no library change.

### Destructive flows

- `AlertDialog` for irreversible actions; copy in plain language (“Split this group?”), `Button` danger confirm.

---

## Recommended install order

```bash
# P0
npm install @radix-ui/react-tabs @radix-ui/react-popover

# P1 (same PR or next slice)
npm install @radix-ui/react-collapsible @radix-ui/react-checkbox \
  @radix-ui/react-switch @radix-ui/react-alert-dialog
```

Then: implement `ui/tabs.tsx`, `ui/popover.tsx`, export from `index.ts`, add Design Lab sections, update `components.md` recipes, reskin `features/issues/`.

---

## Summary table

| Need | Library | Action |
|---|---|---|
| Issue detail sections | `@radix-ui/react-tabs` | **Add** |
| Filter / contextual panels | `@radix-ui/react-popover` | **Add** |
| Progressive disclosure | `@radix-ui/react-collapsible` | **Add** |
| Settings / bulk toggles | checkbox, switch | **Add** |
| Destructive confirm | alert-dialog | **Add** |
| Overlays / menus / picks | dialog, dropdown, select, tooltip | **Keep** |
| Quick search | cmdk | **Keep** |
| Icons | lucide-react | **Keep** |
| shadcn, charts, motion libs | — | **Refuse** |
