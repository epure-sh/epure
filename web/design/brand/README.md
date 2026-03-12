# Epure brand — logo system

Calm Ledger identity: indigo instrument, title-case wordmark, geometric restraint.

| Token | Light | Use |
|---|---|---|
| Accent | `#4338ca` | Mark background |
| Accent contrast | `#ffffff` | Mark foreground |
| Ink | `#0a0a0a` | Wordmark |

Typography: **IBM Plex Sans Medium**, `tracking-ui` (−0.007em), title case **Epure**.

---

## Canonical mark — Chain link (`kit/`)

**Export kit:** [`kit/README.md`](./kit/README.md) — mark, lockup, icon, favicon, and social assets in all Calm Ledger color variants. Regenerate with `python3 kit/generate.py`.

| Touchpoint | File |
|---|---|
| Symbol (currentColor) | `kit/source/mark.svg` |
| Favicon | `web/public/favicon.svg` ← synced from `kit/favicon/` |
| Quick import | `epure-mark.svg` |

Geometry: stadium `54×32`, stroke `8.5`, diagonal cuts at `27.5°`.

---

## Legacy mark — Pure Spike (#7)

**Metaphor:** A calm ledger baseline (horizontal pill) with a single exception spike rising from it. One event on an otherwise flat line — the core job of exception-only monitoring. *Epure* = pure signal, noise stripped away.

**Strategy (big-company methodology):**
- **Discovery:** Epure surfaces one exception from a calm stream; favicon/navbar/lockup must read instantly.
- **Differentiation:** Unlike generic pill+dot SaaS marks (#2), silhouette is an inverted-T / timeline spike — ownable monitoring metaphor.
- **Squint test:** Blur → horizontal bar + vertical spike remain two distinct blobs.
- **16px test:** Baseline = 11×2.5px pill; spike = 3×8px pill — both survive pixel grid.

**Geometry** (32×32 viewBox, source of truth in `src/ui/logo.tsx`):

| Element | Spec | Rationale |
|---|---|---|
| Container | `32×32`, `rx=8` | Matches app radius token (25%) |
| Baseline | `x=5 y=21 w=22 h=5 rx=2.5` | Calm ledger row; 2.5px tall at 16px |
| Spike | `x=13 y=6 w=6 h=16 rx=3` | Single exception; 3px wide at 16px |
| Overlap | Spike bottom meets baseline | Reads as one instrument, not two floating shapes |

**Clear space:** Minimum padding equal to spike width (6 units) around the mark bounding box.

**Proportions at touchpoints:**

| Touchpoint | Size | Baseline | Spike |
|---|---|---|---|
| Favicon | 16×16 | 11×2.5 px pill | 3×8 px pill |
| Navbar | 22×22 | 15×3.4 px pill | 4.1×11 px pill |
| Lockup | 28×28 | 19×4.4 px pill | 5.3×14 px pill |

---

## New directions (2026-09-14 research pass)

Three marks designed from the big-company playbook (Paul Rand simplicity, Google squint test, Stripe restraint, product-native metaphor).

| # | Name | Metaphor | Status |
|---|---|---|---|
| 1 | Signal Ledger | Active issue row + muted ledger lines | Legacy alternate |
| 2 | Live Strike | Vertical bar + signal dot | Prior canonical |
| 3 | Valve Gate | Flow channel (hairline version) | Legacy alternate |
| 4 | Stack Frame | Corner bracket | Dev-native alternate |
| 5 | Monogram e | Lowercase *e* | Wordmark fallback |
| 6 | Noise → Signal | Fading dots | Rejected at favicon |
| **7** | **Pure Spike** | Calm baseline + exception spike | Legacy (pre chain-link) |
| **25** | **Chain link** | Interlocking stadium ring | **Canonical** (`kit/`) |
| 8 | Spike Valve | Twin wedges / ingest gate | Runner-up |
| 9 | Pure Frame | Open corner + captured square | Alternate |

### #8 Spike Valve
Two solid wedges meeting at center — spike valve / ingest gate. No hairlines or opacity (fixes weaknesses of #3). Hourglass silhouette passes squint test.

### #9 Pure Frame
Thick L-frame with open top-right corner + small square in the gap — purity through subtraction; the captured exception. Two bold shapes, no diagonal slash.

---

## Files

```
web/design/brand/
  README.md           this guide
  marks/01–09.svg     export-ready marks
web/public/
  favicon.svg         Pure Spike (#7)
web/src/ui/logo.tsx   React components (source of truth)
```

---

## Usage

```tsx
import { LogoMark, LogoLockup, LogoNavButton } from "@/ui/logo";

<LogoMark variant={7} size={32} />
<LogoLockup variant={7} />
<LogoNavButton variant={7} onClick={...} />
```

- **Navbar:** mark only at 22×22 (`LogoNavButton`, default `variant={7}`)
- **Marketing / login:** lockup (28px mark + wordmark)
- **Favicon:** `public/favicon.svg` (synced to `PURE_SPIKE_GEOMETRY`)
- **Compare directions:** `<LogoExplorationRow />` renders all 9 variants

---

## Rules

- Title case **Epure** — never EPURE or all-lowercase epure in UI copy
- No red, shields, bugs, or mascots in the mark
- Mark must read at **16×16** (favicon) and **22×22** (navbar)
- Colors via tokens (`fill-accent`, `text-ink`) — no hex in JSX outside design files
- Minimum two bold foreground shapes; no hairlines, opacity tricks, or diagonal slashes

---

## Future evolution

- **Motion:** Subtle spike pulse when live events arrive — never in static favicon.
- **Standalone symbol:** Once brand recognition builds, drop wordmark in more contexts.
- **Spike Valve (#8):** Pair with spike-valve / ingest-cap marketing.
