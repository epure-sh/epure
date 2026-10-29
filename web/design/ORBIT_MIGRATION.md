# Epure → Polar Orbit migration

Durable plan for adopting [@polar-sh/orbit](https://github.com/polarsource/polar/tree/main/clients/packages/orbit) as Epure’s design system. Goal: **exact Orbit look and stack**, not Calm Ledger skinned onto Orbit primitives.

| Phase | Goal | Status |
|---|---|---|
| **0** | Vendor Orbit; StyleX + Vite toolchain; theme host; proof Box/Text/Button in playground | **Done** |
| **1** | AGENTS.md + lint rules (no raw layout HTML / no off-token); Box/Text/Grid recipes | **Done** (see `web/AGENTS.md`, `design/ORBIT_RECIPES.md`, `/__design#recipes`) |
| **2** | Replace `components/ui` with Orbit components; fold `@/ui` façades | **Done** (high-frequency primitives; see mapping below) |
| **3** | Delete dual Calm Ledger bridges; Orbit tokens own `@theme`; fonts | **Done** |
| **4** | Restyle `components/kit` on Orbit primitives | **Done** (chrome listed below; Phase 6 surfaces deferred) |
| **5** | Playground → Orbit-style registry + Example pages (canvas optional) | **Done** |
| **6** | Recraft Epure-only surfaces (issue feed, telemetry, AI copilot, alerts, shell) | **Done (Orbit-by-default)** — zone globs cover product UI; `orbitZoneDeferred` is the honest remainder (recharts / Shiki / driver.js / Radix-cmdk-sonner chrome + careful-rewrite queue). Kit: `issue-row-shell`, `inbox-*`, `ask-agent-card` on Box/Text. |

References: [Orbit docs](https://orbit.polar.sh/components/box), [LLM-safe DS blog](https://polar.sh/blog/orbit-llm-safe-design-system), Polar `clients/AGENTS.md`, ADR-0004.

---

## Phase 0 (done here)

### Vendored package

- **Location:** `apps/epure/packages/orbit` (alongside `epure-cli` / `epure-mcp`)
- **Import name:** `@polar-sh/orbit` (file dependency from `web/package.json`)
- **License:** Apache-2.0 — see `packages/orbit/LICENSE`, `NOTICE`, `VENDOR.md`
- **Upstream pin:** `packages/orbit/.vendor-commit`

```ts
import { Box } from '@polar-sh/orbit/Box'
import { Text, Button } from '@polar-sh/orbit'
import * as theme from '@polar-sh/orbit/theme'
```

### Toolchain

- `@stylexjs/stylex` + `@stylexjs/unplugin` **0.18.3** (matches Polar catalog / Orbit source)
- Shared Vite helper: `web/vite.stylex.ts` — used by `vite.config.ts` and `vite.playground.config.ts`
- Plugin order: **StyleX → React → Tailwind**; `devMode: 'full'` (injects `/virtual:stylex.css` + HMR runtime into HTML)
- **Declarations:** Orbit `prepare` / `build:types` emits `packages/orbit/dist/**/*.d.ts` so Epure `tsc` does not typecheck Polar source under `verbatimModuleSyntax`. Vite still consumes **source** via package `exports.default`.
- **light-dark() polyfill:** `src/styles/orbit-stylex.css` sets `--lightningcss-light` / `--lightningcss-dark` from the existing `html.dark` class (`style-theme.ts`). Native `color-scheme: light dark` as well. StyleX unplugin’s LightningCSS rewrite is what emits the `var(--lightningcss-*)` form into CSS.

### Proof page

```bash
cd apps/epure/web
npm run dev:playground
# open http://127.0.0.1:<port>/__design  (Vite prints the port; often 5173 or 5179)
```

Renders Orbit `Box`, `Text`, `Button`, and semantic `background-*` tiles. Does **not** replace Epure buttons or delete Calm Ledger.

### Out of scope for Phase 0

Phases 1–6 implementation beyond this plan + the proof page. Calm Ledger tokens, `components/ui`, and kit stay.

---

## Phase 1 — LLM-safe contract (done)

- `web/AGENTS.md` — Orbit UI authoring rules (Box/Text, no raw layout divs, closed tokens, light-dark).
- `web/CLAUDE.md` — pointer to AGENTS.md; Calm Ledger rules remain for product/kit until Phase 2.
- ESLint path-scoped bans on `src/pages/dev/orbit-*/**` (raw `div`; `className`/`style` on Box/Text; hex; `dark:`; Tailwind layout utilities). Calm Ledger pages still use the older shadcn bans.
- Recipes: `design/ORBIT_RECIPES.md` + live Recipes page on `/__design#recipes` (`orbit-recipes.tsx` + `docs/recipes-page.tsx`). `/__orbit` redirects there.

## Phase 2 — Replace `components/ui` (done)

- High-frequency `src/components/ui/*` retargeted to Orbit (thin Epure wrappers where product API requires it).
- `@/ui` façades re-export the same modules; `Modal` exported beside compound `Dialog`.
- ESLint Orbit bans expanded onto migrated ui files (see `eslint.config.js`).
- Calm Ledger CSS / tokens left in place (Phase 3). Kit untouched (Phase 4). No Orbit `DataTable`.

### Epure → Orbit mapping (Phase 2)

| Epure (`components/ui` / `@/ui`) | Orbit | Notes |
|---|---|---|
| `Button` | `Button` | Epure variants/sizes mapped; `signal`→default; `danger`→destructive; `filter*` Calm Ledger overlays; `asChild`/`hotkey` product API |
| `Input` | `Input` | `leadingIcon`→`preSlot`; `trailingShortcut`→kbd `postSlot`; ghost/size product API |
| `Checkbox` | `Checkbox` | Direct wrap |
| `Switch` | `Switch` | Radix (was Base UI); Epure `size` compact/default kept |
| `Tabs` / List / Trigger / Content | `Tabs`… | Orbit default; Epure `line`/`folder` variants via className overlays |
| `Select` / Trigger / Content / Item | `Select`… | Orbit; Epure trigger `size` sm/md kept |
| `Tooltip`* | `Tooltip`* | Re-export |
| `Badge` | `Pill` | Epure variant names → PillColor; sizes via className |
| `Dialog` (compound) | *(kept)* + `Modal` | Product compound API stays; new overlays use Orbit `Modal` |
| `TextArea` (new) | `TextArea` | Added façade |
| `sonner` | — | No Orbit toast; keep sonner |
| `table` | Orbit `ui/table` | Markup tables; Footer/Caption Epure locals |
| `DataTable` (kit) | Orbit `DataTable` | TanStack v9 reconciled |
| `status` / `alert` / `avatar` / `spinner` / `segmented-control` | Matching Orbit | Thin re-exports |
| `sheet` / `dropdown-menu` / `popover` / `command` / `radio-group` / `toggle-group` / `progress` / `separator` / `label` / `icon` / compound `dialog` | — | No Orbit equiv — Polar chrome on Radix/Vaul/cmdk |

See full inventory: [`ORBIT_RECIPES.md`](./ORBIT_RECIPES.md#component-inventory-orbit--epure).

## Phase 3 — Tokens & fonts own the theme (done)

- **`design/themes/orbit.css`** replaces Calm Ledger palette (file deleted). Product CSS var *names* (`--bg`, `--text`, `--accent`, badge chips, …) kept so kit/`app.css` still resolve; **values** are Orbit gray/polar/indigo/semantic.
- **`src/styles/tokens.css` `@theme`**: Polar `gray-*` / `polar-*` / red / blue / emerald / amber / purple ramps + `font-display` / `ring` / `background` so Orbit Tailwind components paint correctly. Epure utility aliases (`canvas`, `fg-*`, `badge-*`, `escalating`, …) point at Orbit surfaces — not a second palette.
- **Fonts:** Inter + Geist Mono (`src/styles/fonts.css`). PP Neue Montreal not shipped (licensing unclear); `InterDisplay` / `GeistMono` aliases cover Orbit StyleX fallbacks. IBM Plex packages removed.
- **`data-style="orbit"`** (legacy `calm-ledger` remapped in `style-theme.ts`).
- Phase 2 filter overlays retargeted to Orbit red/amber Tailwind classes.

## Phase 4 — Kit on Orbit (done)

- Restyled kit chrome on Box/Text (+ Phase 2 ui primitives): `page-shell`, `empty-state`, `section-card`, `code-frame`, `data-table` (**Orbit `DataTable`** after TanStack v9 reconcile), `filter-bar`, `command-bar` (trigger/item chrome; cmdk dialog kept), `usage-meter-card`, `nav-count-pastille`.
- Interaction contracts preserved (`className` / props / callbacks). Calm Ledger layout utilities retired inside touched files.
- **Deferred to Phase 6** (product surfaces, not generic chrome): `issue-row-shell`, `inbox-read-cue`, `inbox-lifecycle-cue`, `telemetry-chart`, `ask-agent-card`. `product-tour` stays driver.js + app.css popover. `time-window-select` already Orbit Select — left as thin wrapper.

## Phase 5 — Playground / registry (done)

- `/__design` defaults to **Docs** mode: registry-driven nav + `DocsPageHeader` / `DocsSection` / `DocsExample` (TSX, not MDX) — same pattern as [orbit.polar.sh](https://orbit.polar.sh/components/box).
- UI + kit modules documented as registry entries (`DESIGN_KIT_UI_META` / `DESIGN_KIT_KIT_META`) with live Example + import snippet.
- Visual reference: Box/Text recipes on `/__design#recipes` + `design/ORBIT_RECIPES.md`. Handbook: `/__design#handbook`.
- **Canvas** remains optional (`Docs | Canvas` toggle or `?view=canvas`) — not required for Polar parity.
- Docs chrome: `src/pages/dev/design-kit/docs/*` + `docs-entry.tsx` (Orbit ESLint bans).

## LLM-safe contract (Polar parity)

Epure implements the **same Orbit bet as Polar** — tokens as the only vocabulary,
Box instead of bare `<div>`, CI as the guarantee. Canonical write-up:
[`ORBIT_CONTRACT.md`](./ORBIT_CONTRACT.md) (mirrors Polar’s “Building an LLM safe
design system”). Agent entry: [`../AGENTS.md`](../AGENTS.md). Enforcement:
`eslint.config.js` → `orbitZoneFiles` + `orbitRestrictedSyntax` (`npm run lint`).

## Phase 6 — Epure-only product UI (**Orbit-by-default**)

- **ESLint:** `orbitZoneFiles` = `src/{components/ui,components/kit,ui,shell,features}/**` (+ design docs). Enforcement is the contract.
- **Deferred kit finished on Orbit:** `issue-row-shell` (Grid + Text), `inbox-read-cue` / `inbox-lifecycle-cue`, `ask-agent-card` (closed API), `telemetry-chart` Box chrome around recharts (file stays deferred as hatch).
- **`orbitZoneDeferred`:** only true third-party hosts (recharts, Shiki, driver.js, Radix/cmdk/sonner overlays) plus a shrinking careful-rewrite queue (alert detail, channels, some feed chrome). Do not grow this list; migrate off it file-by-file.

### Shell + Tailwind host fix (landed)

Broken hybrid symptoms were not “missing rounded-full” alone — Epure’s Tailwind
`spacing` map rewired `h-8`/`h-10` onto Calm Ledger `--space-8`/`--space-10`
(3rem / 5.5rem), so Orbit Button/Input looked oversized and “off”. Fixed by:

- Keeping default Tailwind numeric spacing for Orbit; Epure scale is `*-epure-N` only.
- Explicit `@source` for `packages/orbit/src` in `src/styles/tokens.css` (+ config `content`).
- App shell / top strip / sidebar restyled to Polar chrome (white canvas, gray-100
  active nav pills, black primary CTAs, Inter/`font-display`).
- UI façades stay thin Orbit wraps; Badge is Pill with no wrapper span.

### Polar-native chrome pass (landed after hybrid complaint)

The product still *felt* like Calm Ledger because primary surfaces kept tactile
cards, indigo `--state-selected` / `--accent`, and left-border settings nav —
wrappers alone did not fix that. Follow-up:

- **Tokens:** `--accent` / `--state-selected` / badge-accent → black + gray-100
  washes (Polar chrome), not indigo50 selection.
- **Home:** `PageShell` + Orbit `Alert` + **Polar card gallery** (`Grid` of soft
  `Box` cards: `borderRadius="xl"`, `Status` / `Avatar` / Badge→`Pill`) — not
  Orbit `List` rows, and not old `epure-card` / `shadow-tactile`.
- **Settings navs:** gray-100 `rounded-full` pills (same language as sidebar).
- **Overlays without Orbit:** cmdk / sonner / sheet / dropdown restyled to
  Polar gray/white/`rounded-2xl`/`rounded-full` — no second system.
- **Billing / team surrounding cards:** Polar `rounded-2xl` + gray borders;
  SectionCard shadow off, radius `l`.

**Honest remainder:** see `orbitZoneDeferred` in `eslint.config.js`. Prefer
adding a token or closed kit prop over extending that list.

---

## Non-goals / cautions

- Do not publish `@polar-sh/orbit` to npm from Epure; keep vendored + Apache attribution.
- Orbit `Button` still uses Tailwind + Polar-ish class names (`dark:bg-polar-*`, `font-display`). Until Phase 2–3 theme glue, Button may look partially unstyled in Epure; **Box/Text + StyleX tokens are the Phase 0 correctness bar**.
- Epure web pins `@tanstack/react-table` v9 to match Orbit. Use Orbit `DataTable` (`@/components/kit/data-table`) for typed record tables; Orbit `Table` (`@/components/ui/table`) for markup tables. `TableFooter` / `TableCaption` remain thin Epure locals (Orbit has none).
- Uncommitted Calm Ledger polish in the tree: Orbit adoption supersedes it; do not blindly wipe uncommitted work without review when starting Phase 2+.

---

## Phase 1 agent brief (completed — kept for history)

Phase 1 landed: `web/AGENTS.md`, path-scoped ESLint Orbit bans, `design/ORBIT_RECIPES.md`,
live recipes on `/__orbit`. Do not re-run unless those artifacts are missing.

## Phase 2 agent brief (completed — kept for history)

Phase 2 landed high-frequency Orbit wrappers under `components/ui` + `@/ui`,
ESLint expansion, mapping table above. Do not re-run unless those artifacts are missing.

## Phase 3 agent brief (completed — kept for history)

Phase 3 landed: `design/themes/orbit.css`, Orbit-owned `@theme`, Inter + Geist Mono,
Calm Ledger theme deleted, filter overlays on Orbit ramps. Do not re-run unless those
artifacts are missing.

## Phase 4 agent brief (completed — kept for history)

Phase 4 landed kit chrome on Box/Text (see Phase 4 section). Do not re-run unless those
modules regress to Calm Ledger layout utilities.

## Phase 5 agent brief (completed — kept for history)

Phase 5 landed: `/__design` Docs registry + Example pages, canvas optional,
UI/kit meta entries, docs chrome under `design-kit/docs/`. Do not re-run unless
those artifacts are missing.

## Phase 6 agent brief (completed — shrink deferred only)

```
Phase 6 landed Orbit-by-default (orbitZoneFiles globs). Do not re-open Phases 0–5.
When touching a path in orbitZoneDeferred: migrate to Box/Text + tokens, remove it
from orbitZoneDeferred in the same PR, keep closed kit APIs (no public className).
True hatches (recharts / Shiki / driver.js / Radix menu width) may keep createElement
or host className — document why, do not invent a second layout system.
Verify: npm run lint && npx tsc -b tsconfig.app.json. Do not commit unless asked.
```
